// A member's own "interviews had" count - view-only on the member side.
// get_my_interviews_had() started as a plain admin-set counter
// (supabase/057_interviews_had.sql) and was redefined by
// supabase/058_member_interviews.sql to return one merged total: that
// manual baseline plus real interviews the member logged and had via
// Interview Prep - same function, same call here, now just a bigger number.
// Call once per session load.

import { supabase } from './supabase';

export async function fetchMyInterviewsHad() {
  const { data, error } = await supabase.rpc('get_my_interviews_had');
  if (error) throw error;
  return data || 0;
}
