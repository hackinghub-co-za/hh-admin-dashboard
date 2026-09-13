// Per-entry date overrides for "My Journey So Far" (077_journey_timeline_overrides.sql).
// Purely cosmetic - lets a member correct how their own storyline reads
// (e.g. a cert's real timeline date is just roadmap_items.updated_at, an
// approximation) without touching the real underlying record, which other
// business logic (tenure, competition eligibility, etc.) still relies on.

import { supabase } from './supabase';

/** Every override the signed-in member has set, as a plain
 * { [entry_key]: 'YYYY-MM-DD' } map - easiest shape for computeJourneyStory
 * to look up against while building the timeline. */
export async function fetchMyJourneyOverrides() {
  const { data, error } = await supabase
    .from('journey_timeline_overrides')
    .select('entry_key, override_date');
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.entry_key, row.override_date]));
}

/** Sets (or replaces) the display date for one timeline entry. */
export async function setJourneyOverride(entryKey, overrideDate, memberEmail) {
  const { error } = await supabase
    .from('journey_timeline_overrides')
    .upsert(
      { member_email: memberEmail.toLowerCase(), entry_key: entryKey, override_date: overrideDate, updated_at: new Date().toISOString() },
      { onConflict: 'member_email,entry_key' }
    );
  if (error) throw error;
}

/** Clears an override, reverting that entry back to its real source date. */
export async function clearJourneyOverride(entryKey) {
  const { error } = await supabase.from('journey_timeline_overrides').delete().eq('entry_key', entryKey);
  if (error) throw error;
}
