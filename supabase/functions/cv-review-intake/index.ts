// Hacking Hub Admin Dashboard - Free CV Review intake
//
// Deploy with: supabase functions deploy cv-review-intake --no-verify-jwt
// Run 110_cv_review_requests.sql first. Uses secrets that are already set:
//   RESEND_API_KEY (shared with every other Resend-based function)
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Called from the public site's cv-review.html with a multipart form (no
// sign-in, hence --no-verify-jwt). Emails the CV to the founder as an
// attachment, with reply-to set to the visitor, and adds them to the Sales
// Pipeline through _intake_pipeline_lead() (106) as a "Free CV review" lead.
// The page then sends the visitor to Cal.com to book the 15-minute results
// call - the Cal.com booking itself arrives through cal-booking-webhook as
// usual.
//
// The CV is never written to storage or the database. Because this URL is
// public, it refuses: anything not from hackinghub.co.za (CORS, and an
// Origin check since CORS alone doesn't stop a script), a filled-in
// honeypot field, files over 5 MB or that aren't really a PDF or Word file
// (checked by their first bytes, not just the name), a second request from
// the same email within 30 days, and more than 3 requests a day from one
// network (cv_review_requests, 110).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Hacking Hub CV Review <siya@hackinghub.co.za>';
const RECIPIENT = 'siya@hackinghub.co.za';
const ALLOWED_ORIGINS = ['https://hackinghub.co.za', 'https://www.hackinghub.co.za'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_COOLDOWN_DAYS = 30;
const MAX_PER_IP_PER_DAY = 3;

// First bytes of each accepted format: PDF, DOCX (a zip), legacy DOC (OLE).
const FILE_TYPES = [
  { ext: 'pdf', mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [0x50, 0x4b, 0x03, 0x04] },
  { ext: 'doc', mime: 'application/msword', magic: [0xd0, 0xcf, 0x11, 0xe0] },
];

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function clean(value: FormDataEntryValue | null, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
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
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    console.error('cv-review-intake: missing required secrets');
    return json({ error: 'The CV review is unavailable right now. Please email your CV to siya@hackinghub.co.za instead.' }, 500);
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_BYTES + 100_000) return json({ error: 'Your CV must be 5 MB or smaller.' }, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Something was wrong with the form. Please try again.' }, 400);
  }

  // Honeypot: a field real visitors never see. Pretend it worked.
  if (clean(form.get('website'), 200)) return json({ ok: true });

  const name = clean(form.get('name'), 100);
  const email = clean(form.get('email'), 200).toLowerCase();
  const targetRole = clean(form.get('target_role'), 100);
  const situation = clean(form.get('situation'), 60);
  const consent = clean(form.get('consent'), 10);
  const file = form.get('cv');

  if (!name) return json({ error: 'Please enter your name.' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (consent !== 'yes') return json({ error: 'Please tick the box to agree to us reviewing your CV.' }, 400);
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Please attach your CV.' }, 400);
  if (file.size > MAX_FILE_BYTES) return json({ error: 'Your CV must be 5 MB or smaller.' }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const type = FILE_TYPES.find((t) => t.ext === ext && t.magic.every((b, i) => bytes[i] === b));
  if (!type) return json({ error: 'Please upload your CV as a PDF or Word document.' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const ipHash = await sha256(`cv-review:${ip}:${serviceRoleKey.slice(-16)}`);

  const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ count: emailCount, error: emailErr }, { count: ipCount, error: ipErr }] = await Promise.all([
    admin.from('cv_review_requests').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since(EMAIL_COOLDOWN_DAYS)),
    admin.from('cv_review_requests').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since(1)),
  ]);
  if (emailErr || ipErr) {
    console.error('cv-review-intake: rate-limit lookup failed', emailErr?.message || ipErr?.message);
    return json({ error: 'The CV review is unavailable right now. Please email your CV to siya@hackinghub.co.za instead.' }, 500);
  }
  if ((emailCount || 0) > 0) {
    return json({ error: `We already have a CV from this email address in the last ${EMAIL_COOLDOWN_DAYS} days. Book your results call below if you haven't yet.`, alreadySent: true }, 429);
  }
  if ((ipCount || 0) >= MAX_PER_IP_PER_DAY) {
    return json({ error: 'Too many CVs have been sent from this network today. Please try again tomorrow.' }, 429);
  }

  const safeName = name.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().replace(/\s+/g, '-') || 'cv';
  const html = `
    <p>New free CV review request:</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td>${esc(name)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td>${esc(email)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Target role</td><td>${esc(targetRole || 'Not given')}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Situation</td><td>${esc(situation || 'Not given')}</td></tr>
    </table>
    <p>Their CV is attached. They've been sent to Cal.com to book a 15-minute results call, so look out for the booking.</p>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: RECIPIENT,
      reply_to: email,
      subject: `Free CV review: ${name}${targetRole ? ` (${targetRole})` : ''}`,
      html,
      attachments: [{ filename: `CV-${safeName}.${type.ext}`, content: toBase64(bytes) }],
    }),
  });
  if (!res.ok) {
    console.error('cv-review-intake: Resend failed', res.status, await res.text());
    return json({ error: "We couldn't send your CV just now. Please try again, or email it to siya@hackinghub.co.za." }, 502);
  }

  const { error: logErr } = await admin.from('cv_review_requests').insert({ email, ip_hash: ipHash });
  if (logErr) console.error('cv-review-intake: logging request failed', logErr.message);
  await admin.from('cv_review_requests').delete().lt('created_at', since(90));

  const notes = [targetRole && `Target role: ${targetRole}`, situation && `Situation: ${situation}`].filter(Boolean).join('\n');
  const { error: leadErr } = await admin.rpc('_intake_pipeline_lead', {
    p_ref: `cv_review:${email}:${new Date().toISOString().slice(0, 10)}`,
    p_source: 'Free CV review',
    p_name: name,
    p_email: email,
    p_phone: null,
    p_notes: notes || null,
    p_skip_existing_members: true,
  });
  if (leadErr) console.error('cv-review-intake: pipeline intake failed', leadErr.message);

  return json({ ok: true });
});
