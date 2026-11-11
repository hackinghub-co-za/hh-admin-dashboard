// Hacking Hub Admin Dashboard - Paid consultation checkout
//
// Deploy with: supabase functions deploy consultation-checkout --no-verify-jwt
// Uses the PayFast secrets payfast-checkout already uses (PAYFAST_MERCHANT_ID,
// PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE, optional PAYFAST_SANDBOX) - no new
// ones needed.
//
// Called by the "Book a consultation" form on hackinghub.co.za. The visitor
// isn't signed in to anything, so this is public (no JWT): it takes a name and
// an email, and returns a signed PayFast checkout link for the one thing it
// sells - a R200, 30-minute consultation. The price and item are fixed HERE;
// nothing the browser sends can change what is charged.
//
// After paying, PayFast sends the visitor to the Cal.com booking page with
// their name and email filled in. PayFast's notification goes to
// payfast-webhook, which spots the 'CONSULT-' m_payment_id and records the
// payment in consultation_payments (113_consultations.sql) - never as a
// membership, so no portal access and no welcome email.

import md5 from 'https://esm.sh/js-md5@0.8.3';

const PRICE = 200;
const ITEM_NAME = 'Hacking Hub 30-minute consultation';
const BOOKING_URL = 'https://cal.com/siya-gladile-yabcoe/consultation';
const SITE_URL = 'https://hackinghub.co.za';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same encoding and signature as payfast-checkout and payfast-webhook.
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
  if (passphrase) getString += `&passphrase=${pfEncode(passphrase.trim())}`;
  return md5(getString);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID');
  const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY');
  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const sandbox = (Deno.env.get('PAYFAST_SANDBOX') || '').toLowerCase() === 'true';
  if (!merchantId || !merchantKey || !supabaseUrl) return json({ error: 'Payments are not set up yet.' }, 500);

  try {
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* handled below */ }
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : '';
    if (name.length < 2) return json({ error: 'Please enter your name.' }, 400);
    if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

    const [first, ...rest] = name.split(' ');
    const booking = `${BOOKING_URL}?${new URLSearchParams({ name, email }).toString()}`;

    const data: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: booking,
      cancel_url: `${SITE_URL}/#pricing`,
      notify_url: `${supabaseUrl}/functions/v1/payfast-webhook`,
      name_first: first,
      name_last: rest.join(' '),
      email_address: email,
      m_payment_id: `CONSULT-${Date.now()}`,
      amount: PRICE.toFixed(2),
      item_name: ITEM_NAME,
    };
    data.signature = generateSignature(data, passphrase);

    const base = sandbox ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process';
    return json({ checkoutUrl: `${base}?${new URLSearchParams(data).toString()}` });
  } catch (err) {
    console.error('consultation-checkout error:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
