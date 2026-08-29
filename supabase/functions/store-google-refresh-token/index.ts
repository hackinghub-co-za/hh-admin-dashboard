// Hacking Hub Admin Dashboard - Store Google Refresh Token
//
// Deploy with: supabase functions deploy store-google-refresh-token
// Requires a secret set first:
//   supabase secrets set GOOGLE_TOKEN_ENCRYPTION_KEY=<a long random string you make up>
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.)
//
// Called by hh-app right after a sign-in that included a fresh Google
// refresh token (session.providerRefreshToken - Google only issues one on
// first consent, or when the OAuth request explicitly forces
// prompt=consent, which hh-app only does when has_stored_google_refresh_token()
// says nothing's on file yet). Encrypts it with pgcrypto's pgp_sym_encrypt
// before writing to google_oauth_tokens (048_push_notifications.sql) via
// the service-role-only _store_encrypted_google_token() function - the
// encryption key never leaves this function's own environment or gets
// logged anywhere.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const encryptionKey = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY');

    if (!encryptionKey) {
      console.error('store-google-refresh-token: missing GOOGLE_TOKEN_ENCRYPTION_KEY secret');
      return new Response(JSON.stringify({ error: 'Not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify identity using the caller's own JWT - never trust a
    // client-supplied email, same pattern as gemma-chat.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    if (authError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const email = userData.user.email.toLowerCase();

    const { refresh_token } = await req.json();
    if (typeof refresh_token !== 'string' || !refresh_token) {
      return new Response(JSON.stringify({ error: 'Missing refresh_token.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: rpcError } = await adminClient.rpc('_store_encrypted_google_token', {
      p_email: email,
      p_refresh_token: refresh_token,
      p_key: encryptionKey,
    });

    if (rpcError) {
      console.error('store-google-refresh-token: write failed', rpcError.message);
      return new Response(JSON.stringify({ error: 'Could not store token.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('store-google-refresh-token error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
