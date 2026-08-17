// Daily login streak (supabase/032_login_streak.sql). Call once per session
// load - the RPC does the whole read-compare-write itself and returns the
// resulting streak, so there's no separate fetch needed.

import { supabase } from './supabase';

export async function recordDailyLogin() {
  const { data, error } = await supabase.rpc('record_daily_login');
  if (error) throw error;
  return data;
}
