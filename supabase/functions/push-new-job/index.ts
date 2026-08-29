// Hacking Hub Admin Dashboard - New Job Board Post Push Notification (hh-app)
//
// Deploy with: supabase functions deploy push-new-job
// Requires a secret set first:
//   supabase secrets set FCM_SERVICE_ACCOUNT='<the full JSON key from Firebase>'
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.)
//
// Needs a real Firebase project first - see hh-app's README. Called by
// hh-app's Job Board screen right after a listing is successfully posted
// (fire-and-forget - a failed push here doesn't undo the post). Takes only
// a job_id and re-reads the real row server-side rather than trusting a
// client-supplied title/company, same "never trust the client for what
// gets shown" rule as every other Edge Function in this project.
//
// v1 notifies every registered device, not just members whose track
// matches the listing's tags - job_board has no structured track field to
// match against member_profiles.roadmap_track today, and tags are
// free-text. Worth narrowing once there's real usage data on how members
// respond to an unfiltered push.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const fcmServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT');

    if (!fcmServiceAccount) {
      console.error('push-new-job: missing FCM_SERVICE_ACCOUNT secret');
      return new Response(JSON.stringify({ error: 'Not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify identity - only a real, allowed member can trigger a
    // community-wide push, not just anyone who finds this URL.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    if (authError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { allowed } = await adminClient.rpc('is_member_allowed', { check_email: userData.user.email }).then((r) => ({ allowed: r.data === true }));
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Access not permitted.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { job_id } = await req.json();
    if (typeof job_id !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing job_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: job, error: jobError } = await adminClient
      .from('job_board')
      .select('title, company')
      .eq('id', job_id)
      .maybeSingle();
    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tokenRows, error: tokenError } = await adminClient.rpc('get_all_push_tokens');
    if (tokenError) {
      console.error('push-new-job: token lookup failed', tokenError.message);
      return new Response(JSON.stringify({ error: 'Token lookup failed.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokens = (tokenRows || []).map((r: { token: string }) => r.token);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ candidates: 0, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = await getFcmAuth(fcmServiceAccount);
    let sent = 0;
    for (const token of tokens) {
      try {
        const ok = await sendPush(auth.accessToken, auth.projectId, token, 'New Job Board post', `${job.title} at ${job.company}`);
        if (ok) sent += 1;
      } catch (err) {
        console.error('push-new-job: send failed', err instanceof Error ? err.message : err);
      }
    }

    return new Response(JSON.stringify({ candidates: tokens.length, sent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('push-new-job error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
