// Hacking Hub Admin Dashboard - Welcome Email (staff-triggered)
//
// Deploy with: supabase functions deploy welcome-email
// Requires: supabase secrets set RESEND_API_KEY=<your Resend API key>
// (shared with every other Resend-based function).
//
// Called from the admin dashboard when a member is added by hand (an EFT
// payment or a manual add) and by the "Resend welcome email" button. The
// PayFast hook sends the same email itself via _shared/welcomeEmail.ts.
// Body: { email: string, force?: boolean }. Without `force`, a member who has
// already been sent the email is skipped (so a renewal never emails twice).
//
// Caller must be an admin or community manager, verified with get_my_role()
// the same way cert-pass-email does it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendWelcomeEmail } from '../_shared/welcomeEmail.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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
      return respond({ error: 'Not configured - missing RESEND_API_KEY secret.' }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    if (authError || !userData?.user?.email) {
      return respond({ error: 'Admins only.' }, 403);
    }
    const { data: callerRole, error: roleError } = await callerClient.rpc('get_my_role');
    if (roleError || !['admin', 'community_manager'].includes(callerRole)) {
      return respond({ error: 'Admins only.' }, 403);
    }

    const { email, force } = await req.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return respond({ error: 'Missing email.' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const result = await sendWelcomeEmail(adminClient, resendKey, email, { force: force === true });
    return respond(result.sent ? { sent: true } : { skipped: true, reason: result.reason });
  } catch (err) {
    console.error('welcome-email error:', err);
    return respond({ error: 'Could not send the welcome email.' }, 500);
  }
});
