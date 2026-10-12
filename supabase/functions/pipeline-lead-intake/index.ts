// Hacking Hub Admin Dashboard - Sales Pipeline lead intake
//
// Deploy with: supabase functions deploy pipeline-lead-intake --no-verify-jwt
// Requires this secret set first:
//   supabase secrets set PIPELINE_INTAKE_SECRET=<a long random string>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Receives Elite Operative applications from the Google Apps Script in
// scripts/google-apps-script/pipeline-leads.gs (attached to the application
// Google Form) and adds them to the Sales Pipeline through
// _intake_pipeline_lead() (106_pipeline_lead_intake.sql), which
// de-duplicates by email and by ref. Calls booked on Cal.com arrive through
// cal-booking-webhook instead. Anything that is not a POST with
// the shared secret in the x-intake-secret header is refused, so the public
// function URL cannot be used to fill the pipeline with junk.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SOURCES: Record<string, { label: string; skipMembers: boolean }> = {
  elite_application: { label: 'Elite Operative application', skipMembers: false },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 50_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('PIPELINE_INTAKE_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supabaseUrl || !serviceRoleKey) {
    console.error('pipeline-lead-intake: missing required secrets');
    return json({ error: 'Not configured' }, 500);
  }

  const sent = req.headers.get('x-intake-secret') || '';
  if (!safeEqual(sent, secret)) return json({ error: 'Unauthorized' }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Body too large' }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const source = SOURCES[clean(body.source, 40)];
  if (!source) return json({ error: 'Unknown source' }, 400);

  const ref = clean(body.ref, 200);
  if (!ref) return json({ error: 'ref is required' }, 400);

  const email = clean(body.email, 200).toLowerCase();
  if (email && !EMAIL_RE.test(email)) return json({ error: 'Invalid email' }, 400);
  const name = clean(body.name, 200);
  if (!email && !name) return json({ error: 'A name or an email is required' }, 400);
  const phone = clean(body.phone, 60);

  let notes = '';
  if (body.answers && typeof body.answers === 'object') {
    notes = Object.entries(body.answers as Record<string, unknown>)
      .map(([q, a]) => `${clean(q, 120)}: ${clean(Array.isArray(a) ? a.join(', ') : a, 400)}`)
      .join('\n')
      .slice(0, 2500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await adminClient.rpc('_intake_pipeline_lead', {
    p_ref: ref,
    p_source: source.label,
    p_name: name || null,
    p_email: email || null,
    p_phone: phone || null,
    p_notes: notes || null,
    p_skip_existing_members: source.skipMembers,
  });
  if (error) {
    console.error('pipeline-lead-intake: intake failed', error.message);
    return json({ error: 'Intake failed' }, 500);
  }
  return json(data);
});
