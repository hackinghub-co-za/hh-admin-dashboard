// Talent Pool (supabase/107_talent_pool.sql). Members opt in and keep their own
// profile; the admin searches the pool and builds anonymous recruiter packs.
// Everything goes through server functions - the tables have no policies - and
// real contact details are only returned by getTalentContact, which logs each
// reveal. Only called for real (non-mock) sessions.

import { supabase } from './supabase';

function mapMine(data) {
  const p = data?.profile || null;
  const d = data?.defaults || {};
  return {
    profile: p && {
      displayId: p.display_id,
      headline: p.headline || '',
      summary: p.summary || '',
      city: p.city || '',
      workMode: p.work_mode || '',
      availableFrom: p.available_from || '',
      openToContract: !!p.open_to_contract,
      selfSkills: Array.isArray(p.self_skills) ? p.self_skills : [],
      verifiedSkills: Array.isArray(p.verified_skills) ? p.verified_skills : [],
      consentAt: p.consent_at,
      lastConfirmedAt: p.last_confirmed_at,
      visible: !!p.visible,
    },
    defaults: {
      summary: d.summary || '',
      city: d.city || '',
      years: d.years ?? null,
      jobTitle: d.job_title || '',
      verifiedSkills: Array.isArray(d.verified_skills) ? d.verified_skills : [],
    },
  };
}

/** The caller's own talent profile (null if not opted in) and starting values from their member profile. */
export async function fetchMyTalentProfile() {
  const { data, error } = await supabase.rpc('get_my_talent_profile');
  if (error) throw error;
  return mapMine(data);
}

/** Opt in, or update and re-confirm. `consent` must be true. */
export async function saveMyTalentProfile(form) {
  const { error } = await supabase.rpc('save_my_talent_profile', {
    p_headline: form.headline,
    p_summary: form.summary || null,
    p_city: form.city || null,
    p_work_mode: form.workMode || null,
    p_available_from: form.availableFrom || null,
    p_open_to_contract: !!form.openToContract,
    p_self_skills: form.selfSkills || [],
    p_consent: !!form.consent,
  });
  if (error) throw error;
}

/** Leave the pool: deletes the profile. */
export async function deleteMyTalentProfile() {
  const { error } = await supabase.rpc('delete_my_talent_profile');
  if (error) throw error;
}

function mapCard(row) {
  return {
    id: row.id,
    displayId: row.display_id,
    source: row.source === 'public' ? 'Community' : 'Member',
    score: row.score || 0,
    headline: row.headline || '',
    role: row.role || '',
    years: row.years ?? null,
    city: row.city || '',
    track: row.track || '',
    workMode: row.work_mode || '',
    openToContract: !!row.open_to_contract,
    availableFrom: row.available_from || '',
    verified: Array.isArray(row.verified) ? row.verified : [],
    self: Array.isArray(row.self) ? row.self : [],
    summary: row.summary || '',
    hidden: !!row.hidden,
    notes: row.notes || '',
  };
}

/** Admin: anonymous cards matching a search, best match first, plus how many profiles are visible in all. */
export async function searchTalentPool({ query, track, city, minYears, verifiedOnly, availableNow, includeHidden }) {
  const { data, error } = await supabase.rpc('search_talent_pool', {
    p_query: query || null,
    p_track: track || null,
    p_city: city || null,
    p_min_years: minYears || null,
    p_verified_only: !!verifiedOnly,
    p_available_now: !!availableNow,
    p_include_hidden: !!includeHidden,
  });
  if (error) throw error;
  return { items: (data?.items || []).map(mapCard), totalVisible: data?.total_visible ?? 0 };
}

/** Admin: the tracks and cities present in the pool, for the filter chips. */
export async function fetchTalentFilters() {
  const { data, error } = await supabase.rpc('get_talent_filters');
  if (error) throw error;
  return { tracks: data?.tracks || [], cities: data?.cities || [] };
}

/** Admin: name and contact details for one profile, after the person has agreed to an introduction. Logged. */
export async function getTalentContact(id) {
  const { data, error } = await supabase.rpc('get_talent_contact', { p_id: id });
  if (error) throw error;
  return {
    displayId: data?.display_id,
    name: data?.name || '',
    email: data?.email || '',
    phone: data?.phone || '',
    links: data?.links || {},
  };
}

/** Admin: hide or restore a profile, with a private note. */
export async function setTalentProfileHidden(id, hidden, notes) {
  const { error } = await supabase.rpc('set_talent_profile_hidden', { p_id: id, p_hidden: !!hidden, p_notes: notes || null });
  if (error) throw error;
}
