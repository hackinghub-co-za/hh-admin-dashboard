// Hacking Hub Admin Dashboard - Focus 5 "we haven't seen you" reminder
//
// Deploy with: supabase functions deploy focus-five-absence-email --no-verify-jwt
// Uses the secrets already set for the other email functions (RESEND_API_KEY,
// CRON_SECRET) - no new ones needed.
//
// Triggered by pg_cron every morning at 08:00 SAST (038_focus_five.sql),
// which sends the x-cron-secret header. For every Focus 5 member who hasn't
// signed in for 3 full days (focus_five_absent_due()), it emails the member a
// friendly nudge from Siya, marks them as nudged for this absence
// (focus_five_mark_nudged()) only after their email went out, then sends the
// founder one email listing who was nudged. A body of { "dryRun": true }
// returns who would be emailed and sends nothing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Siya from Hacking Hub <siya@hackinghub.co.za>';
const FOUNDER = 'siya@hackinghub.co.za';
const PORTAL_URL = 'https://portal.hackinghub.co.za';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const C = { navy: '#17183c', ink: '#1b1d3a', ink3: '#6b7096', line: '#e3e5f1', green: '#17a856' };

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const firstName = (name: string) => {
  const f = String(name || '').trim().split(/\s+/)[0];
  return f && !f.includes('@') ? f : null;
};
const lastSeen = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-ZA', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }) : null;

function memberEmail(m: Row) {
  const first = firstName(m.name);
  const seen = lastSeen(m.last_login);
  return {
    subject: first ? `${first}, we haven't seen you in a few days` : "We haven't seen you in a few days",
    html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:${C.ink};line-height:1.6;padding:26px;">
      <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.green};">Hacking Hub · Focus 5</p>
      <h2 style="font-size:22px;line-height:1.25;color:${C.navy};margin:6px 0 14px;">We miss you in the portal</h2>
      <p style="margin:0 0 12px;font-size:15px;">Hi ${esc(first || 'there')},</p>
      <p style="margin:0 0 12px;font-size:15px;">${seen ? `You last signed in on ${esc(seen)}, and` : 'I noticed'} you haven't been in the portal for a few days. You're one of this month's Focus 5, so I'm keeping a close eye on your progress and I want to keep your momentum going.</p>
      <p style="margin:0 0 12px;font-size:15px;">Sign in today, pick up the next step on your roadmap and post your daily update. Even 30 minutes counts.</p>
      <p style="margin:0 0 18px;font-size:15px;">If something is getting in the way, just reply to this email and tell me. We'll work it out together.</p>
      <p style="margin:0 0 22px;"><a href="${PORTAL_URL}" style="display:inline-block;background:${C.green};color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Open the portal</a></p>
      <p style="margin:0;font-size:15px;">Siya<br>Hacking Hub</p>
    </div>`,
  };
}

function founderEmail(sent: Row[], failed: Row[]) {
  const row = (m: Row, note: string) => `<tr>
      <td style="padding:8px 6px;border-bottom:1px solid ${C.line};font-size:14px;">${esc(m.name)}<div style="font-size:12px;color:${C.ink3};">${esc(m.email)}</div></td>
      <td style="padding:8px 6px;border-bottom:1px solid ${C.line};font-size:13px;">${m.last_login ? esc(lastSeen(m.last_login)) : 'Never signed in'}</td>
      <td style="padding:8px 6px;border-bottom:1px solid ${C.line};font-size:13px;white-space:nowrap;">${esc(note)}</td>
    </tr>`;
  const n = sent.length + failed.length;
  return {
    subject: `Focus 5: ${n} member${n === 1 ? '' : 's'} not signed in for 3+ days`,
    html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:${C.ink};line-height:1.5;padding:26px;">
      <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.ink3};">Focus 5</p>
      <h1 style="font-size:21px;line-height:1.25;margin:6px 0 8px;color:${C.navy};">${n} Focus 5 member${n === 1 ? ' has' : 's have'}n't signed in for 3+ days</h1>
      <p style="margin:0 0 16px;font-size:14px;">${sent.length ? 'Each was sent a friendly reminder to sign back in this morning. A personal message from you may help too.' : ''}${failed.length ? ` ${failed.length} reminder${failed.length === 1 ? '' : 's'} could not be sent and will be retried tomorrow.` : ''}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;color:${C.ink};">
        <tr><th style="text-align:left;font-size:11px;color:${C.ink3};text-transform:uppercase;padding:7px 6px;border-bottom:1px solid ${C.line};">Member</th><th style="text-align:left;font-size:11px;color:${C.ink3};text-transform:uppercase;padding:7px 6px;border-bottom:1px solid ${C.line};">Last signed in</th><th style="text-align:left;font-size:11px;color:${C.ink3};text-transform:uppercase;padding:7px 6px;border-bottom:1px solid ${C.line};">Reminder</th></tr>
        ${sent.map((m) => row(m, 'Sent')).join('')}${failed.map((m) => row(m, 'Failed')).join('')}
      </table>
      <p style="font-size:12px;color:${C.ink3};margin-top:20px;border-top:1px solid ${C.line};padding-top:12px;">Sent automatically at 08:00. Each member is reminded once per absence; they can be reminded again only after they sign in and go quiet again. Sent to ${FOUNDER} only.</p>
    </div>`,
  };
}

async function send(resendKey: string, to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], reply_to: FOUNDER, subject, html }),
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
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (!resendKey || !supabaseUrl || !serviceRoleKey) return json({ error: 'Not configured.' }, 500);

  try {
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* the cron sends no body */ }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.rpc('focus_five_absent_due');
    if (error) throw new Error(`focus_five_absent_due failed: ${error.message}`);
    const due: Row[] = data || [];

    if (body.dryRun) return json({ dryRun: true, due });
    if (!due.length) return json({ sent: 0 });

    const sent: Row[] = [];
    const failed: Row[] = [];
    for (const m of due) {
      try {
        const mail = memberEmail(m);
        await send(resendKey, m.email, mail.subject, mail.html);
        const { error: markErr } = await admin.rpc('focus_five_mark_nudged', { p_email: m.email, p_last_login: m.last_login });
        if (markErr) console.error(`focus-five-absence-email: ${m.email} emailed but not marked:`, markErr.message);
        sent.push(m);
      } catch (err) {
        console.error(`focus-five-absence-email: ${m.email} failed:`, err);
        failed.push(m);
      }
    }

    const summary = founderEmail(sent, failed);
    await send(resendKey, FOUNDER, summary.subject, summary.html);
    return json({ sent: sent.length, failed: failed.length });
  } catch (err) {
    console.error('focus-five-absence-email error:', err);
    return json({ error: 'The Focus 5 reminder failed.' }, 500);
  }
});
