/**
 * PayFast checkout - client-side entry point.
 *
 * Signing and checkout-URL construction happen entirely in the
 * payfast-checkout Edge Function now, not here. Two real problems with the
 * old client-side approach: it required the PayFast passphrase to be
 * bundled into the browser JS (VITE_PAYFAST_PASSPHRASE - readable by anyone
 * who opens devtools, which would let someone forge a fake "payment
 * succeeded" webhook), and its hand-rolled MD5 implementation was actually
 * broken (referenced add32/md5cycle, neither ever defined), so the checkout
 * button threw a ReferenceError the moment anyone clicked "Pay".
 */

import { supabase } from './supabase';

/**
 * Requests a signed PayFast checkout URL for the current member. The member's
 * name/email come from their own verified session server-side, never from
 * this call - see payfast-checkout/index.ts.
 */
export async function createPayfastCheckoutUrl(itemDetails) {
  const { data, error } = await supabase.functions.invoke('payfast-checkout', {
    body: {
      itemName: itemDetails.itemName || 'Hacking Hub Subscription',
      amount: itemDetails.amount,
      subscriptionType: itemDetails.subscriptionType,
      frequency: itemDetails.frequency,
      cycles: itemDetails.cycles,
      billingDate: itemDetails.billingDate,
      returnOrigin: window.location.origin,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.checkoutUrl;
}
