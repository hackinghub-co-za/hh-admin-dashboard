// Hacking Hub Admin Dashboard - PayFast ITN (Instant Transaction Notification) Webhook
//
// Deploy with: supabase functions deploy payfast-webhook --no-verify-jwt
// (--no-verify-jwt is required - PayFast's servers call this directly with no
// Supabase auth header at all, so the platform's default JWT check would
// reject every real notification before this code ever runs.)
//
// Requires these secrets set first:
//   supabase secrets set PAYFAST_MERCHANT_ID=<your merchant id>
//   supabase secrets set PAYFAST_MERCHANT_KEY=<your merchant key>
//   supabase secrets set PAYFAST_PASSPHRASE=<your passphrase, if you set one in the PayFast dashboard>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// Optionally: supabase secrets set PAYFAST_SANDBOX=true while testing against
// sandbox.payfast.co.za instead of the live gateway.
//
// This is the missing half of src/lib/payfast.js's notify_url, which has
// pointed here since checkout links were first generated - PayFast POSTs
// here the moment a real payment completes. Every check below is required
// by PayFast's own ITN security guidance; skipping any of them would let
// anyone who discovers this URL forge a fake "payment succeeded" webhook and
// have it silently recorded as a real transaction:
//   1. merchant_id in the payload must match ours
//   2. the signature PayFast sent must recompute correctly
//   3. PayFast's own /eng/query/validate endpoint must confirm the data,
//      server-to-server - this is what actually proves the request came
//      from PayFast rather than someone who merely knows our merchant id
//      and passphrase
// Only once all three pass does a transaction get written.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Web Crypto's SubtleCrypto only supports the SHA family, not MD5 - the same
// reason src/lib/payfast.js has to hand-roll MD5 client-side. Using a proper
// tested library here instead of re-implementing it a second time.
import md5 from 'https://esm.sh/js-md5@0.8.3';

// Matches PayFast's own encoding convention (and the identical helper in
// payfast-checkout/index.ts): standard URL-encoding with spaces as '+'
// rather than '%20'.
function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID');
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') || '';
    const sandbox = (Deno.env.get('PAYFAST_SANDBOX') || '').toLowerCase() === 'true';

    if (!merchantId) {
      console.error('payfast-webhook: PAYFAST_MERCHANT_ID secret not set');
      return new Response('Not configured', { status: 500 });
    }

    // 1. merchant_id must be ours.
    if (params.get('merchant_id') !== merchantId) {
      console.error('payfast-webhook: merchant_id mismatch', params.get('merchant_id'));
      return new Response('OK', { status: 200 }); // ack, but don't process
    }

    // 2. Recompute the signature - fields in the order PayFast sent them,
    // excluding `signature` itself, PayFast-style URL-encoded, passphrase
    // appended if one is configured.
    const receivedSignature = params.get('signature') || '';
    let signatureString = '';
    for (const [key, value] of params.entries()) {
      if (key === 'signature') continue;
      signatureString += `${key}=${pfEncode(value)}&`;
    }
    signatureString = signatureString.slice(0, -1);
    if (passphrase) {
      signatureString += `&passphrase=${pfEncode(passphrase)}`;
    }
    const computedSignature = md5(signatureString);

    if (computedSignature !== receivedSignature) {
      console.error('payfast-webhook: signature mismatch');
      return new Response('OK', { status: 200 });
    }

    // 3. Confirm with PayFast directly, server-to-server - the real proof
    // this request actually came from PayFast.
    const validateHost = sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
    const validateRes = await fetch(`https://${validateHost}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyText,
    });
    const validateText = (await validateRes.text()).trim();
    if (validateText !== 'VALID') {
      console.error('payfast-webhook: PayFast validate endpoint returned', validateText);
      return new Response('OK', { status: 200 });
    }

    // All three checks passed - this is a genuine PayFast notification.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const pfPaymentId = params.get('pf_payment_id') || '';
    if (!pfPaymentId) {
      console.error('payfast-webhook: missing pf_payment_id, cannot record');
      return new Response('OK', { status: 200 });
    }

    const amountGross = parseFloat(params.get('amount_gross') || '0') || 0;
    const amountFee = Math.abs(parseFloat(params.get('amount_fee') || '0') || 0);
    const amountNet = parseFloat(params.get('amount_net') || '0') || 0;

    // ON CONFLICT (pf_payment_id) DO NOTHING - PayFast can and does resend
    // the same ITN more than once; this makes a duplicate delivery a no-op
    // instead of double-counting revenue.
    const { error: insertError } = await adminClient
      .from('payfast_transactions')
      .upsert(
        {
          pf_payment_id: pfPaymentId,
          m_payment_id: params.get('m_payment_id') || null,
          member_name: [params.get('name_first'), params.get('name_last')].filter(Boolean).join(' ') || null,
          email: (params.get('email_address') || '').toLowerCase(),
          plan: params.get('item_name') || null,
          amount: amountGross,
          fee: amountFee,
          net: amountNet,
          payment_status: params.get('payment_status') || 'UNKNOWN',
        },
        { onConflict: 'pf_payment_id', ignoreDuplicates: true }
      );

    if (insertError) {
      console.error('payfast-webhook: insert failed', insertError.message);
      // A genuine server-side failure - PayFast will retry a non-2xx response.
      return new Response('Error', { status: 500 });
    }

    // Grant portal access on a genuinely completed payment - this used to be
    // a manual step (an admin had to notice the new payer and add them by
    // hand), so a real payment could land with no way for that person to
    // actually sign in yet. A grant failure doesn't fail the webhook: the
    // transaction above is already correctly recorded either way, and
    // retrying the whole ITN over a grant hiccup would just risk duplicate
    // processing for no benefit - it's logged instead for manual follow-up.
    const payerEmail = (params.get('email_address') || '').toLowerCase();
    if (payerEmail && params.get('payment_status') === 'COMPLETE') {
      const payerName = [params.get('name_first'), params.get('name_last')].filter(Boolean).join(' ') || null;
      const { error: grantError } = await adminClient.rpc('grant_member_portal_access', {
        p_email: payerEmail,
        p_full_name: payerName,
      });
      if (grantError) {
        console.error('payfast-webhook: grant_member_portal_access failed', grantError.message);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('payfast-webhook error:', err);
    return new Response('Error', { status: 500 });
  }
});
