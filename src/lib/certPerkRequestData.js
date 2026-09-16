// Sponsored cert perk requests - the "Request a Sponsored Exam" card at the
// top of the member Cert Calendar tab. Each request just fires an email to
// the founder (cert-perk-request-email Edge Function) - there's no request
// queue/table, this is purely a notification, same "kicks off an email"
// shape as the original ask. Eligibility (Azure = Permanent/Elite only,
// "anything" = Elite only) is re-checked server-side inside the function,
// never trusted from here.

import { supabase } from './supabase';

export async function requestCertPerk(perkType, details) {
  const { data, error } = await supabase.functions.invoke('cert-perk-request-email', {
    body: { perkType, details: details || null },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
