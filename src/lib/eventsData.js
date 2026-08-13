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
    .select('id, type, title, description, date, time, location, link, created_by, status')
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
    createdBy: row.created_by || '',
    status: row.status,
  }));
}

/** Adds a new community event, self-attributed to the current member (RLS
 * enforces created_by can only ever be the caller's own email). Always lands
 * as 'Pending' server-side regardless of what's sent - only visible to its
 * submitter and admins until approved via approveCommunityEvent(). */
export async function createCommunityEvent({ type, title, description, date, time, location, link, createdBy }) {
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
    createdBy: data.created_by || '',
    status: data.status,
  };
}

/** Approves a pending community event, making it visible to every member.
 * Server-side restricted to exactly siya@hackinghub.co.za regardless of who
 * calls this - not every admin account. */
export async function approveCommunityEvent(eventId) {
  const { error } = await supabase.rpc('approve_community_event', { p_event_id: eventId });
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
