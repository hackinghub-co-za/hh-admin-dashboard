// Hacking Hub Admin Dashboard - PayFast Checkout URL Builder
//
// Deploy with: supabase functions deploy payfast-checkout
// Requires the same secrets payfast-webhook already uses:
//   supabase secrets set PAYFAST_MERCHANT_ID=<your merchant id>
//   supabase secrets set PAYFAST_MERCHANT_KEY=<your merchant key>
//   supabase secrets set PAYFAST_PASSPHRASE=<your passphrase, if you set one>
// Optionally: supabase secrets set PAYFAST_SANDBOX=true
// (SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically.)
//
// This replaces building the signed checkout URL in the browser
// (src/lib/payfast.js used to do this client-side). Two real problems with
// that: (1) it required VITE_PAYFAST_PASSPHRASE, which Vite bundles straight
// into the JS every visitor's browser can read - anyone could read the
// passphrase and forge a fake "payment succeeded" ITN call to
// payfast-webhook with a valid-looking signature; (2) the client-side MD5
// implementation was actually broken (called add32/md5cycle, neither of
// which were ever defined in that file), so the checkout button has been
// throwing a ReferenceError the moment anyone clicked "Pay". This function
// fixes both: the passphrase never leaves the server, and it reuses the
// same tested js-md5 library payfast-webhook already relies on.
//
// The caller's name/email come from their own verified Supabase session,
// never from client-supplied values, the same "never trust the client for
// who they are" pattern as every other Edge Function in this project.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import md5 from 'https://esm.sh/js-md5@0.8.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Matches PayFast's own encoding convention (and the identical helper in
// payfast-webhook/index.ts): standard URL-encoding with spaces as '+'
// rather than '%20'.
function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function generateSignature(data: Record<string, string>, passphrase: string): string {
  const parts: string[] = [];
  for (const key in data) {
    if (data[key] !== '' && data[key] !== undefined && data[key] !== null) {
      parts.push(`${key}=${pfEncode(String(data[key]).trim())}`);
    }
  }
  let getString = parts.join('&');
  if (passphrase) {
    getString += `&passphrase=${pfEncode(passphrase.trim())}`;
  }
  return md5(getString);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID');
    const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY');
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') || '';
    const sandbox = (Deno.env.get('PAYFAST_SANDBOX') || '').toLowerCase() === 'true';

    if (!merchantId || !merchantKey) {
      return new Response(JSON.stringify({ error: 'PayFast is not configured yet - missing merchant secrets.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify identity using the caller's own JWT - name/email on the
    // checkout form come from here, never from the request body.
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
    const fullName = userData.user.user_metadata?.full_name || '';
    const firstName = fullName.trim().split(' ')[0] || 'Operative';

    const { itemName, amount, subscriptionType, frequency, cycles, billingDate, returnOrigin } = await req.json();
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // returnOrigin is only ever used for where PayFast sends the browser
    // back to after checkout - not security-sensitive the way notify_url is
    // (that's fixed below, never client-supplied), so trusting the caller's
    // own window.location.origin here is safe. The fallback below only
    // fires if that's somehow missing - hackinghub.co.za on its own is the
    // marketing site, not this app, so it has to be the portal subdomain
    // or a fallback here would send someone to the wrong place entirely.
    const origin = typeof returnOrigin === 'string' && returnOrigin ? returnOrigin : 'https://portal.hackinghub.co.za';

    const data: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${origin}/?payment=success`,
      cancel_url: `${origin}/?payment=cancel`,
      notify_url: `${supabaseUrl}/functions/v1/payfast-webhook`,
      name_first: firstName,
      email_address: email,
      m_payment_id: `HH-${Date.now()}`,
      amount: amountNum.toFixed(2),
      item_name: itemName || 'Hacking Hub Subscription',
    };

    if (subscriptionType) {
      data.subscription_type = String(subscriptionType);
      data.billing_date = billingDate || new Date().toISOString().split('T')[0];
      data.recurring_amount = amountNum.toFixed(2);
      data.frequency = String(frequency || 3);
      data.cycles = String(cycles || 0);
    }

    data.signature = generateSignature(data, passphrase);

    const base = sandbox ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process';
    const checkoutUrl = `${base}?${new URLSearchParams(data).toString()}`;

    return new Response(JSON.stringify({ checkoutUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('payfast-checkout error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong building the checkout link.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
