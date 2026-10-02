// Accountability Check-ins (supabase/091_accountability_checkins.sql) - a
// staff-curated list of members who need closer attention, plus a dated,
// attributed log of every check-in. Admins and community managers only;
// RLS rejects everyone else. Only called for real (non-mock) sessions -
// Mock Admin uses local-only demo state instead (see AdminDashboard.jsx).

import { supabase } from './supabase';

/** Members a staff user can add to the list - name, track and photo only
 * (never member_profiles' financial fields), so it works for a community
 * manager too, who can't read member_profiles directly. */
export async function fetchAccountabilityRoster() {
  const { data, error } = await supabase.rpc('get_accountability_roster');
  if (error) throw error;
  return (data || []).map((row) => ({
    email: row.email.toLowerCase(),
    fullName: row.full_name || row.email,
    specialty: row.specialty && row.specialty !== 'Not Set' ? row.specialty : (row.roadmap_track || null),
    headshotUrl: row.headshot_url || null,
    breakUntil: row.break_until || null,
  }));
}

/** Brings new joiners (first 21 days) onto the list, assigned to the
 * configured staff member, and takes them off once their 21 days are up -
 * see sync_new_joiner_accountability() in 091. Called before every list
 * load so the tab never waits on the 7am digest to catch up. */
export async function syncNewJoinerAccountability() {
  const { error } = await supabase.rpc('sync_new_joiner_accountability');
  if (error) throw error;
}

/** Everyone currently on the list, oldest-added first. */
export async function fetchAccountabilityList() {
  const { data, error } = await supabase
    .from('accountability_list')
    .select('member_email, added_by, added_at, assigned_to, source')
    .order('added_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    memberEmail: row.member_email,
    addedBy: row.added_by,
    addedAt: row.added_at,
    assignedTo: row.assigned_to || null,
    isNewJoiner: row.source === 'new_joiner',
  }));
}

/** Harmless no-op if they're already on it (member_email is the primary key). */
export async function addToAccountabilityList(memberEmail, addedBy) {
  const { error } = await supabase
    .from('accountability_list')
    .insert({ member_email: memberEmail.toLowerCase(), added_by: addedBy.toLowerCase() });
  if (error && error.code !== '23505') throw error; // 23505 = already on the list
}

/** Takes them off the list - their check-in history stays on record. */
export async function removeFromAccountabilityList(memberEmail) {
  const { error } = await supabase.from('accountability_list').delete().eq('member_email', memberEmail.toLowerCase());
  if (error) throw error;
}

/** Every check-in note, newest first. */
export async function fetchAccountabilityCheckins() {
  const { data, error } = await supabase
    .from('accountability_checkins')
    .select('id, member_email, note, logged_by, logged_by_name, logged_at')
    .order('logged_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapCheckin);
}

export async function logAccountabilityCheckin({ memberEmail, note, loggedBy, loggedByName }) {
  const { data, error } = await supabase
    .from('accountability_checkins')
    .insert({
      member_email: memberEmail.toLowerCase(),
      note: note.trim(),
      logged_by: loggedBy.toLowerCase(),
      logged_by_name: loggedByName || null,
    })
    .select('id, member_email, note, logged_by, logged_by_name, logged_at')
    .single();
  if (error) throw error;
  return mapCheckin(data);
}

function mapCheckin(row) {
  return {
    id: row.id,
    memberEmail: row.member_email,
    note: row.note,
    loggedBy: row.logged_by,
    loggedByName: row.logged_by_name || row.logged_by,
    loggedAt: row.logged_at,
  };
}

/** The daily-email on/off switch, plus who it actually goes to. */
export async function fetchAccountabilityEmailSettings() {
  const [{ data: settings, error: settingsError }, { data: recipients, error: recipientsError }] = await Promise.all([
    supabase.from('accountability_settings').select('email_enabled').eq('id', 1).maybeSingle(),
    supabase.rpc('get_accountability_digest_recipients'),
  ]);
  if (settingsError) throw settingsError;
  if (recipientsError) throw recipientsError;
  return {
    emailEnabled: settings ? settings.email_enabled : true,
    recipients: (recipients || []).map((r) => r.email),
  };
}

export async function setAccountabilityEmailEnabled(enabled) {
  const { error } = await supabase.from('accountability_settings').upsert({ id: 1, email_enabled: enabled });
  if (error) throw error;
}
