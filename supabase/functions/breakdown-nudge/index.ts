// Hacking Hub Admin Dashboard - Weekly Breakdown Wednesday Nudge
//
// Deploy with: supabase functions deploy breakdown-nudge --no-verify-jwt
// Requires: RESEND_API_KEY, CRON_SECRET (both already set).
//
// Triggered by pg_cron at 13:00 UTC every Wednesday (= 15:00 SAST) - see
// supabase/069_weekly_breakdown_cron.sql. Checks whether the coming Friday
// already has an Approved breakdown. If it does, this does nothing. If it
// doesn't, it emails every facilitator (founder + Community Managers) a
// single early reminder - enough runway to still get it reviewed by
// Thursday.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>';

async function sendOne(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: toEmail, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
}

// The Friday of the current week, in UTC. Wednesday + 2 days = Friday.
function comingFriday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
}

function nudgeHtml(firstName: string, friday: string, status: string | null): string {
  const state = status === 'Draft'
    ? "It's sitting in Draft - it needs a review pass and someone to hit Approve."
    : "Nothing's been drafted for it yet.";
  return `
    <p>Hi ${firstName},</p>
    <p>Heads up: <strong>this Friday's incident breakdown (${friday}) isn't approved yet.</strong> ${state}</p>
    <p>The send goes out automatically Friday 08:00 SAST. If there's no Approved edition by then, nothing goes to members and the founder gets an alert instead.</p>
    <p>Plenty of runway to sort it before Thursday.</p>
    <p>&mdash; Gemma</p>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!resendKey || !supabaseUrl || !serviceRoleKey) {
    console.error('breakdown-nudge: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const friday = comingFriday();

  // Is there already an Approved edition for Friday? If so, nothing to do.
  const { data: approved, error: aErr } = await admin
    .rpc('get_approved_breakdown_for_date', { p_send_date: friday });
  if (aErr) {
    console.error('breakdown-nudge: lookup failed', aErr.message);
    return new Response('Lookup failed', { status: 500 });
  }
  if ((Array.isArray(approved) ? approved.length : approved) ) {
    return new Response(JSON.stringify({ nudged: 0, reason: 'friday already approved' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Not approved - is there at least a Draft, or nothing at all?
  const { data: draftRows } = await admin
    .from('weekly_breakdowns')
    .select('status')
    .eq('send_date', friday)
    .limit(1);
  const currentStatus: string | null = draftRows?.[0]?.status ?? null;

  const { data: facilitators, error: fErr } = await admin.rpc('get_breakdown_facilitator_emails');
  if (fErr) {
    console.error('breakdown-nudge: facilitator query failed', fErr.message);
    return new Response('Facilitator query failed', { status: 500 });
  }

  let nudged = 0;
  const failures: string[] = [];
  for (const f of facilitators || []) {
    const firstName = (f.full_name || '').trim().split(' ')[0] || 'there';
    try {
      await sendOne(resendKey, f.email, `This Friday's breakdown isn't approved yet`, nudgeHtml(firstName, friday, currentStatus));
      nudged += 1;
    } catch (e) {
      console.error(`breakdown-nudge: failed for ${f.email}`, e instanceof Error ? e.message : e);
      failures.push(f.email);
    }
  }

  return new Response(JSON.stringify({ nudged, failed: failures, friday, currentStatus }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
