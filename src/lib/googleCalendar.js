// Google Calendar API helper
// Uses the provider_token (Google OAuth access token) from Supabase session
// to fetch events from the authenticated user's Google Calendar.

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
    htmlLink: event.htmlLink, // Direct link to open in Google Calendar
  };
}

/**
 * Format an ISO datetime string into a human-readable format.
 */
function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  });
}
