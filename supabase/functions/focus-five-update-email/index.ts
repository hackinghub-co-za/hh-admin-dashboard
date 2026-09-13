// Hacking Hub Admin Dashboard - Focus 5 Daily Update Email
//
// Deploy with: supabase functions deploy focus-five-update-email
// Requires this secret set first (shared with every other Resend-based
// function, no new one needed):
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically.)
//
// Called directly from the signed-in member's own browser session right
// after submit_focus_five_daily_update() succeeds (078_focus_five_daily_
// updates.sql) - a real caller JWT exists, so this trusts the caller's own
// email from that JWT (never a client-supplied email) to look up which
// row to send, the same "read the real DB row, don't trust the request
// body" shape as cert-pass-email. No admin/role check needed - any member
// can trigger this for their OWN today's row; the RPC that created that
// row already enforced they're actually on the Focus 5 list.
//
// Always sends to the founder's inbox (siya@hackinghub.co.za), never the
// member - this is a notification ABOUT a Focus 5 member, not a reply TO
// one. notified_at is a simple retry/re-click guard, not a backlog scan -
// deliberately scoped to the caller's own today's row only, same reasoning
// cert-pass-email gives for being scoped to one certId rather than
// scanning for every unnotified row ever.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>';
const RECIPIENT = 'siya@hackinghub.co.za';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendEmail(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: toEmail, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend request failed: ${res.status} ${await res.text()}`);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateEmailHtml(name: string, email: string, updateText: string, updateDate: string): string {
  const when = new Date(`${updateDate}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <p>Focus 5 daily update from <strong>${esc(name)}</strong> (${esc(email)}) - ${when}:</p>
    <blockquote style="margin:14px 0;padding:10px 16px;border-left:3px solid #17954f;color:#333;white-space:pre-wrap;">${esc(updateText)}</blockquote>
    <p>&mdash; Gemma</p>
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

    const { data: row, error: rowError } = await adminClient
      .from('focus_five_daily_updates')
      .select('id, member_email, update_date, update_text, notified_at')
      .eq('member_email', callerEmail)
      .eq('update_date', new Date().toISOString().slice(0, 10))
      .maybeSingle();

    if (rowError) {
      console.error('focus-five-update-email: fetching update failed', rowError.message);
      return new Response(JSON.stringify({ error: 'Could not load your update.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!row) {
      return new Response(JSON.stringify({ error: 'No update found for today.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (row.notified_at) {
      return new Response(JSON.stringify({ skipped: true, reason: 'already sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await adminClient
      .from('member_profiles')
      .select('full_name')
      .eq('email', callerEmail)
      .maybeSingle();
    const name = profile?.full_name || callerEmail;

    await sendEmail(
      resendKey,
      RECIPIENT,
      `Focus 5 update: ${name}`,
      updateEmailHtml(name, callerEmail, row.update_text, row.update_date)
    );

    const { error: markError } = await adminClient
      .from('focus_five_daily_updates')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', row.id);
    if (markError) {
      console.error(`focus-five-update-email: marking row ${row.id} notified failed`, markError.message);
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('focus-five-update-email error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
