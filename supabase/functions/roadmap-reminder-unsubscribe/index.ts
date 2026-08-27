// Hacking Hub Admin Dashboard - Roadmap Reminder Unsubscribe
//
// Deploy with: supabase functions deploy roadmap-reminder-unsubscribe --no-verify-jwt
// (--no-verify-jwt is required - this is a plain link clicked from an email
// client with no Supabase session at all, so the platform's default JWT
// check would reject every real click before this code ever runs. Same
// reason payfast-webhook needs the flag.)
//
// The unsubscribe link roadmap-reminder-email puts at the bottom of every
// reminder it sends. GET so a browser click just works with no form/JS
// needed on the receiving end.

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

    const { error } = await adminClient.rpc('unsubscribe_from_roadmap_reminders', { p_email: email });
    if (error) {
      console.error('roadmap-reminder-unsubscribe: rpc failed', error.message);
      return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
    }

    return htmlResponse(
      `<h2>You're unsubscribed.</h2><p>You won't get roadmap reminder emails anymore. You can still check your roadmap anytime in the portal.</p>`
    );
  } catch (err) {
    console.error('roadmap-reminder-unsubscribe error:', err);
    return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
  }
});
