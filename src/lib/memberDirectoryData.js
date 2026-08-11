// Peer-visible member directory (used by MemberPortal.jsx). Only called for real (non-mock) sessions - Mock
// Member has no Supabase session, so the Members tab shows a small local demo
// roster instead (see MemberPortal.jsx).

import { supabase } from './supabase';

/** Fetch every active member's public directory card (name, about, location,
 * LinkedIn, TryHackMe username, specialty, job readiness, employment
 * status/job title). Excludes sensitive fields (money owed, phone, age/gender,
 * etc.) at the RPC level. */
export async function fetchMemberDirectory() {
  const { data, error } = await supabase.rpc('get_member_directory');
  if (error) throw error;
  return (data || []).map((row) => ({
    email: row.email,
    fullName: row.full_name || '',
    about: row.about || '',
    location: row.location || '',
    linkedin: row.linkedin || '',
    tryhackmeUsername: row.tryhackme_username || '',
    specialty: row.specialty || 'Not Set',
    jobReadiness: row.job_readiness || 'Not Started',
    employmentStatus: row.employment_status || 'Not Set',
    jobTitle: row.job_title || '',
  }));
}

/** Updates the current member's own directory card. Scoped server-side to only
 * these 8 public-facing columns on their own row. */
export async function updateMyDirectoryProfile({ fullName, about, location, linkedin, tryhackmeUsername, specialty, employmentStatus, jobTitle }) {
  const { error } = await supabase.rpc('update_my_directory_profile', {
    p_full_name: fullName || null,
    p_about: about || null,
    p_location: location || null,
    p_linkedin: linkedin || null,
    p_tryhackme_username: tryhackmeUsername || null,
    p_specialty: specialty || null,
    p_employment_status: employmentStatus || null,
    p_job_title: employmentStatus === 'Employed' ? (jobTitle || null) : null,
  });
  if (error) throw error;
}
