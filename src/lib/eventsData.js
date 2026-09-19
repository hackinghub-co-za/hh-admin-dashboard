// Persisted Events tab data - the events themselves and RSVPs / real
// attendance. Only called for real (non-mock) sessions - Mock Member has no
// Supabase session, so the Events tab uses local-only demo state instead (see
// MemberPortal.jsx).

import { supabase } from './supabase';

/** Fetch every community event visible to the caller, soonest first. RLS
 * scopes this to signed-in, approved members only, and further limits each
 * member to approved events plus their own pending submissions - admins see
 * every event regardless of status through a separate policy. */
export async function fetchCommunityEvents() {
  const { data, error } = await supabase
    .from('community_events')
    .select('id, type, title, description, date, time, location, link, image_url, created_by, status, capacity, recording_url, recording_added_at, summary_notes_url')
    .order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description || '',
    date: row.date,
    time: row.time || '',
    location: row.location || '',
    link: row.link || '',
    imageUrl: row.image_url || '',
    createdBy: row.created_by || '',
    status: row.status,
    capacity: row.capacity, // null = unlimited seats
    recordingUrl: row.recording_url || '',
    recordingAddedAt: row.recording_added_at || null,
    summaryNotesUrl: row.summary_notes_url || '',
  }));
}

/** Adds a new community event, self-attributed to the current member (RLS
 * enforces created_by can only ever be the caller's own email). Always lands
 * as 'Pending' server-side regardless of what's sent - only visible to its
 * submitter and admins until approved via approveCommunityEvent(). */
export async function createCommunityEvent({ type, title, description, date, time, location, link, imageUrl, createdBy }) {
  const { data, error } = await supabase
    .from('community_events')
    .insert({
      type,
      title,
      description: description || null,
      date,
      time: time || null,
      location: location || null,
      link: link || null,
      image_url: imageUrl || null,
      created_by: createdBy.toLowerCase(),
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    type: data.type,
    title: data.title,
    description: data.description || '',
    date: data.date,
    time: data.time || '',
    location: data.location || '',
    link: data.link || '',
    imageUrl: data.image_url || '',
    createdBy: data.created_by || '',
    status: data.status,
  };
}

/** Uploads an event logo/cover image to the public event-images bucket
 * (019_events.sql) and returns its public URL. RLS restricts writes to
 * admins/community_managers, same as event management generally - a plain
 * member's own "Add Event" submission never shows this control. One file
 * per event id, so re-uploading for the same event cleanly replaces it
 * rather than accumulating orphaned files, same reasoning as
 * uploadHeadshot() (memberDirectoryData.js). Pass the event's real id once
 * it exists (after creation) or a temporary key while still drafting a new
 * one - either way the caller is responsible for saving the returned URL
 * onto the event's image_url. */
export async function uploadEventImage(eventKey, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${eventKey}/image.${ext}`;
  const { data: existing } = await supabase.storage.from('event-images').list(String(eventKey));
  if (existing?.length) {
    await supabase.storage.from('event-images').remove(existing.map((f) => `${eventKey}/${f.name}`));
  }
  const { error } = await supabase.storage
    .from('event-images')
    .upload(path, file, { cacheControl: '3600', contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('event-images').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Admin/CM: edit an existing event's fields - available both before and
 * after approval (the existing "admins manage community events" FOR ALL
 * RLS policy already covers this write, same as approve/delete - no new
 * policy or RPC needed). Status is deliberately not editable here; that
 * stays approveCommunityEvent()'s own job. */
export async function updateCommunityEvent(eventId, { type, title, description, date, time, location, link, imageUrl, capacity }) {
  const { error } = await supabase
    .from('community_events')
    .update({
      type,
      title,
      description: description || null,
      date,
      time: time || null,
      location: location || null,
      link: link || null,
      image_url: imageUrl || null,
      capacity: capacity === '' || capacity === null || capacity === undefined ? null : Number(capacity),
    })
    .eq('id', eventId);
  if (error) throw error;
}

/** Admin/CM: sets or clears a Sunday Catchup's recording link and/or
 * summary notes link, once both actually exist (a catchup happens live,
 * then these get posted by hand afterward - there's no auto-upload
 * integration). Deliberately separate from updateCommunityEvent() - that
 * function does a full-field overwrite, so folding these in there would
 * silently wipe the recording link every time an admin edited the event's
 * title/date/location through the general edit form. The 14-day
 * visibility window (recording_added_at) is stamped automatically by a DB
 * trigger the moment recording_url first goes from unset to set
 * (019_events.sql) - not something this function computes itself. */
export async function updateEventRecording(eventId, { recordingUrl, summaryNotesUrl }) {
  const { error } = await supabase
    .from('community_events')
    .update({
      recording_url: recordingUrl || null,
      summary_notes_url: summaryNotesUrl || null,
    })
    .eq('id', eventId);
  if (error) throw error;
}

/** Approves a pending community event, making it visible to every member.
 * Server-side restricted to exactly siya@hackinghub.co.za regardless of who
 * calls this - not every admin account. */
export async function approveCommunityEvent(eventId) {
  const { error } = await supabase.rpc('approve_community_event', { p_event_id: eventId });
  if (error) throw error;
}

/** Admin-only: permanently deletes an event, most useful for rejecting a
 * pending submission that shouldn't go live. RLS ("admins manage community
 * events") rejects this for non-admins - unlike approval, not further
 * restricted to one specific admin account, since removing an unpublished
 * submission is lower-stakes than publishing one community-wide. */
export async function deleteCommunityEvent(eventId) {
  const { error } = await supabase.from('community_events').delete().eq('id', eventId);
  if (error) throw error;
}

/** Fetch every RSVP row (event_id, email) across all events. RLS scopes this
 * to signed-in, approved members only. Used to compute both real per-event
 * attendance counts and "have I RSVP'd" client-side. */
export async function fetchEventRsvps() {
  const { data, error } = await supabase.from('event_rsvps').select('event_id, email');
  if (error) throw error;
  return data || [];
}

/** RSVPs the current member to the given event (by its stable numeric id in
 * community_events). Idempotent - re-calling for an already-RSVP'd event/member
 * pair is a harmless no-op server-side. */
export async function rsvpForEvent(eventId) {
  const { error } = await supabase.rpc('rsvp_for_event', { p_event_id: eventId });
  if (error) throw error;
}

/** Removes the current member's own RSVP from the given event. Idempotent -
 * a no-op if they hadn't RSVP'd in the first place. */
export async function unrsvpFromEvent(eventId) {
  const { error } = await supabase.rpc('unrsvp_from_event', { p_event_id: eventId });
  if (error) throw error;
}
