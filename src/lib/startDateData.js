// A member's own start date (supabase/042_manual_start_date.sql) - view-only
// on the member side, admin-editable only. Call once per session load.

import { supabase } from './supabase';

export async function fetchMyStartDate() {
  const { data, error } = await supabase.rpc('get_my_start_date');
  if (error) throw error;
  return data || null;
}
