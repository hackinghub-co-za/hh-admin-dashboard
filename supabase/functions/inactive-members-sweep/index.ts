// Hacking Hub Admin Dashboard - Remove members who have not signed in for 60 days
//
// Deploy with: supabase functions deploy inactive-members-sweep --no-verify-jwt
// Uses the secrets already set for the other email functions (RESEND_API_KEY,
// CRON_SECRET) - no new ones needed.
//
// Triggered by pg_cron every day at 06:30 SAST (111_inactive_member_removal.sql),
// which sends the x-cron-secret header. Each run, in this order:
//  1. Removes the members who were put on a warning email at least 3 days ago
//     and still have not signed in (status = 'Left', which is what takes them
//     off the allow-list), then emails the founder who was removed.
//  2. Emails the founder the members who just reached 57 days without a
//     sign-in, so they have 3 days before they are removed, and only then
//     records that they were warned. If that email fails, nobody is marked as
//     warned and nobody can be removed on the strength of it.
// Mentors and anyone who has paid in the last 60 days are always spared.
// The rules live in inactivity_candidates() and the two functions beside it,
// which only the service role can call. A body of { "dryRun": true } returns
// the two lists as they stand now and changes and sends nothing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Hacking Hub <siya@hackinghub.co.za>';
const TO_ADDRESS = 'siya@hackinghub.co.za';
const PORTAL_URL = 'https://portal.hackinghub.co.za';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const dayFmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-ZA', { timeZone: 'UTC', ...opts });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const C = { navy: '#17183c', ink: '#1b1d3a', ink3: '#6b7096', line: '#e3e5f1' };

function table(rows: Row[], dateCol: { label: string; value: (r: Row) => string }): string {
  const th = (t: string, right = false) => `<th style="text-align:${right ? 'right' : 'left'};font-size:11px;color:${C.ink3};text-transform:uppercase;letter-spacing:.5px;padding:7px 6px;border-bottom:1px solid ${C.line};">${t}</th>`;
  const body = rows.map((r) => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid ${C.line};font-size:14px;vertical-align:top;">${esc(r.name || r.email)}<div style="font-size:12px;color:${C.ink3};">${esc(r.email)} · ${esc(r.status)}${r.plan ? ` · ${esc(r.plan)}` : ''}</div></td>
      <td style="padding:8px 6px;border-bottom:1px solid ${C.line};font-size:13px;vertical-align:top;">${r.last_login ? esc(dayFmt(r.last_login, { day: 'numeric', month: 'short', year: 'numeric' })) : 'Never signed in'}<div style="font-size:12px;color:${C.ink3};">${esc(r.days_inactive)} days${r.last_login ? '' : ' since joining'}</div></td>
      <td style="padding:8px 6px;border-bottom:1px solid ${C.line};font-size:13px;vertical-align:top;">${r.last_payment ? esc(dayFmt(r.last_payment, { day: 'numeric', month: 'short', year: 'numeric' })) : 'No payment on record'}</td>
      <td style="padding:8px 6px;border-bottom:1px solid ${C.line};font-size:13px;vertical-align:top;white-space:nowrap;">${esc(dateCol.value(r))}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;color:${C.ink};">
    <tr>${th('Member')}${th('Last sign-in')}${th('Last payment')}${th(dateCol.label)}</tr>${body}</table>`;
}

function shell(heading: string, intro: string, inner: string): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;color:${C.ink};line-height:1.5;padding:26px;">
    <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.ink3};">Inactive members</p>
    <h1 style="font-size:21px;line-height:1.25;margin:6px 0 8px;color:${C.navy};">${esc(heading)}</h1>
    <p style="margin:0 0 18px;font-size:14px;">${intro}</p>
    ${inner}
    <p style="margin:24px 0 0;"><a href="${PORTAL_URL}" style="display:inline-block;background:${C.navy};color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Open the admin dashboard</a></p>
    <p style="font-size:12px;color:${C.ink3};margin-top:20px;border-top:1px solid ${C.line};padding-top:12px;">Sent automatically. Mentors and anyone who has paid in the last 60 days are never included. Removing a member sets their status to Left in the Members tab, so you can put them back by changing it. Sent to ${TO_ADDRESS} only.</p>
  </div>`;
}

function warnEmail(warn: Row[]) {
  const removalDate = warn[0].removal_date as string;
  const when = dayFmt(removalDate, { weekday: 'long', day: 'numeric', month: 'long' });
  return {
    subject: `Inactive members: ${plural(warn.length, 'member')} will be removed on ${dayFmt(removalDate, { day: 'numeric', month: 'short' })}`,
    html: shell(
      `${plural(warn.length, 'member')} will be removed from the portal on ${when}`,
      `These members have not signed in for 57 days or more. Unless they sign in before ${esc(dayFmt(removalDate, { day: 'numeric', month: 'long' }))}, they will be blocked and taken off the allow-list. To keep someone, set their status to Active again or ask them to sign in; anyone who signs in is dropped from the list automatically.`,
      table(warn, { label: 'Removed on', value: () => dayFmt(removalDate, { day: 'numeric', month: 'short' }) }),
    ),
  };
}

function removedEmail(removed: Row[], detail: Row[], today: string) {
  const byEmail = new Map(detail.map((r) => [r.email, r]));
  const rows = removed.map((r) => ({ ...(byEmail.get(r.email) || {}), email: r.email, name: r.name }));
  return {
    subject: `Inactive members: ${plural(removed.length, 'member')} removed today`,
    html: shell(
      `${plural(removed.length, 'member')} removed from the portal today`,
      'They were on a warning email at least 3 days ago and have still not signed in. They are now blocked and off the allow-list.',
      table(rows, { label: 'Removed', value: () => dayFmt(today, { day: 'numeric', month: 'short' }) }),
    ),
  };
}

async function sendEmail(resendKey: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [TO_ADDRESS], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
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
    return new Response(JSON.stringify({ error: 'Not configured.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* the cron sends no body */ }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.rpc('inactivity_candidates');
    if (error) throw new Error(`inactivity_candidates failed: ${error.message}`);
    const warn: Row[] = data?.warn || [];
    const remove: Row[] = data?.remove || [];
    const today: string = data?.today;

    if (body.dryRun) return json({ dryRun: true, today, warn, remove });

    let removedCount = 0;
    let warnedCount = 0;

    // 1. Removals first: only people already warned at least 3 days ago.
    if (remove.length) {
      const { data: removed, error: rmErr } = await admin.rpc('remove_inactive_members', { p_emails: remove.map((r) => r.email) });
      if (rmErr) throw new Error(`remove_inactive_members failed: ${rmErr.message}`);
      removedCount = (removed || []).length;
      if (removedCount) {
        const mail = removedEmail(removed, remove, today);
        await sendEmail(resendKey, mail.subject, mail.html);
      }
    }

    // 2. Warn about the next group. Marked as warned only after the email is out.
    if (warn.length) {
      const mail = warnEmail(warn);
      await sendEmail(resendKey, mail.subject, mail.html);
      const { data: marked, error: markErr } = await admin.rpc('mark_inactivity_warned', { p_emails: warn.map((r) => r.email) });
      if (markErr) throw new Error(`mark_inactivity_warned failed: ${markErr.message}`);
      warnedCount = Number(marked) || 0;
    }

    return json({ removed: removedCount, warned: warnedCount });
  } catch (err) {
    console.error('inactive-members-sweep error:', err);
    return json({ error: 'The inactive member sweep failed.' }, 500);
  }
});
