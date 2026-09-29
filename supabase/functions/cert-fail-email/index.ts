// Hacking Hub Admin Dashboard - Cert Fail Encouragement Email
//
// Deploy with: supabase functions deploy cert-fail-email
// Requires these secrets set first (both already exist for other
// functions - no new ones needed):
//   supabase secrets set GEMINI_API_KEY=<same key gemma-chat already uses>
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Called directly by an admin/staff session (AdminDashboard.jsx's
// handleUpdateCertResult/handleSaveCertEdit, right when a Cert Calendar
// entry is marked Failed) - same auth pattern as cert-pass-email
// (get_my_role() via the caller's real JWT), since a real caller session
// exists here too.
//
// Unlike cert-pass-email, this doesn't mark anything "sent" on the
// cert_calendar row - the founder wants a failed attempt removed from the
// calendar entirely once this fires (deleteCertCalendarEntry, called by the
// client right after this succeeds), so there's no row left to guard a
// re-send against and no reason to add a column just to track it.
//
// Gemma writes every word of the email body (same Gemini prompt pattern
// roadmap-reminder-email/gemma-chat use) - genuinely encouraging, never
// generic, and never implies the attempt was wasted.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_MODEL = 'gemini-3.6-flash'; // same pin as every other Gemma function - see gemma-chat's own comment for why this exact version
const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const PORTAL_URL = 'https://portal.hackinghub.co.za';

function buildPrompt(firstName: string, certName: string): string {
  return `You are Gemma, a friendly, sharp AI assistant embedded in the Hacking Hub member portal - a cybersecurity coaching community. Your voice is warm, a little playful, never corporate.

Write a short, genuinely encouraging email body to a member named ${firstName} who just found out they did not pass their ${certName} exam.

Hard rules:
- Encouraging and warm, never dismissive of how much this sucks to hear - acknowledge it briefly, then move forward.
- Never implies the attempt or the studying was wasted - failing an exam is a normal, common part of the process, not a setback that erases progress.
- End with one concrete, low-pressure next step (e.g. rebooking the exam once they're ready, or reviewing the weak areas from the exam report) - don't be pushy about timing.
- Plain text, 3-4 sentences. No subject line, no "Hi ${firstName}," greeting, no sign-off - all three are added separately by the template.
- Write in Gemma's own voice, not a generic corporate consolation email.`;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return text.trim();
}

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

function certFailEmailHtml(firstName: string, body: string): string {
  return `
    <p>Hi ${firstName},</p>
    <p>${body.replace(/\n/g, '<br>')}</p>
    <p>— Gemma</p>
    <p style="margin:22px 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Back to your portal</a>
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
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!geminiKey || !resendKey) {
      return new Response(JSON.stringify({ error: 'Not configured - missing GEMINI_API_KEY or RESEND_API_KEY secret.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    const callerEmail = (userData?.user?.email || '').toLowerCase();
    if (authError || !callerEmail) {
      return new Response(JSON.stringify({ error: 'Admins only.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { data: callerRole, error: roleError } = await callerClient.rpc('get_my_role');
    if (roleError || !['admin', 'community_manager', 'mentor'].includes(callerRole)) {
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
      .select('id, member, cert_name, result, member_email')
      .eq('id', certId)
      .maybeSingle();

    if (certError) {
      console.error('cert-fail-email: fetching cert failed', certError.message);
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
    // Not an error - a stale client call (result changed again since this
    // was queued) is a real, expected no-op.
    if (cert.result !== 'Failed') {
      return new Response(JSON.stringify({ skipped: true, reason: 'not marked Failed' }), {
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

    const firstName = (cert.member || '').trim().split(' ')[0] || 'there';
    const body = await callGemini(geminiKey, buildPrompt(firstName, cert.cert_name));

    await sendEmail(
      resendKey,
      cert.member_email,
      `About your ${cert.cert_name} attempt`,
      certFailEmailHtml(firstName, body)
    );

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('cert-fail-email error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
