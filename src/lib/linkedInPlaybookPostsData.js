// LinkedIn Playbook example posts (linkedin_playbook_posts,
// 059_linkedin_weekly_post.sql) - the actual 84 posts (7 tracks x 12
// weeks), fetched here rather than hardcoded in linkedInPlaybookData.js
// (which stays pure content-shape helpers, no Supabase calls). Same table
// the linkedin-post-reminder-email edge function reads server-side, so
// the in-app widget and the reminder email can never drift apart again.

import { supabase } from './supabase';

/** Every track's full 12-week post set, as { [roadmapTrack]: string[12] } -
 * keyed and ordered so getCurrentWeekContent() can index straight into it
 * with the same 0-11 week index used everywhere else. Readable by any
 * signed-in, approved member (not sensitive - every member can already
 * browse every track's plan in the Playbook guide). */
export async function fetchLinkedInPlaybookPosts() {
  const { data, error } = await supabase
    .from('linkedin_playbook_posts')
    .select('roadmap_track, week_index, post_text')
    .order('week_index', { ascending: true });
  if (error) throw error;
  const byTrack = {};
  (data || []).forEach((row) => {
    (byTrack[row.roadmap_track] || (byTrack[row.roadmap_track] = []))[row.week_index] = row.post_text;
  });
  return byTrack;
}
