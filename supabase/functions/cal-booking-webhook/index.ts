// Hacking Hub Admin Dashboard - Cal.com booking webhook -> Sales Pipeline
//
// Deploy with: supabase functions deploy cal-booking-webhook --no-verify-jwt
// Requires this secret set first (the same value goes into Cal.com's
// webhook "Secret" field):
//   supabase secrets set CAL_WEBHOOK_SECRET=<a long random string>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Cal.com calls this each time someone books the 15-minute call (the
// Permanent Access intro call, cal.com/siya-gladile-yabcoe/15min). Cal.com
// signs every request with HMAC-SHA256 of the raw body, keyed by the webhook
// secret, in the x-cal-signature-256 header - anything unsigned or signed
// with a different secret is refused, so the public URL cannot be used to
// fill the pipeline. A valid booking becomes a Lead through
// _intake_pipeline_lead() (106_pipeline_lead_intake.sql): one card per
// email, a repeat booking adds a dated note, and a booking from someone who
// is already a current member is ignored.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Event type slugs that count as a Permanent Access call. Bookings of any
// other Cal.com event type are acknowledged and ignored.
const COUNTED_EVENT_SLUGS = ['15min'];
const SOURCE_LABEL = 'Permanent Access call booking';
const MAX_BODY_BYTES = 100_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function formatSast(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d) + ' SAST';
}

// Booking-form answers beyond name and email (a phone number, any extra
// questions added to the Cal.com booking form) become lines in the card's notes.
const SKIPPED_RESPONSES = new Set(['name', 'email', 'attendeePhoneNumber', 'location', 'guests', 'rescheduleReason']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('CAL_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    console.error('cal-booking-webhook: missing required secrets');
    return json({ error: 'Not configured' }, 500);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Body too large' }, 413);

  const sent = (req.headers.get('x-cal-signature-256') || '').toLowerCase();
  if (!sent || !safeEqual(sent, await hmacHex(secret, raw))) return json({ error: 'Unauthorized' }, 401);

  let body: { triggerEvent?: string; payload?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // Cal.com's "Ping test" and any other trigger just get a success reply.
  if (body.triggerEvent !== 'BOOKING_CREATED') return json({ action: 'ignored', reason: body.triggerEvent || 'no trigger' });

  const payload = body.payload || {};
  const slug = text(payload.type, 100);
  if (!COUNTED_EVENT_SLUGS.includes(slug)) return json({ action: 'ignored', reason: 'event type' });

  const attendees = Array.isArray(payload.attendees) ? (payload.attendees as Record<string, unknown>[]) : [];
  const guest = attendees[0] || {};
  const responses = (payload.responses && typeof payload.responses === 'object' ? payload.responses : {}) as Record<string, { value?: unknown }>;

  const email = text(guest.email, 200).toLowerCase() || text(responses.email?.value, 200).toLowerCase();
  const name = text(guest.name, 200) || text(responses.name?.value, 200);
  const phone = text(responses.attendeePhoneNumber?.value, 60) || text(guest.phoneNumber, 60);
  const uid = text(payload.uid, 200) || String(payload.bookingId || '');
  if (!uid) return json({ error: 'No booking id' }, 400);
  if (!email && !name) return json({ error: 'No attendee' }, 400);

  const title = text(payload.eventTitle, 200) || text(payload.title, 200);
  const start = text(payload.startTime, 60);
  const lines = [`Booked${title ? ` "${title}"` : ''}${start ? ` for ${formatSast(start)}` : ''}.`];
  for (const [key, answer] of Object.entries(responses)) {
    const value = Array.isArray(answer?.value) ? (answer.value as unknown[]).join(', ') : text(answer?.value, 400);
    if (!SKIPPED_RESPONSES.has(key) && value) lines.push(`${key}: ${value}`);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await adminClient.rpc('_intake_pipeline_lead', {
    p_ref: `cal:${uid}`,
    p_source: SOURCE_LABEL,
    p_name: name || null,
    p_email: email || null,
    p_phone: phone || null,
    p_notes: lines.join('\n').slice(0, 2500),
    p_skip_existing_members: true,
  });
  if (error) {
    console.error('cal-booking-webhook: intake failed', error.message);
    return json({ error: 'Intake failed' }, 500);
  }
  return json(data);
});
