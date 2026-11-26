// Hacking Hub Admin Dashboard - Cert Fail Encouragement Email
//
// Deploy with: supabase functions deploy cert-fail-email --no-verify-jwt
// (the cron sends no JWT; staff calls are still checked with get_my_role)
// Requires RESEND_API_KEY and CRON_SECRET, both shared with the other email
// functions. (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected.)
//
// A short, fixed message from Siya to a member who didn't pass an exam:
// acknowledge it, a reminder that failing a cert is normal, three concrete
// next steps (note the hard topics, book a 1-on-1, set a new date), and a
// link back to the portal. Until 2026-11-26 Gemma wrote the body fresh each
// time with Gemini; it is now the same message every time.
//
// Two ways in, same as cert-pass-email:
// - Staff marking an entry Failed on the admin side (AdminDashboard.jsx)
//   calls it with { certId } and their JWT, checked with get_my_role().
// - The cert-fail-email-15min cron (024_cert_calendar.sql) calls it with the
//   x-cron-secret header and no certId. It emails every entry whose
//   failed_at (set by a trigger the moment result becomes Failed, by anyone,
//   members included) is in the last 7 days. Entries failed before
//   failed_at existed have none, so no old fails are emailed.
// fail_email_sent_at is set on send, so each entry gets it once whichever
// way it went out.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// The admin site calls this straight from the browser, so it has to answer
// the CORS preflight and send these headers on every reply (same as
// welcome-email), or the browser drops the call before it arrives.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

const FROM_ADDRESS = 'Siya from Hacking Hub <siya@hackinghub.co.za>';
const PORTAL_URL = 'https://portal.hackinghub.co.za';
const CRON_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

const C = { navy: '#17183c', ink: '#1b1d3a', green: '#17a856' };

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function certFailEmail(memberName: string | null, certName: string): { subject: string; html: string } {
  const first = (memberName || '').trim().split(/\s+/)[0] || '';
  const cert = esc(certName);
  const p = (html: string) => `<p style="margin:0 0 12px;font-size:15px;">${html}</p>`;
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:${C.ink};line-height:1.6;padding:26px;">
    ${p(first ? `Hi ${esc(first)},` : 'Hi there,')}
    ${p(`I saw that ${cert} didn’t go your way this time. I know that stings, especially after all the hours you put in. Take a day if you need it.`)}
    ${p('Failing an exam doesn’t mean you’re not cut out for cyber. Plenty of people in this field, including members of this community, failed a cert before they passed it. What matters is what you do next.')}
    ${p('Your score report is now the best study guide you have. It shows exactly where to focus. This week:')}
    <ol style="margin:0 0 12px;padding-left:22px;font-size:15px;">
      <li style="margin-bottom:6px;">Write down the topics that felt hardest, while they’re still fresh.</li>
      <li style="margin-bottom:6px;">Book a 1-on-1 with a mentor to plan your retake.</li>
      <li style="margin-bottom:6px;">Pick a new exam date and add it to the Cert Calendar, so you have something to aim for.</li>
    </ol>
    ${p('You’ve already done one of the hardest parts: you sat the exam. Now you know what it looks like, and next time you’ll walk in ready.')}
    ${p('We’re behind you.')}
    <p style="margin:0 0 22px;font-size:15px;">Siya<br>Founder, Hacking Hub</p>
    <p style="margin:0;"><a href="${PORTAL_URL}" style="display:inline-block;background:${C.green};color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Back to your portal</a></p>
  </div>`;
  return {
    subject: first ? `${certName} didn’t go your way this time, ${first}` : `${certName} didn’t go your way this time`,
    html,
  };
}

async function sendEmail(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: toEmail, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend request failed: ${res.status} ${await res.text()}`);
}

// deno-lint-ignore no-explicit-any
async function sendFor(admin: any, resendKey: string, cert: { id: number; member: string | null; cert_name: string; member_email: string }) {
  const mail = certFailEmail(cert.member, cert.cert_name);
  await sendEmail(resendKey, cert.member_email, mail.subject, mail.html);
  const { error } = await admin.from('cert_calendar').update({ fail_email_sent_at: new Date().toISOString() }).eq('id', cert.id);
  // The email already went out; a failed stamp risks a duplicate on the next
  // cron run, but isn't worth failing the request over.
  if (error) console.error(`cert-fail-email: marking cert ${cert.id} sent failed`, error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return respond({ error: 'Not configured - missing RESEND_API_KEY secret.' }, 500);
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) {
      const { data: due, error: dueError } = await admin
        .from('cert_calendar')
        .select('id, member, cert_name, member_email')
        .eq('result', 'Failed')
        .is('fail_email_sent_at', null)
        .not('member_email', 'is', null)
        .gte('failed_at', new Date(Date.now() - CRON_LOOKBACK_MS).toISOString());
      if (dueError) throw new Error(`loading due fails failed: ${dueError.message}`);
      let sent = 0;
      const failed: number[] = [];
      for (const cert of due || []) {
        try {
          await sendFor(admin, resendKey, cert);
          sent++;
        } catch (err) {
          console.error(`cert-fail-email: cron send for cert ${cert.id} failed`, err);
          failed.push(cert.id);
        }
      }
      return respond({ sent, failed });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    if (authError || !userData?.user?.email) return respond({ error: 'Admins only.' }, 403);
    const { data: callerRole, error: roleError } = await callerClient.rpc('get_my_role');
    if (roleError || !['admin', 'community_manager', 'mentor'].includes(callerRole)) {
      return respond({ error: 'Admins only.' }, 403);
    }

    const { certId } = await req.json();
    if (!certId) return respond({ error: 'Missing certId.' }, 400);

    const { data: cert, error: certError } = await admin
      .from('cert_calendar')
      .select('id, member, cert_name, result, member_email, fail_email_sent_at')
      .eq('id', certId)
      .maybeSingle();
    if (certError) {
      console.error('cert-fail-email: fetching cert failed', certError.message);
      return respond({ error: 'Could not load that cert entry.' }, 500);
    }
    if (!cert) return respond({ error: 'Cert entry not found.' }, 404);
    // Not errors - a stale client call, a re-click, or an entry with no
    // email on file are all expected no-ops.
    if (cert.result !== 'Failed') return respond({ skipped: true, reason: 'not marked Failed' });
    if (!cert.member_email) return respond({ skipped: true, reason: 'no member email on file' });
    if (cert.fail_email_sent_at) return respond({ skipped: true, reason: 'already sent' });

    await sendFor(admin, resendKey, cert);
    return respond({ sent: true });
  } catch (err) {
    console.error('cert-fail-email error:', err);
    return respond({ error: 'Something went wrong.' }, 500);
  }
});
