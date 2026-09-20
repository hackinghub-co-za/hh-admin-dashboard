// Hacking Hub Admin Dashboard - Weekly Breakdown Unsubscribe
//
// Deploy with: supabase functions deploy breakdown-unsubscribe --no-verify-jwt
// (--no-verify-jwt is required - a plain link clicked from an email client
// with no Supabase session. Same reason as roadmap-reminder-unsubscribe.)
// Requires the same secret as weekly-breakdown-email's link-signing:
//   supabase secrets set UNSUBSCRIBE_TOKEN_SECRET=<a long random string you make up>
//
// The link weekly-breakdown-email puts at the bottom of every send. GET so
// a browser click just works, no form or JS needed. The token param is
// required - profiles.email is publicly readable, so a bare ?email= with no
// proof of authorship would let anyone unsubscribe anyone else. See
// unsubscribeToken.ts for why.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyUnsubscribeToken } from '../_shared/unsubscribeToken.ts';

function htmlResponse(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Hacking Hub</title></head><body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #12141f;">${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  if (!email) {
    return htmlResponse('<p>Missing email.</p>', 400);
  }

  try {
    const tokenSecret = Deno.env.get('UNSUBSCRIBE_TOKEN_SECRET');
    if (!tokenSecret) {
      console.error('breakdown-unsubscribe: missing UNSUBSCRIBE_TOKEN_SECRET secret');
      return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
    }
    if (!(await verifyUnsubscribeToken(email, token || '', tokenSecret))) {
      return htmlResponse('<p>That unsubscribe link isn\'t valid. Use the link from the most recent email instead.</p>', 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await adminClient.rpc('unsubscribe_from_breakdown_emails', { p_email: email });
    if (error) {
      console.error('breakdown-unsubscribe: rpc failed', error.message);
      return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
    }

    return htmlResponse(
      `<h2>You're unsubscribed.</h2><p>You won't get the weekly incident breakdown by email anymore. Every edition is still on the <strong>Breakdowns</strong> tab in the portal.</p>`
    );
  } catch (err) {
    console.error('breakdown-unsubscribe error:', err);
    return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
  }
});
