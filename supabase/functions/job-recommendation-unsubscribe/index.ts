// Hacking Hub Admin Dashboard - Job Recommendation Email Unsubscribe
//
// Deploy with: supabase functions deploy job-recommendation-unsubscribe --no-verify-jwt
// (--no-verify-jwt is required - a plain link clicked from an email client
// with no Supabase session. Same reason as breakdown-unsubscribe.)
//
// The link job-recommendation-email puts at the bottom of every send. GET
// so a browser click just works, no form or JS needed.

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

    const { error } = await adminClient.rpc('unsubscribe_from_job_recommendations', { p_email: email });
    if (error) {
      console.error('job-recommendation-unsubscribe: rpc failed', error.message);
      return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
    }

    return htmlResponse(
      `<h2>You're unsubscribed.</h2><p>You won't get job match emails anymore. Track-matched listings still show up with a "Matches your track" badge on the <strong>Job Board</strong> tab in the portal.</p>`
    );
  } catch (err) {
    console.error('job-recommendation-unsubscribe error:', err);
    return htmlResponse('<p>Something went wrong. Try again, or just ignore future emails.</p>', 500);
  }
});
