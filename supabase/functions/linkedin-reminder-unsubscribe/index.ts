// Hacking Hub Admin Dashboard - LinkedIn Post Reminder Unsubscribe
//
// Deploy with: supabase functions deploy linkedin-reminder-unsubscribe --no-verify-jwt
// (--no-verify-jwt is required - this is a plain link clicked from an email
// client with no Supabase session at all, so the platform's default JWT
// check would reject every real click before this code ever runs. Same
// reason roadmap-reminder-unsubscribe and payfast-webhook need the flag.)
//
// The unsubscribe link linkedin-post-reminder-email puts at the bottom of
// every reminder it sends. GET so a browser click just works with no
// form/JS needed on the receiving end. Byte-for-byte the same shape as
// roadmap-reminder-unsubscribe/index.ts, just calling the LinkedIn-specific
// unsubscribe RPC instead - own, separate opt-out per email type, not a
// shared mechanism (see 059_linkedin_weekly_post.sql's own comment on this).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function htmlResponse(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Hacking Hub</title></head><body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #12141f;">${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return htmlResponse('<p>Missing email.</p>', 400);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await adminClient.rpc('unsubscribe_from_linkedin_reminders', { p_email: email });
    if (error) {
      console.error('linkedin-reminder-unsubscribe: rpc failed', error.message);
      return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
    }

    return htmlResponse(
      `<h2>You're unsubscribed.</h2><p>You won't get LinkedIn posting reminder emails anymore. You can still post any time - check your roadmap in the portal for this week's prompt.</p>`
    );
  } catch (err) {
    console.error('linkedin-reminder-unsubscribe error:', err);
    return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
  }
});
