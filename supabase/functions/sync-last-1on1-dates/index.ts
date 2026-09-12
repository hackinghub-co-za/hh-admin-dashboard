// Hacking Hub Admin Dashboard - Daily Calendar Sync for Last 1-on-1 Dates
//
// Deploy with: supabase functions deploy sync-last-1on1-dates --no-verify-jwt
// Requires these secrets set first:
//   supabase secrets set GOOGLE_TOKEN_ENCRYPTION_KEY=<same value store-calendar-sync-token uses>
//   supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<the web app's own Google OAuth client ID>
//   supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=<the web app's own Google OAuth client secret>
//   supabase secrets set CRON_SECRET=<same value the other crons use>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Triggered daily by pg_cron (074_calendar_sync_cron.sql), 30 minutes
// before overdue-1on1-digest-daily so that email reflects the same
// morning's fresh data. Server-side twin of handleSyncLastMeetings
// (AdminDashboard.jsx's "Sync Last 1on1 Dates" button): for every staff
// member who's granted consent (calendar_sync_tokens,
// 073_admin_calendar_sync.sql), refreshes a real access token, pulls their
// past Calendar events since 2026-01-01 (same window and endpoint shape as
// fetchPastCalendarEvents in src/lib/googleCalendar.js), and matches every
// event's attendees by email - not by event title or any booking-tool
// naming convention, so a manually-titled recurring meeting (e.g. one with
// no "Booked by" metadata) is caught here exactly like any other. Results
// replace calendar_synced_meetings wholesale each run (_replace_calendar_
// synced_meetings) so a cancelled/rescheduled occurrence never leaves a
// stale row behind. A refresh failure for one staff member (revoked grant,
// expired refresh token) is logged and skipped - it must never abort the
// run for other staff.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
// Same fixed window start as the manual "Sync Last 1on1 Dates" button
// (handleSyncLastMeetings) so the two sources stay directly comparable.
const SINCE_DATE = '2026-01-01T00:00:00Z';

interface CalendarEvent {
  status?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: { email?: string; organizer?: boolean }[];
}

async function refreshGoogleAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

async function fetchPastEvents(accessToken: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: SINCE_DATE,
    timeMax: new Date().toISOString(),
    maxResults: '250',
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const res = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
  const json = await res.json();
  return json.items || [];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encryptionKey = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY');
  const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!encryptionKey || !googleClientId || !googleClientSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('sync-last-1on1-dates: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: tokenRows, error: tokenError } = await adminClient.rpc('_get_all_decrypted_calendar_sync_tokens', {
    p_key: encryptionKey,
  });
  if (tokenError) {
    console.error('sync-last-1on1-dates: token lookup failed', tokenError.message);
    return new Response('Token lookup failed', { status: 500 });
  }

  const staff: { email: string; refresh_token: string }[] = tokenRows || [];
  if (staff.length === 0) {
    return new Response(JSON.stringify({ staffSynced: 0, meetingRows: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = new Map<string, { member_email: string; meeting_date: string }>();
  let staffSynced = 0;

  for (const member of staff) {
    let events: CalendarEvent[];
    try {
      const accessToken = await refreshGoogleAccessToken(member.refresh_token, googleClientId, googleClientSecret);
      events = await fetchPastEvents(accessToken);
    } catch (err) {
      console.error(`sync-last-1on1-dates: calendar lookup failed for ${member.email}`, err instanceof Error ? err.message : err);
      continue;
    }

    staffSynced += 1;

    events
      .filter((evt) => evt.status !== 'cancelled')
      .forEach((evt) => {
        const start = evt.start?.dateTime || evt.start?.date;
        if (!start) return;
        const meetingDate = start.slice(0, 10);
        (evt.attendees || [])
          .filter((a) => !a.organizer && a.email)
          .forEach((a) => {
            const memberEmail = (a.email as string).toLowerCase();
            rows.set(`${memberEmail}|${meetingDate}`, { member_email: memberEmail, meeting_date: meetingDate });
          });
      });
  }

  const { error: replaceError } = await adminClient.rpc('_replace_calendar_synced_meetings', {
    p_rows: Array.from(rows.values()),
  });
  if (replaceError) {
    console.error('sync-last-1on1-dates: replace failed', replaceError.message);
    return new Response('Replace failed', { status: 500 });
  }

  return new Response(JSON.stringify({ staffSynced, meetingRows: rows.size }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
