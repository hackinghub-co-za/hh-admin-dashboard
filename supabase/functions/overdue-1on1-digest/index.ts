// Hacking Hub Admin Dashboard - Overdue 1-on-1 Digest
//
// Deploy with: supabase functions deploy overdue-1on1-digest --no-verify-jwt
// Requires these secrets (already set for the other email functions - no
// new ones needed):
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
//   supabase secrets set CRON_SECRET=<the same random string>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Triggered by pg_cron daily (071_overdue_1on1_digest_cron.sql) - a single
// straight-to-the-founder digest, not a member-facing send like every
// other email function here. Every active member with no completed 1-on-1
// in the last 30 days - including one who's never had one at all - via
// get_members_overdue_for_1on1() (071_overdue_1on1_digest.sql).
//
// Sends every day regardless of whether the list is empty, deliberately -
// a day with nobody overdue gets a short "all caught up" email rather than
// silence, so a broken cron reads as "the emails stopped," not as "nothing
// to report today."

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>';
const RECIPIENT = 'siya@hackinghub.co.za';
const OVERDUE_AFTER_DAYS = 30;

async function sendEmail(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: toEmail, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function digestHtml(rows: { email: string; full_name: string | null; last_1on1_at: string | null }[]): string {
  if (rows.length === 0) {
    return `
      <p>Good morning,</p>
      <p><strong>Nobody's overdue for a 1-on-1 today</strong> - every active member has had one within the last ${OVERDUE_AFTER_DAYS} days. 🎉</p>
      <p>&mdash; Gemma</p>
    `;
  }
  const items = rows.map((r) => {
    const name = esc(r.full_name || r.email);
    const when = r.last_1on1_at
      ? `last one ${new Date(r.last_1on1_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : 'never had one';
    return `<li><strong>${name}</strong> (${esc(r.email)}) &mdash; ${when}</li>`;
  }).join('');
  return `
    <p>Good morning,</p>
    <p><strong>${rows.length} active member${rows.length === 1 ? '' : 's'}</strong> ${rows.length === 1 ? "hasn't" : "haven't"} had a 1-on-1 in over ${OVERDUE_AFTER_DAYS} days:</p>
    <ul>${items}</ul>
    <p style="color:#888;font-size:13px;">Sorted oldest-first - whoever's been waiting longest is at the top.</p>
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
    console.error('overdue-1on1-digest: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: rows, error } = await admin.rpc('get_members_overdue_for_1on1', { p_days: OVERDUE_AFTER_DAYS });
  if (error) {
    console.error('overdue-1on1-digest: lookup failed', error.message);
    return new Response('Lookup failed', { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const subject = rows?.length
    ? `${rows.length} member${rows.length === 1 ? '' : 's'} overdue for a 1-on-1 (${today})`
    : `All caught up on 1-on-1s (${today})`;

  try {
    await sendEmail(resendKey, RECIPIENT, subject, digestHtml(rows || []));
  } catch (e) {
    console.error('overdue-1on1-digest: send failed', e instanceof Error ? e.message : e);
    return new Response('Send failed', { status: 500 });
  }

  return new Response(JSON.stringify({ overdueCount: rows?.length || 0 }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
