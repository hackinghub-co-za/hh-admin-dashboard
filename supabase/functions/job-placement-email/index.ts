// Hacking Hub Admin Dashboard - "Congratulations on your new role" email
//
// Deploy with: supabase functions deploy job-placement-email --no-verify-jwt
// Requires RESEND_API_KEY and CRON_SECRET, both shared with the other email
// functions. (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected.)
//
// A message from Siya to a member who just landed a role: congratulations,
// five tips for their first 90 days, and a nudge to keep going (share the
// win, keep learning, pay it forward). Sent by the job-placement-email-15min
// cron (118_job_placement_email.sql) to every member whose job_placed_at (set
// by a trigger the moment job_readiness becomes 'Job Placed', however it's
// changed) is in the last 14 days and who hasn't had it yet
// (placement_email_sent_at). Members marked Job Placed before this existed
// have no job_placed_at, so nobody is emailed retroactively.
// A body of { "dryRun": true } lists who would be emailed and sends nothing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Siya from Hacking Hub <siya@hackinghub.co.za>';
const PORTAL_URL = 'https://portal.hackinghub.co.za';
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

const C = { navy: '#17183c', ink: '#1b1d3a', ink3: '#6b7096', line: '#e3e5f1', soft: '#f4f6fb', green: '#17a856' };

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TIPS: [string, string][] = [
  ['Be a sponge first.', 'Ask questions, take notes and learn how the team works before you try to change anything. Nobody expects you to know it all in month one.'],
  ['Find out what good looks like.', 'Ask your manager how your work will be measured, and check in with them every few weeks so there are no surprises.'],
  ['Keep a wins log.', 'Write down every incident you handled, process you improved and thing you learned. It makes reviews, promotions and your next CV easy.'],
  ['Build relationships outside your team.', 'In cyber, the person in IT ops or on the dev team is often the one who helps you solve the problem. Get to know them early.'],
  ['Keep learning, at your own pace.', 'Your job is your best lab now. Settle in first, then pick your next cert based on what you see at work.'],
];

export function placementEmail(fullName: string | null): { subject: string; html: string } {
  const first = (fullName || '').trim().split(/\s+/)[0] || '';
  const p = (html: string) => `<p style="margin:0 0 12px;font-size:15px;">${html}</p>`;
  const h3 = (t: string) => `<h3 style="font-size:16px;color:${C.navy};margin:24px 0 10px;">${t}</h3>`;
  const tips = TIPS.map(([lead, rest]) => `<li style="margin-bottom:10px;"><strong>${lead}</strong> ${rest}</li>`).join('');
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:${C.ink};line-height:1.6;padding:26px;">
    <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.green};">Hacking Hub · You did it</p>
    <h2 style="font-size:24px;line-height:1.25;color:${C.navy};margin:6px 0 16px;">Congratulations on your new role${first ? `, ${esc(first)}` : ''}!</h2>
    ${p(first ? `Hi ${esc(first)},` : 'Hi there,')}
    ${p('This is huge. You put in the hours, the labs, the applications and the interviews, and it paid off. Plenty of people talk about breaking into cyber. You actually did it, and the whole Hacking Hub team is proud of you.')}
    ${p('Take a moment to celebrate. Then here’s how to make a strong start.')}
    ${h3('Your first 90 days')}
    <ol style="margin:0 0 4px;padding-left:22px;font-size:15px;">${tips}</ol>
    ${h3('Keep going')}
    ${p('Landing the role is the start of the next chapter, not the finish line. The habits that got you here, showing up, staying curious and asking for help, are the same ones that will get you promoted.')}
    <div style="background:${C.soft};border:1px solid ${C.line};border-radius:10px;padding:14px 16px;margin:4px 0 16px;">
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${C.navy};">Three things you can do this week</p>
      <ul style="margin:0;padding-left:20px;font-size:15px;">
        <li style="margin-bottom:6px;"><strong>Share your win</strong> on LinkedIn and tag Hacking Hub. Your story shows someone else that it’s possible.</li>
        <li style="margin-bottom:6px;"><strong>Post it in the portal</strong> so the community can celebrate with you.</li>
        <li style="margin-bottom:6px;"><strong>Pay it forward.</strong> Answer a question in the group, or tell a newer member what helped you most.</li>
      </ul>
    </div>
    ${p('You’re still part of Hacking Hub, and I’m always a message away if you need advice as you settle in. Just reply to this email.')}
    <p style="margin:0 0 22px;font-size:15px;">So proud of you.<br>Siya<br>Founder, Hacking Hub</p>
    <p style="margin:0;"><a href="${PORTAL_URL}" style="display:inline-block;background:${C.green};color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Share your win in the portal</a></p>
  </div>`;
  return {
    subject: first ? `Congratulations on your new role, ${first}!` : 'Congratulations on your new role!',
    html,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'Unauthorized' }, 401);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!resendKey || !supabaseUrl || !serviceRoleKey) return json({ error: 'Not configured.' }, 500);

  try {
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* the cron may send no body */ }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: due, error } = await admin
      .from('member_profiles')
      .select('email, full_name')
      .eq('job_readiness', 'Job Placed')
      .is('placement_email_sent_at', null)
      .gte('job_placed_at', new Date(Date.now() - LOOKBACK_MS).toISOString())
      .neq('status', 'Left');
    if (error) throw new Error(`loading placements failed: ${error.message}`);

    if (body.dryRun) return json({ dryRun: true, would_email: (due || []).map((m) => m.email) });

    let sent = 0;
    const failed: string[] = [];
    for (const m of due || []) {
      try {
        const mail = placementEmail(m.full_name);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM_ADDRESS, to: [m.email], subject: mail.subject, html: mail.html }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
        const { error: markErr } = await admin.from('member_profiles').update({ placement_email_sent_at: new Date().toISOString() }).eq('email', m.email);
        if (markErr) console.error(`job-placement-email: marking ${m.email} sent failed`, markErr.message);
        sent++;
      } catch (err) {
        console.error(`job-placement-email: ${m.email} failed`, err);
        failed.push(m.email);
      }
    }
    return json({ sent, failed });
  } catch (err) {
    console.error('job-placement-email error:', err);
    return json({ error: 'The placement email failed.' }, 500);
  }
});
