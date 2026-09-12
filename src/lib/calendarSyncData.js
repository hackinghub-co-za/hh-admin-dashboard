// Daily automated calendar sync for last-1on1 dates (073_admin_calendar_sync.sql).
// Distinct from the on-demand "Sync Last 1on1 Dates" button (googleCalendar.js,
// handleSyncLastMeetings) - that one reads the signed-in admin's own live
// browser session and never persists anything. This is the persisted result
// of the sync-last-1on1-dates Edge Function running unattended every
// morning against a staff member's stored, encrypted refresh token.

import { supabase } from './supabase';

/** Whether the signed-in staff member has already granted the one-time
 * calendar consent needed for the daily sync to run on their behalf. */
export async function hasStoredCalendarSyncToken() {
  const { data, error } = await supabase.rpc('has_stored_calendar_sync_token');
  if (error) throw error;
  return !!data;
}

/** Every meeting date the daily sync has found, per member email - staff-only
 * (RLS's "staff read calendar synced meetings" policy). Used to merge into
 * the same "last meeting" concept as the manual Calendar sync and the
 * manually-logged sessions. */
export async function fetchCalendarSyncedMeetings() {
  const { data, error } = await supabase
    .from('calendar_synced_meetings')
    .select('member_email, meeting_date');
  if (error) throw error;
  return data || [];
}
