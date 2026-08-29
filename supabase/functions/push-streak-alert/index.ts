// Hacking Hub Admin Dashboard - Streak-Lapse Push Notification (hh-app)
//
// Deploy with: supabase functions deploy push-streak-alert --no-verify-jwt
// Requires these secrets set first:
//   supabase secrets set FCM_SERVICE_ACCOUNT='<the full JSON key from Firebase>'
//   supabase secrets set CRON_SECRET=<same value roadmap-reminder-email uses>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Needs a real Firebase project first - see hh-app's README for the setup
// steps (there's no way to generate FCM_SERVICE_ACCOUNT from this repo
// alone). Triggered daily in the evening by pg_cron (see
// supabase/049_push_notification_crons.sql) - anyone whose last_login_date
// is yesterday and whose streak is at least 2 gets one push tonight,
// same exact-checkpoint idempotency approach as roadmap-reminder-email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function getFcmAuth(serviceAccountJson: string): Promise<{ accessToken: string; projectId: string }> {
  const sa = JSON.parse(serviceAccountJson);
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${encode(header)}.${encode(claims)}`;

  const pem = (sa.private_key as string)
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${unsigned}.${encodedSig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
  const json = await res.json();
  return { accessToken: json.access_token, projectId: sa.project_id };
}

async function sendPush(accessToken: string, projectId: string, token: string, title: string, body: string): Promise<boolean> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, notification: { title, body } } }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const fcmServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!fcmServiceAccount || !supabaseUrl || !serviceRoleKey) {
    console.error('push-streak-alert: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: lapsing, error: queryError } = await adminClient.rpc('get_members_with_lapsing_streak');
  if (queryError) {
    console.error('push-streak-alert: query failed', queryError.message);
    return new Response('Query failed', { status: 500 });
  }

  const members = lapsing || [];
  if (members.length === 0) {
    return new Response(JSON.stringify({ candidates: 0, sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: tokenRows, error: tokenError } = await adminClient.rpc('get_push_tokens_for_emails', {
    p_emails: members.map((m: { email: string }) => m.email),
  });
  if (tokenError) {
    console.error('push-streak-alert: token lookup failed', tokenError.message);
    return new Response('Token lookup failed', { status: 500 });
  }

  const tokensByEmail = new Map<string, string[]>();
  for (const row of tokenRows || []) {
    const list = tokensByEmail.get(row.email) || [];
    list.push(row.token);
    tokensByEmail.set(row.email, list);
  }

  let auth;
  try {
    auth = await getFcmAuth(fcmServiceAccount);
  } catch (err) {
    console.error('push-streak-alert: FCM auth failed', err instanceof Error ? err.message : err);
    return new Response('FCM auth failed', { status: 500 });
  }

  let sent = 0;
  for (const member of members) {
    const tokens = tokensByEmail.get(member.email) || [];
    if (tokens.length === 0) continue;
    const firstName = (member.full_name || '').trim().split(' ')[0] || 'there';
    let anySent = false;
    for (const token of tokens) {
      try {
        const ok = await sendPush(
          auth.accessToken,
          auth.projectId,
          token,
          `Don't lose your ${member.login_streak}-day streak, ${firstName}`,
          'Open the app and log in before midnight to keep it going.'
        );
        if (ok) anySent = true;
      } catch (err) {
        console.error(`push-streak-alert: send failed for ${member.email}`, err instanceof Error ? err.message : err);
      }
    }
    if (anySent) {
      sent += 1;
      const { error: markError } = await adminClient.rpc('mark_streak_push_sent', { p_email: member.email });
      if (markError) {
        console.error(`push-streak-alert: mark_streak_push_sent failed for ${member.email}`, markError.message);
      }
    }
  }

  return new Response(JSON.stringify({ candidates: members.length, sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
