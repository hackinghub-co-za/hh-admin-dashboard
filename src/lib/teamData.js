// Scoped team roles (supabase/067_permission_scopes.sql) - admin (founder),
// community_manager, mentor, member. getMyRole() is what App.jsx now uses
// to route a signed-in user, replacing the old "any @hackinghub.co.za
// email is an admin" domain guess. The rest of this file is founder-only
// (Team & Roles admin tab): assigning a role to a real account, and
// listing everyone who currently has one.

import { supabase } from './supabase';

/** The signed-in user's own real role, straight from profiles.role - never
 * guessed from their email domain. Called once per session, same as every
 * other "my own X" fetch in this app (fetchMyStartDate, get_my_roadmap_track). */
export async function getMyRole() {
  const { data, error } = await supabase.rpc('get_my_role');
  if (error) throw error;
  return data || 'member';
}

/** Admin-only: every account with a non-member role, most senior first. */
export async function fetchTeamMembers() {
  const { data, error } = await supabase.rpc('list_team_members');
  if (error) throw error;
  return (data || []).map((row) => ({ email: row.email, fullName: row.full_name || '', role: row.role }));
}

/** Admin-only: assign a role to a real account. They need to have signed in
 * at least once already (a profiles row has to exist to update). */
export async function setMemberRole(email, role) {
  const { error } = await supabase.rpc('set_member_role', { p_email: email, p_role: role });
  if (error) throw error;
}
