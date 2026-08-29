// Hacking Hub Admin Dashboard - 1-on-1 Starting Soon Push Notification (hh-app)
//
// Deploy with: supabase functions deploy push-1on1-reminder --no-verify-jwt
// Requires these secrets set first:
//   supabase secrets set FCM_SERVICE_ACCOUNT='<the full JSON key from Firebase>'
//   supabase secrets set GOOGLE_TOKEN_ENCRYPTION_KEY=<same value store-google-refresh-token uses>
//   supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<the web app's own Google OAuth client ID>
//   supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=<the web app's own Google OAuth client secret>
//   supabase secrets set CRON_SECRET=<same value roadmap-reminder-email uses>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Triggered every ~15 minutes by pg_cron (see
// supabase/049_push_notification_crons.sql). For every member with a
// stored, encrypted Google refresh token (048_push_notifications.sql PART
// 3), refreshes a real access token, pulls their upcoming Calendar events
// (same GET pattern as src/lib/googleCalendar.js / lib/services/
// calendar_service.dart), and looks for one organized by a mentor
// (kMentors in hh-app's lib/constants.dart) starting in the next 30
// minutes. push_1on1_sent (048 PART 4) stops the same meeting firing more
// than once across polling runs. A refresh failure for one member (a
// revoked grant, an expired/invalid refresh token) is logged and skipped -
// it must never abort the run for everyone else.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// Mirrors hh-app's lib/constants.dart kMentorEmails - kept in sync by hand,
// same as every other small duplicated helper in this Edge Functions
// folder. Only meetings organized by one of these count as a "1-on-1".
const MENTOR_EMAILS = new Set([
  'siya@hackinghub.co.za',
  'nonhlanhlakamangethe@gmail.com',
  'kmchunu029@gmail.com',
]);

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

// Exchanges a stored refresh token for a fresh short-lived access token.
// Throws on failure (a revoked grant, expired refresh token) so the caller
// can skip just this one member rather than the whole run.
async function refreshGoogleAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

interface CalendarEvent {
  id: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
}

// Same query shape as fetchCalendarEvents in googleCalendar.js -
// singleEvents + orderBy startTime, from now onward.
async function fetchUpcomingEvents(accessToken: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: '20',
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const res = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
  const json = await res.json();
  return json.items || [];
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
  const encryptionKey = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY');
  const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!fcmServiceAccount || !encryptionKey || !googleClientId || !googleClientSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('push-1on1-reminder: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: tokenRows, error: tokenError } = await adminClient.rpc('_get_all_decrypted_google_tokens', {
    p_key: encryptionKey,
  });
  if (tokenError) {
    console.error('push-1on1-reminder: token lookup failed', tokenError.message);
    return new Response('Token lookup failed', { status: 500 });
  }

  const members: { email: string; refresh_token: string }[] = tokenRows || [];
  if (members.length === 0) {
    return new Response(JSON.stringify({ candidates: 0, sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let fcmAuth;
  try {
    fcmAuth = await getFcmAuth(fcmServiceAccount);
  } catch (err) {
    console.error('push-1on1-reminder: FCM auth failed', err instanceof Error ? err.message : err);
    return new Response('FCM auth failed', { status: 500 });
  }

  const windowStart = Date.now();
  const windowEnd = windowStart + 30 * 60 * 1000;

  let candidates = 0;
  let sent = 0;

  for (const member of members) {
    let events: CalendarEvent[];
    try {
      const accessToken = await refreshGoogleAccessToken(member.refresh_token, googleClientId, googleClientSecret);
      events = await fetchUpcomingEvents(accessToken);
    } catch (err) {
      console.error(`push-1on1-reminder: calendar lookup failed for ${member.email}`, err instanceof Error ? err.message : err);
      continue;
    }

    const meeting = events.find((evt) => {
      const organizerEmail = (evt.organizer?.email || '').toLowerCase();
      if (!MENTOR_EMAILS.has(organizerEmail) || evt.status === 'cancelled') return false;
      const start = evt.start?.dateTime;
      if (!start) return false;
      const startMs = new Date(start).getTime();
      return startMs >= windowStart && startMs <= windowEnd;
    });
    if (!meeting) continue;

    candidates += 1;

    const { data: already } = await adminClient
      .from('push_1on1_sent')
      .select('event_id')
      .eq('email', member.email)
      .eq('event_id', meeting.id)
      .maybeSingle();
    if (already) continue;

    const { data: tokens, error: tokenLookupError } = await adminClient
      .from('push_tokens')
      .select('token')
      .eq('email', member.email);
    if (tokenLookupError || !tokens || tokens.length === 0) continue;

    let anySent = false;
    for (const row of tokens) {
      try {
        const ok = await sendPush(
          fcmAuth.accessToken,
          fcmAuth.projectId,
          row.token,
          '1-on-1 starting soon',
          `${meeting.summary || 'Your 1-on-1'} starts in about 30 minutes.`
        );
        if (ok) anySent = true;
      } catch (err) {
        console.error(`push-1on1-reminder: send failed for ${member.email}`, err instanceof Error ? err.message : err);
      }
    }

    if (anySent) {
      sent += 1;
      const { error: markError } = await adminClient
        .from('push_1on1_sent')
        .insert({ email: member.email, event_id: meeting.id });
      if (markError) {
        console.error(`push-1on1-reminder: dedup insert failed for ${member.email}`, markError.message);
      }
    }
  }

  return new Response(JSON.stringify({ candidates, sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
