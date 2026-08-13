// Google Calendar API helper
// Uses the provider_token (Google OAuth access token) from Supabase session
// to fetch events from the authenticated user's Google Calendar.

import { formatDate } from './dateFormat';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Fetch upcoming calendar events for the authenticated user.
 * @param {string} accessToken - Google OAuth access token from Supabase session.
 * @param {object} options - Query options.
 * @param {number} options.maxResults - Maximum number of events to return (default: 20).
 * @param {string} options.query - Optional search query to filter events (e.g., "1on1").
 * @param {string} options.calendarId - Calendar ID (default: 'primary').
 * @returns {Promise<Array>} - Array of calendar event objects.
 */
export async function fetchCalendarEvents(accessToken, options = {}) {
  const {
    maxResults = 20,
    query = '',
    calendarId = 'primary',
  } = options;

  const now = new Date().toISOString();
  const params = new URLSearchParams({
    timeMin: now,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (query) {
    params.set('q', query);
  }

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.items || []).map(formatEvent);
}

/**
 * Fetch past calendar events (up to now) so each event's attendees can be matched
 * against a member's email to find their most recent meeting date. Google's Calendar
 * API has no "most recent per attendee" query, so this pulls the whole window once
 * and the caller reduces it client-side.
 * @param {string} accessToken - Google OAuth access token from Supabase session.
 * @param {object} options - Query options.
 * @param {string} options.sinceDate - ISO date to search from (default: 1 year ago).
 * @param {number} options.maxResults - Maximum number of events to return (default: 250).
 * @param {string} options.calendarId - Calendar ID (default: 'primary').
 * @returns {Promise<Array>} - Array of calendar event objects, oldest first.
 */
export async function fetchPastCalendarEvents(accessToken, options = {}) {
  const {
    sinceDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    maxResults = 250,
    calendarId = 'primary',
  } = options;

  const params = new URLSearchParams({
    timeMin: sinceDate,
    timeMax: new Date().toISOString(),
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.items || [])
    .map(formatEvent)
    .filter(evt => evt.status !== 'cancelled');
}

/**
 * Fetch all calendars owned or subscribed by the user.
 */
export async function fetchUserCalendars(accessToken) {
  const url = `${CALENDAR_API_BASE}/users/me/calendarList`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Failed to fetch user calendars: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Fetch events specifically from the "HH Certifications" Google Calendar.
 * Falls back to searching the primary calendar for "Cert" if no dedicated calendar is found.
 */
export async function fetchCertCalendarEvents(accessToken) {
  try {
    const calendars = await fetchUserCalendars(accessToken);
    // Find calendar named "HH Certifications" or similar
    const hhCertCalendar = calendars.find(
      c => c.summary && c.summary.toLowerCase().trim() === 'hh certifications'
    ) || calendars.find(
      c => c.summary && c.summary.toLowerCase().includes('certification')
    );

    const calendarId = hhCertCalendar ? hhCertCalendar.id : 'primary';
    const query = hhCertCalendar ? '' : 'Cert';

    return await fetchCalendarEvents(accessToken, { calendarId, query });
  } catch (err) {
    console.warn('Falling back to primary calendar search for Certifications:', err);
    return await fetchCalendarEvents(accessToken, { calendarId: 'primary', query: 'Cert' });
  }
}

/**
 * Format a raw Google Calendar event into a cleaner structure.
 */
function formatEvent(event) {
  const start = event.start?.dateTime || event.start?.date || '';
  const end = event.end?.dateTime || event.end?.date || '';

  // Extract attendees (excluding the organizer)
  const attendees = (event.attendees || [])
    .filter(a => !a.organizer)
    .map(a => ({
      email: a.email,
      name: a.displayName || a.email.split('@')[0],
      status: a.responseStatus, // 'accepted', 'declined', 'tentative', 'needsAction'
    }));

  return {
    id: event.id,
    title: event.summary || 'Untitled Event',
    description: event.description || '',
    start,
    end,
    startFormatted: formatDateTime(start),
    endFormatted: formatDateTime(end),
    location: event.location || '',
    meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || '',
    status: event.status, // 'confirmed', 'tentative', 'cancelled'
    attendees,
    organizerEmail: (event.organizer?.email || '').toLowerCase(),
    htmlLink: event.htmlLink, // Direct link to open in Google Calendar
  };
}

/**
 * Finds the soonest upcoming event organized by a specific email (e.g. the
 * member's next 1on1, which shows up on their own calendar as an event siya
 * organized and invited them to). `events` should already be sorted
 * soonest-first (fetchCalendarEvents orders by startTime). Only considers
 * events starting within `withinDays` days from now - a meeting further out
 * than that isn't "next" in any useful sense for a dashboard widget.
 */
export function findNextMeetingWithOrganizer(events, organizerEmail, withinDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const targetEmail = organizerEmail.toLowerCase();
  return (
    events.find((evt) => {
      if (evt.organizerEmail !== targetEmail || evt.status === 'cancelled' || !evt.start) return false;
      const startDate = new Date(evt.start);
      return startDate <= cutoff;
    }) || null
  );
}

/**
 * Format an ISO datetime string into a human-readable format.
 */
function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const weekday = date.toLocaleString('en-ZA', { weekday: 'short', timeZone: 'Africa/Johannesburg' });
  const time = date.toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });
  return `${weekday}, ${formatDate(date)}, ${time}`;
}
