// Hacking Hub Admin Dashboard - Free LinkedIn Review intake
//
// Deploy with: supabase functions deploy linkedin-review-intake --no-verify-jwt
// Run 117_career_services.sql first. Uses RESEND_API_KEY, already set for
// the other email functions. (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically.)
//
// Called from the public site's linkedin-review.html (no sign-in, hence
// --no-verify-jwt) with JSON: full name, email, phone, LinkedIn profile URL,
// target role, situation, and two required ticks: agreeing to the review and
// contact, and agreeing that the review may be used for Hacking Hub content.
// Saves a row in career_service_requests (the admin portal's Career Services
// tab), adds a "Free LinkedIn review" lead to the Sales Pipeline through
// _intake_pipeline_lead() (106), and emails the founder the details with
// reply-to the visitor. The page then sends them to Cal.com to book the
// 15-minute review call.
//
// Because this URL is public, it refuses: anything not from hackinghub.co.za
// (CORS, plus an Origin check since CORS alone doesn't stop a script), a
// filled-in honeypot field, a profile link that isn't a linkedin.com/in/
// URL, a second request from the same email within 30 days, and more than 3
// requests a day from one network.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Hacking Hub LinkedIn Review <siya@hackinghub.co.za>';
const RECIPIENT = 'siya@hackinghub.co.za';
const ALLOWED_ORIGINS = ['https://hackinghub.co.za', 'https://www.hackinghub.co.za'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_COOLDOWN_DAYS = 30;
const MAX_PER_IP_PER_DAY = 3;
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

// Accepts "linkedin.com/in/name", "www.linkedin.com/in/name/" or a full
// https URL (any country subdomain), and returns https://www.linkedin.com/in/name.
function normaliseLinkedIn(raw: string): string {
  const m = raw.trim().match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%.]{2,100})\/?(?:[?#].*)?$/i);
  return m ? `https://www.linkedin.com/in/${m[1]}` : '';
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  const unavailable = 'The LinkedIn review is unavailable right now. Please email your profile link to siya@hackinghub.co.za instead.';

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Not allowed' }, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    console.error('linkedin-review-intake: missing required secrets');
    return json({ error: unavailable }, 500);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Something was wrong with the form. Please try again.' }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Something was wrong with the form. Please try again.' }, 400);
  }

  // Honeypot: a field real visitors never see. Pretend it worked.
  if (clean(body.website, 200)) return json({ ok: true });

  const name = clean(body.name, 100);
  const email = clean(body.email, 200).toLowerCase();
  const phone = normalisePhone(clean(body.phone, 40));
  const linkedin = normaliseLinkedIn(clean(body.linkedin_url, 300));
  const targetRole = clean(body.target_role, 100);
  const situation = clean(body.situation, 60);

  if (!name) return json({ error: 'Please enter your full name.' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (!phone) return json({ error: 'Please enter a valid phone number.' }, 400);
  if (!linkedin) return json({ error: 'Please paste the link to your LinkedIn profile. It looks like linkedin.com/in/your-name.' }, 400);
  if (body.consent !== true) return json({ error: 'Please tick the box to agree to us reviewing your profile.' }, 400);
  if (body.content_consent !== true) return json({ error: 'Please tick the box to agree that your review may be used for our content.' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256(`linkedin-review:${ip}:${serviceRoleKey.slice(-16)}`);
  const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ count: emailCount, error: emailErr }, { count: ipCount, error: ipErr }] = await Promise.all([
    admin.from('career_service_requests').select('id', { count: 'exact', head: true }).eq('service', 'LinkedIn review').eq('email', email).gte('created_at', since(EMAIL_COOLDOWN_DAYS)),
    admin.from('career_service_requests').select('id', { count: 'exact', head: true }).eq('service', 'LinkedIn review').eq('ip_hash', ipHash).gte('created_at', since(1)),
  ]);
  if (emailErr || ipErr) {
    console.error('linkedin-review-intake: rate-limit lookup failed', emailErr?.message || ipErr?.message);
    return json({ error: unavailable }, 500);
  }
  if ((emailCount || 0) > 0) {
    return json({ error: `We already have a LinkedIn review request from this email in the last ${EMAIL_COOLDOWN_DAYS} days. Book your review call below if you haven't yet.`, alreadySent: true }, 429);
  }
  if ((ipCount || 0) >= MAX_PER_IP_PER_DAY) {
    return json({ error: 'Too many requests have been sent from this network today. Please try again tomorrow.' }, 429);
  }

  const { error: saveErr } = await admin.from('career_service_requests').insert({
    service: 'LinkedIn review',
    full_name: name,
    email,
    phone,
    linkedin_url: linkedin,
    target_role: targetRole || null,
    situation: situation || null,
    content_consent: true,
    ip_hash: ipHash,
  });
  if (saveErr) {
    console.error('linkedin-review-intake: saving request failed', saveErr.message);
    return json({ error: unavailable }, 500);
  }
  // The privacy policy promises the hashed network address is kept 90 days.
  await admin.from('career_service_requests').update({ ip_hash: null }).lt('created_at', since(90)).not('ip_hash', 'is', null);

  const notes = [`LinkedIn: ${linkedin}`, targetRole && `Target role: ${targetRole}`, situation && `Situation: ${situation}`, 'Agreed their review may be used for content.']
    .filter(Boolean).join('\n');
  const { error: leadErr } = await admin.rpc('_intake_pipeline_lead', {
    p_ref: `linkedin_review:${email}:${new Date().toISOString().slice(0, 10)}`,
    p_source: 'Free LinkedIn review',
    p_name: name,
    p_email: email,
    p_phone: phone,
    p_notes: notes,
    p_skip_existing_members: true,
  });
  if (leadErr) console.error('linkedin-review-intake: pipeline intake failed', leadErr.message);

  const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td>${v}</td></tr>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: RECIPIENT,
      reply_to: email,
      subject: `Free LinkedIn review: ${name}${targetRole ? ` (${targetRole})` : ''}`,
      html: `
        <p>New free LinkedIn review request:</p>
        <table style="border-collapse:collapse;font-size:14px">
          ${row('Name', esc(name))}
          ${row('Email', esc(email))}
          ${row('Phone', esc(phone))}
          ${row('LinkedIn', `<a href="${esc(linkedin)}">${esc(linkedin)}</a>`)}
          ${row('Target role', esc(targetRole || 'Not given'))}
          ${row('Situation', esc(situation || 'Not given'))}
          ${row('Content', 'Agreed their review may be used for Hacking Hub content')}
        </table>
        <p>They've been sent to Cal.com to book a 15-minute review call. It's also on the Career Services tab in the portal.</p>`,
    }),
  });
  // The request is already saved, so a failed alert doesn't fail the form.
  if (!res.ok) console.error('linkedin-review-intake: founder email failed', res.status, await res.text());

  return json({ ok: true });
});
