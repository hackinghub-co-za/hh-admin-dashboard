// Hacking Hub Admin Dashboard - Take a Break Admin Alert Email
//
// Deploy with: supabase functions deploy take-a-break-alert-email
// Requires this secret set first (shared with every other Resend-based
// function, no separate key needed):
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.)
//
// Called once, fire-and-forget, right after start_my_break() succeeds
// client-side (src/lib/breakData.js's notifyBreakStarted(), from
// MemberPortal.jsx's handleStartBreak) - same "client POSTs an Edge
// Function right after its own successful mutation" shape as
// cert-perk-request-email, not a DB trigger/pg_net call (nothing else in
// this project fires an email that way; pg_net here is only ever used for
// scheduled *_cron.sql digests).
//
// Deliberately does NOT trust how many days / which break_until the client
// claims: it re-reads break_started_at/break_until straight off the
// caller's own member_profiles row with the service-role client, the exact
// values start_my_break() (095_take_a_break.sql) already validated and
// wrote. If a member isn't actually on a break when this fires (a stale or
// forged call), it fails closed - no email goes out - rather than emailing
// an admin about a break that doesn't exist.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const ADMIN_ALERT_EMAIL = 'siya@hackinghub.co.za';
const PORTAL_URL = 'https://portal.hackinghub.co.za';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendEmail(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: toEmail, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend request failed: ${res.status} ${text}`);
  }
}

function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(`${d}T00:00:00`) : d;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function alertEmailHtml(memberName: string, memberEmail: string, startedOn: string, untilDate: string, days: number): string {
  return `
    <p>${memberName} (${memberEmail}) just started a ${days}-day break.</p>
    <p style="margin:18px 0;padding:16px 18px;border:1px solid #e2e2e2;border-radius:8px;">
      <strong>On a break until ${fmtDate(untilDate)}</strong><br/>
      Started ${fmtDate(startedOn)} - ${days} day${days === 1 ? '' : 's'}
    </p>
    <p style="font-size:13px;color:#666;margin:0 0 18px;">
      While paused: Accountability check-ins, the Roadmap stale-nudge banner and reminder email, the
      TryHackMe competition's pace sweep, and the login streak (frozen, not reset) all leave them alone.
      There's no "I'm back" button - it resumes on its own on ${fmtDate(untilDate)}, no action needed from you.
    </p>
    <p style="margin:22px 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Open Admin Dashboard</a>
    </p>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'Not configured - missing RESEND_API_KEY secret.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    const callerEmail = (userData?.user?.email || '').toLowerCase();
    if (authError || !callerEmail) {
      return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: allowed } = await adminClient.rpc('is_member_allowed', { check_email: callerEmail });
    if (allowed !== true) {
      return new Response(JSON.stringify({ error: 'Access not permitted.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The real, already-validated break - never the client's own claim of
    // how many days or which date.
    const { data: profile } = await adminClient
      .from('member_profiles')
      .select('full_name, break_started_at, break_until')
      .eq('email', callerEmail)
      .maybeSingle();

    if (!profile?.break_until || !profile?.break_started_at) {
      return new Response(JSON.stringify({ error: 'No active break on record for this member.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberName = profile.full_name || callerEmail;
    const startedOnSast = new Date(profile.break_started_at).toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
    const days = Math.round((new Date(`${profile.break_until}T00:00:00Z`).getTime() - new Date(`${startedOnSast}T00:00:00Z`).getTime()) / 86400000);

    await sendEmail(
      resendKey,
      ADMIN_ALERT_EMAIL,
      `${memberName} is on a break (${days} day${days === 1 ? '' : 's'})`,
      alertEmailHtml(memberName, callerEmail, startedOnSast, profile.break_until, Math.max(1, days))
    );

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('take-a-break-alert-email error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
