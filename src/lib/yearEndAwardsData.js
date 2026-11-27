// HH Year-End Awards (supabase/119_year_end_awards.sql). The category list
// lives here; the voted ids are repeated in _award_voted_categories() so the
// server can check them, so keep the two in step.

import { supabase } from './supabase';

export const AWARD_CATEGORIES = [
  { id: 'newcomer', name: 'Best Newcomer', desc: 'Joined this year and made a big impression fast.', type: 'vote' },
  { id: 'funny', name: 'Class Clown', desc: 'Always brings the jokes to the group chat and the calls.', type: 'vote' },
  { id: 'helpful', name: 'Most Helpful', desc: 'The first to answer questions and share notes.', type: 'vote' },
  { id: 'hype', name: 'Biggest Hype Person', desc: 'Cheers on every win and keeps the energy up.', type: 'vote' },
  { id: 'comeback', name: 'Comeback of the Year', desc: 'Got knocked down by an exam or a tough year, and came back stronger.', type: 'vote' },
  { id: 'glowup', name: 'Career Glow-Up', desc: 'The biggest career move: a first cyber role, a promotion, a switch.', type: 'vote' },
  { id: 'linkedin', name: 'LinkedIn Legend', desc: 'The posts that made everyone stop scrolling.', type: 'vote' },
  { id: 'improved', name: 'Most Improved', desc: 'Came the furthest this year, from where they started to where they are now.', type: 'vote' },
  { id: 'grinder', name: 'Silent Grinder', desc: 'Doesn’t say much, but is always putting in the work.', type: 'vote' },
  { id: 'buddy', name: 'Best Study Buddy', desc: 'The accountability partner everyone wants in their group.', type: 'vote' },
  { id: 'story', name: 'Most Inspiring Story', desc: 'The journey that reminded everyone why they started.', type: 'vote' },
  { id: 'project', name: 'Best Project or Lab', desc: 'The home lab, write-up or project that impressed everyone.', type: 'vote' },
  { id: 'mentor', name: 'Mentor of the Year', desc: 'The mentor who made the biggest difference this year.', type: 'vote' },
  { id: 'certs', name: 'Cert Machine', desc: 'Most certs passed this year, from the Cert Calendar.', type: 'data' },
  { id: 'consistent', name: 'Most Consistent', desc: 'Most hours logged in the Study Marathon.', type: 'data' },
  { id: 'hubscore', name: 'Hub Score Champion', desc: 'Highest Hub Score at the end of the year.', type: 'data' },
  { id: 'streak', name: 'Longest Streak', desc: 'The most days in a row with a study session logged.', type: 'data' },
  { id: 'interviews', name: 'Interview Machine', desc: 'Most interviews this year, from member profiles.', type: 'data' },
  { id: 'events', name: 'Always There', desc: 'RSVP’d to the most Hacking Hub events this year: meetups, live sessions and workshops.', type: 'data' },
];

export const VOTED_CATEGORIES = AWARD_CATEGORIES.filter((c) => c.type === 'vote');
export const categoryById = (id) => AWARD_CATEGORIES.find((c) => c.id === id);

/** Dates, phase ('upcoming' | 'open' | 'closed' | 'results' | 'none'),
 * nominees, mentors and the signed-in member's own votes. */
export async function fetchAwardBallot() {
  const { data, error } = await supabase.rpc('get_award_ballot');
  if (error) throw error;
  return {
    year: data?.year,
    opensOn: data?.opens_on,
    closesOn: data?.closes_on,
    announceOn: data?.announce_on,
    phase: data?.phase || 'none',
    canVote: !!data?.can_vote,
    nominees: (data?.nominees || []).map((n) => ({ key: n.key, name: n.name, headshot: n.headshot || '' })),
    mentors: (data?.mentors || []).map((name) => ({ key: `mentor:${name}`, name, headshot: '' })),
    myVotes: Object.fromEntries((data?.my_votes || []).map((v) => [v.category, { key: v.nominee_key, name: v.nominee_name, reason: v.reason || '' }])),
  };
}

export async function castAwardVote(category, nomineeKey, reason) {
  const { error } = await supabase.rpc('cast_award_vote', { p_category: category, p_nominee_key: nomineeKey, p_reason: reason || null });
  if (error) throw error;
}

export async function removeAwardVote(category) {
  const { error } = await supabase.rpc('remove_award_vote', { p_category: category });
  if (error) throw error;
}

/** Members: the winners, once published. [{ category, name, detail }] */
export async function fetchAwardWinners() {
  const { data, error } = await supabase.rpc('get_award_winners');
  if (error) throw error;
  return data || [];
}

/** Admin: turnout, vote totals with reasons, and the data award leaders. */
export async function fetchAwardResults(year) {
  const { data, error } = await supabase.rpc('get_award_results', { p_year: year || null });
  if (error) throw error;
  return data;
}

/** Admin: this year's dates and whether the winners are shown to members. */
export async function fetchAwardSettings(year) {
  const { data, error } = await supabase.from('award_settings').select('*').eq('award_year', year).maybeSingle();
  if (error) throw error;
  return data && {
    year: data.award_year, opensOn: data.opens_on, closesOn: data.closes_on, announceOn: data.announce_on, published: data.results_published,
  };
}

export async function saveAwardSettings({ year, opensOn, closesOn, announceOn, published }) {
  const { error } = await supabase.from('award_settings').upsert({
    award_year: year, opens_on: opensOn, closes_on: closesOn, announce_on: announceOn, results_published: !!published, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export const awardDate = (iso) => (iso
  ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long' })
  : '');
