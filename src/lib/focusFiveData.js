// Focus 5 (supabase/038_focus_five.sql) - the 5 members getting the most
// attention this month. Admin-only, no member-facing equivalent (RLS
// rejects a non-admin entirely). Only called for real (non-mock) sessions -
// Mock Admin has no Supabase session, so it uses local-only demo state
// instead (see AdminDashboard.jsx).

import { supabase } from './supabase';

/** Fetch every Focus 5 row, oldest-added first. RLS rejects this for non-admins. */
export async function fetchFocusFive() {
  const { data, error } = await supabase
    .from('focus_five')
    .select('id, member_email, added_at')
    .order('added_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ id: row.id, memberEmail: row.member_email, addedAt: row.added_at }));
}

/** Admin-only: adds a member to Focus 5. Harmless no-op if they're already on it
 * (member_email is UNIQUE). */
export async function addToFocusFive(memberEmail) {
  const { error } = await supabase
    .from('focus_five')
    .insert({ member_email: memberEmail.toLowerCase() });
  if (error && error.code !== '23505') throw error; // 23505 = unique_violation, already on the list
}

/** Admin-only: removes a member from Focus 5. */
export async function removeFromFocusFive(memberEmail) {
  const { error } = await supabase.from('focus_five').delete().eq('member_email', memberEmail.toLowerCase());
  if (error) throw error;
}
