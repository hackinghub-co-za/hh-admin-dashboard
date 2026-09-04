// Hacking Hub Admin Dashboard - Cert Pass Congratulations Email
//
// Deploy with: supabase functions deploy cert-pass-email
// Requires this secret set first (shared with every other Resend-based
// function, no separate key needed):
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Same shape as matchmaker-group-email: called directly by an admin session
// (AdminDashboard.jsx's announceCertWin, right after a Cert Calendar entry
// is marked Passed - same trigger that already auto-posts a Recent Win) - a
// real caller JWT exists, so this verifies the caller is an admin the same
// simple way App.jsx does client-side (an @hackinghub.co.za email), rather
// than needing --no-verify-jwt + a shared secret.
//
// Deliberately scoped to ONE specific cert_calendar row (certId), not a
// scan-based "every Passed row not yet notified" query the way
// matchmaker-group-email scans matchmaker_groups - that would retroactively
// email every cert ever marked Passed before this feature existed the first
// time this runs. pass_email_sent_at (024_cert_calendar.sql) is purely a
// re-click/retry guard for that one row, never a backlog to work through.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const PORTAL_URL = 'https://portal.hackinghub.co.za';

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

function certPassEmailHtml(firstName: string, certName: string): string {
  return `
    <p>Hi ${firstName},</p>
    <p>Huge congratulations - you passed <strong>${certName}</strong>! 🎉</p>
    <p>It's already up on the Dashboard as a Recent Win for the whole community to see.</p>
    <p>Worth a LinkedIn post too, while it's fresh - a real cert pass is exactly the kind of proof-of-work that gets you noticed (see the LinkedIn Playbook in Resources for ideas on what to write).</p>
    <p>— Gemma</p>
    <p style="margin:22px 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;">See It On Your Dashboard</a>
    </p>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
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
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    const callerEmail = (userData?.user?.email || '').toLowerCase();
    if (authError || !callerEmail || !callerEmail.endsWith('@hackinghub.co.za')) {
      return new Response(JSON.stringify({ error: 'Admins only.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { certId } = await req.json();
    if (!certId) {
      return new Response(JSON.stringify({ error: 'Missing certId.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: cert, error: certError } = await adminClient
      .from('cert_calendar')
      .select('id, member, cert_name, result, member_email, pass_email_sent_at')
      .eq('id', certId)
      .maybeSingle();

    if (certError) {
      console.error('cert-pass-email: fetching cert failed', certError.message);
      return new Response(JSON.stringify({ error: 'Could not load that cert entry.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!cert) {
      return new Response(JSON.stringify({ error: 'Cert entry not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Not an error - just nothing to do. A stale client call (result
    // changed again since), a re-click, or an entry with no member_email on
    // file (older entries, or a name-only submission) are all real,
    // expected no-ops.
    if (cert.result !== 'Passed') {
      return new Response(JSON.stringify({ skipped: true, reason: 'not marked Passed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!cert.member_email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no member email on file' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (cert.pass_email_sent_at) {
      return new Response(JSON.stringify({ skipped: true, reason: 'already sent' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const firstName = (cert.member || '').trim().split(' ')[0] || 'there';

    await sendEmail(
      resendKey,
      cert.member_email,
      `🎉 You passed ${cert.cert_name}!`,
      certPassEmailHtml(firstName, cert.cert_name)
    );

    const { error: markError } = await adminClient
      .from('cert_calendar')
      .update({ pass_email_sent_at: new Date().toISOString() })
      .eq('id', certId);
    if (markError) {
      // The email already went out - not marking it sent risks a duplicate
      // on a retry, but it's not worth failing the whole request over a
      // logging write.
      console.error(`cert-pass-email: marking cert ${certId} notified failed`, markError.message);
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('cert-pass-email error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
