// Hacking Hub Admin Dashboard - "How the community celebrated your
// achievement" email, for the founder to forward
//
// Deploy with: supabase functions deploy win-comments-email --no-verify-jwt
// Uses the secrets already set for the other email functions (RESEND_API_KEY,
// CRON_SECRET) - no new ones needed.
//
// Triggered by pg_cron every day at 18:00 SAST (044_community_content.sql),
// which sends the x-cron-secret header. Each run emails the founder one email
// per Recent Win that has new comments since its last email
// (win_comments_email_due()), listing every comment so far. The email is
// written to the member, with a short note for the founder at the top, so it
// can be forwarded as it is. It never goes to the member directly. A win is
// marked as emailed (mark_win_comments_emailed()) only after its email has
// gone out, so a failed send is retried the next day. A body of
// { "dryRun": true } returns what would be sent and changes nothing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Hacking Hub <siya@hackinghub.co.za>';
const TO_ADDRESS = 'siya@hackinghub.co.za';
const PORTAL_URL = 'https://portal.hackinghub.co.za';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const C = { navy: '#17183c', ink: '#1b1d3a', ink2: '#454a6b', ink3: '#6b7096', line: '#e3e5f1', green: '#17a856', soft: '#f4f6fb' };

function buildEmail(win: Row) {
  const comments: Row[] = win.comments || [];
  const newCount = comments.filter((c) => Number(c.id) > Number(win.emailed_upto || 0)).length;
  const firstName = String(win.member_name || '').trim().split(/\s+/)[0] || 'there';
  const quotes = comments.map((c) => `
    <tr><td style="padding:0 0 12px;">
      <div style="background:${C.soft};border-left:4px solid ${C.green};border-radius:8px;padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:${C.ink};">“${esc(c.body)}”</p>
        <p style="margin:0;font-size:13px;font-weight:700;color:${C.ink2};">${esc(c.author_name)}</p>
      </div>
    </td></tr>`).join('');

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:${C.ink};line-height:1.55;padding:26px;">
    <div style="border:1px dashed ${C.ink3};border-radius:8px;padding:12px 14px;margin-bottom:24px;font-size:13px;color:${C.ink2};">
      <strong>Note for Siya (delete before forwarding):</strong> forward this to
      ${win.member_email ? `<a href="mailto:${esc(win.member_email)}" style="color:${C.green};">${esc(win.member_email)}</a>` : 'the member (no email on file for this win)'}.
      ${plural(comments.length, 'comment')} so far, ${newCount} new since the last email.
    </div>

    <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.green};">Hacking Hub</p>
    <h1 style="font-size:24px;line-height:1.25;margin:6px 0 16px;color:${C.navy};">How the community celebrated your achievement</h1>
    <p style="margin:0 0 12px;font-size:15px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 20px;font-size:15px;">Congratulations again: you ${esc(win.achievement)}! We shared your win with the Hacking Hub community, and this is what they said.</p>

    <h2 style="font-size:16px;margin:0 0 12px;color:${C.navy};">What the community said</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${quotes}</table>

    <p style="margin:12px 0 4px;font-size:15px;">Everyone here is proud of you. Keep going.</p>
    <p style="margin:0 0 22px;font-size:15px;">Siya<br>Hacking Hub</p>
    <p style="margin:0;"><a href="${PORTAL_URL}" style="display:inline-block;background:${C.navy};color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">See your win in the portal</a></p>
  </div>`;

  return {
    subject: `How the community celebrated your achievement: ${win.member_name} ${win.achievement}`,
    html,
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
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (!resendKey || !supabaseUrl || !serviceRoleKey) return json({ error: 'Not configured.' }, 500);

  try {
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* the cron sends no body */ }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.rpc('win_comments_email_due');
    if (error) throw new Error(`win_comments_email_due failed: ${error.message}`);
    const due: Row[] = data || [];

    if (body.dryRun) return json({ dryRun: true, wins: due.map((w) => ({ win_id: w.win_id, member: w.member_name, comments: (w.comments || []).length })) });

    let sent = 0;
    const failed: number[] = [];
    for (const win of due) {
      try {
        const mail = buildEmail(win);
        await sendEmail(resendKey, mail.subject, mail.html);
        const upto = Math.max(...(win.comments || []).map((c: Row) => Number(c.id)));
        const { error: markErr } = await admin.rpc('mark_win_comments_emailed', { p_win_id: win.win_id, p_upto: upto });
        if (markErr) throw new Error(markErr.message);
        sent++;
      } catch (err) {
        console.error(`win-comments-email: win ${win.win_id} failed:`, err);
        failed.push(win.win_id);
      }
    }
    return json({ sent, failed });
  } catch (err) {
    console.error('win-comments-email error:', err);
    return json({ error: 'The win comments email failed.' }, 500);
  }
});
