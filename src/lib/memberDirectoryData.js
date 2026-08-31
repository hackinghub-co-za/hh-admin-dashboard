// Peer-visible member directory (used by MemberPortal.jsx). Only called for real (non-mock) sessions - Mock
// Member has no Supabase session, so the Members tab shows a small local demo
// roster instead (see MemberPortal.jsx).

import { supabase } from './supabase';

/** Fetch every active member's public directory card (name, about, location,
 * LinkedIn, TryHackMe username, headshot, GitHub/TikTok/personal website,
 * years of experience, certifications, a fun fact, specialty, job readiness,
 * employment status/job title). Excludes sensitive fields (money owed, phone,
 * age/gender, etc.) at the RPC level. */
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
    headshotUrl: row.headshot_url || '',
    githubUrl: row.github_url || '',
    tiktokUrl: row.tiktok_url || '',
    websiteUrl: row.website_url || '',
    yearsExperience: row.years_experience ?? null,
    certifications: row.certifications || '',
    funFact: row.fun_fact || '',
    specialty: row.specialty || 'Not Set',
    jobReadiness: row.job_readiness || 'Not Started',
    employmentStatus: row.employment_status || 'Not Set',
    jobTitle: row.job_title || '',
    roadmapTrack: row.roadmap_track || null,
  }));
}

/** Updates the current member's own directory card. Scoped server-side to only
 * these 17 public-facing-or-self-only columns on their own row. Age/gender are
 * write-only from here (never returned by fetchMemberDirectory/
 * get_member_directory - see fetchMyAgeAndGender below for reading them back). */
export async function updateMyDirectoryProfile({ fullName, about, location, linkedin, tryhackmeUsername, headshotUrl, githubUrl, tiktokUrl, websiteUrl, yearsExperience, certifications, funFact, specialty, employmentStatus, jobTitle, age, gender }) {
  const { error } = await supabase.rpc('update_my_directory_profile', {
    p_full_name: fullName || null,
    p_about: about || null,
    p_location: location || null,
    p_linkedin: linkedin || null,
    p_tryhackme_username: tryhackmeUsername || null,
    p_headshot_url: headshotUrl || null,
    p_github_url: githubUrl || null,
    p_tiktok_url: tiktokUrl || null,
    p_website_url: websiteUrl || null,
    p_years_experience: yearsExperience === '' || yearsExperience === null || yearsExperience === undefined ? null : Number(yearsExperience),
    p_certifications: certifications || null,
    p_fun_fact: funFact || null,
    p_specialty: specialty || null,
    p_employment_status: employmentStatus || null,
    p_job_title: employmentStatus === 'Employed' ? (jobTitle || null) : null,
    p_age: age || null,
    p_gender: gender || null,
  });
  if (error) throw error;
}

/** The current member's own age/gender - deliberately not part of
 * fetchMemberDirectory() above (both stay peer-invisible), so this is a
 * separate, private read used only to pre-fill their own edit form. */
export async function fetchMyAgeAndGender() {
  const { data, error } = await supabase.rpc('get_my_age_and_gender');
  if (error) throw error;
  const row = data?.[0];
  return { age: row?.age || '', gender: row?.gender || '' };
}

/** Uploads (or replaces) the current member's headshot to the public
 * member-headshots bucket, scoped to a path prefixed with their own email
 * (enforced server-side by storage RLS, not just this path convention), and
 * returns the public URL to store via updateMyDirectoryProfile. Capped at 5MB
 * / image mime types at the bucket level - a too-large or wrong-type file is
 * rejected by Supabase itself, not just skipped client-side. */
export async function uploadHeadshot(email, file) {
  const folder = email.toLowerCase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/headshot.${ext}`;

  // Explicitly clear out any existing headshot(s) first rather than relying
  // on upload()'s upsert - Postgres RLS still evaluates the INSERT policy's
  // WITH CHECK (including is_member_allowed) against the proposed row even
  // when an upsert resolves via its ON CONFLICT DO UPDATE path, which was
  // intermittently rejecting a member's own repeat/replacement upload with
  // "new row violates row-level security policy". Deleting first means the
  // follow-up upload is always a clean INSERT, sidestepping that entirely -
  // and it also cleans up an old headshot left behind when a member switches
  // file extensions (e.g. jpg -> png), which would otherwise never get
  // removed since the new upload lands at a different path.
  const { data: existing } = await supabase.storage.from('member-headshots').list(folder);
  if (existing?.length) {
    await supabase.storage.from('member-headshots').remove(existing.map((f) => `${folder}/${f.name}`));
  }

  const { error } = await supabase.storage
    .from('member-headshots')
    .upload(path, file, { cacheControl: '3600', contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('member-headshots').getPublicUrl(path);
  // Cache-bust so a replaced headshot doesn't keep showing the old cached image
  // under the same URL.
  return `${data.publicUrl}?t=${Date.now()}`;
}
