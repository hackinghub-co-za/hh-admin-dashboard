// Hacking Hub Admin Dashboard - Role Quiz lead intake
//
// Deploy with: supabase functions deploy role-quiz-lead --no-verify-jwt
// Run 113_role_quiz_leads.sql first. No secrets beyond the injected
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
//
// Called from the public site's role-quiz.html (no sign-in, hence
// --no-verify-jwt) when someone finishes the quiz and enters their first
// name, email and phone number to see their result. Adds them to the Sales
// Pipeline through _intake_pipeline_lead() (106) as a "Role quiz" lead, with
// their matched role in the card's notes, so the founder can follow up.
// Current members are skipped, and a repeat from the same email on the same
// day is a no-op (the ref).
//
// Because this URL is public, it refuses anything not from hackinghub.co.za
// (CORS plus an Origin check), a filled-in honeypot field, a missing
// marketing consent, and more than 5 submissions a day from one network
// (role_quiz_lead_requests, 113).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://hackinghub.co.za', 'https://www.hackinghub.co.za'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PER_IP_PER_DAY = 5;
const MAX_BODY_BYTES = 5_000;

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// South African numbers become +27XXXXXXXXX; anything else keeps its own
// country code. Returns '' if it doesn't look like a phone number.
function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(digits)) return '+27' + digits.slice(1);
  if (/^27\d{9}$/.test(digits)) return '+' + digits;
  if (/^\+\d{9,15}$/.test(digits)) return digits;
  return '';
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Not allowed' }, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('role-quiz-lead: missing required secrets');
    return json({ error: 'Not configured' }, 500);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Body too large' }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Something was wrong with the form. Please try again.' }, 400);
  }

  // Honeypot: a field real visitors never see. Pretend it worked.
  if (clean(body.website, 200)) return json({ ok: true });

  const firstName = clean(body.first_name, 60);
  const email = clean(body.email, 200).toLowerCase();
  const phone = normalisePhone(clean(body.phone, 40));
  const role = clean(body.role, 100);
  const matchPct = Math.max(0, Math.min(100, Math.round(Number(body.match_pct) || 0)));
  const runnerUp = clean(body.runner_up, 100);

  if (!firstName) return json({ error: 'Please enter your first name.' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (!phone) return json({ error: 'Please enter a valid phone number, e.g. 082 123 4567.' }, 400);
  if (body.consent !== true) return json({ error: 'Please tick the box so we can send you your results.' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256(`role-quiz:${ip}:${serviceRoleKey.slice(-16)}`);
  const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  const { count, error: countErr } = await admin
    .from('role_quiz_lead_requests')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since(1));
  if (countErr) {
    console.error('role-quiz-lead: rate-limit lookup failed', countErr.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
  if ((count || 0) >= MAX_PER_IP_PER_DAY) {
    return json({ error: 'Too many quiz results have been sent from this network today. Please try again tomorrow.' }, 429);
  }

  const notes = [
    role && `Matched role: ${role}${matchPct ? ` (${matchPct}%)` : ''}`,
    runnerUp && `Runner-up: ${runnerUp}`,
    'Agreed to be contacted by email, phone or WhatsApp about their results.',
  ].filter(Boolean).join('\n');

  const { error: leadErr } = await admin.rpc('_intake_pipeline_lead', {
    p_ref: `role_quiz:${email}:${new Date().toISOString().slice(0, 10)}`,
    p_source: 'Role quiz',
    p_name: firstName,
    p_email: email,
    p_phone: phone,
    p_notes: notes,
    p_skip_existing_members: true,
  });
  if (leadErr) {
    console.error('role-quiz-lead: pipeline intake failed', leadErr.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }

  const { error: logErr } = await admin.from('role_quiz_lead_requests').insert({ ip_hash: ipHash });
  if (logErr) console.error('role-quiz-lead: logging request failed', logErr.message);
  await admin.from('role_quiz_lead_requests').delete().lt('created_at', since(90));

  return json({ ok: true });
});
