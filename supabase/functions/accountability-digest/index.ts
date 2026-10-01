// Hacking Hub Admin Dashboard - Accountability Check-ins daily digest
//
// Deploy with: supabase functions deploy accountability-digest --no-verify-jwt
// Uses the secrets already set for the other email functions (RESEND_API_KEY,
// CRON_SECRET) - no new ones needed.
//
// Triggered by pg_cron every morning at 07:00 SAST
// (092_accountability_digest_cron.sql). Emails the community manager(s) the
// members on the Accountability Check-ins list who haven't been checked in
// on within the last 7 days - same get_accountability_due() the admin tab's
// "Due Today" uses (091_accountability_checkins.sql), so they always agree.
//
// Unlike overdue-1on1-digest, this sends NOTHING on a morning where nobody's
// due: it's a to-do list for the community manager, and an empty one is
// noise. It also respects the on/off switch on the admin tab.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Hacking Hub <siya@hackinghub.co.za>';
const DUE_AFTER_DAYS = 7;
const PORTAL_URL = 'https://portal.hackinghub.co.za';

type DueRow = { email: string; full_name: string | null; specialty: string | null; last_checkin_at: string | null };

async function sendEmail(resendApiKey: string, to: string[], subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function lastCheckinLabel(iso: string | null): string {
  if (!iso) return 'Never checked in';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return `Last checked in ${days} day${days === 1 ? '' : 's'} ago`;
}

function digestHtml(rows: DueRow[]): string {
  const items = rows.map((r) => {
    const name = esc(r.full_name || r.email);
    const meta = [lastCheckinLabel(r.last_checkin_at), r.specialty && r.specialty !== 'Not Set' ? esc(r.specialty) : null]
      .filter(Boolean).join(' &middot; ');
    return `
      <div style="padding:14px 16px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;margin-bottom:12px;">
        <div style="font-weight:700;font-size:14px;color:#111827;">${name}</div>
        <div style="font-size:12px;color:#92400e;margin-top:2px;">${meta}</div>
      </div>`;
  }).join('');
  return `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;color:#374151;">
      <p style="font-size:14px;line-height:1.6;">Morning! Here's who hasn't been checked in on in over a week - a quick message goes a long way.</p>
      ${items}
      <a href="${PORTAL_URL}" style="display:inline-block;padding:11px 22px;border-radius:8px;background:#17a856;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;">Open Accountability Check-ins</a>
      <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:12px;">
        You're getting this because you're a Community Manager for Hacking Hub. Sent automatically every morning - nothing to reply to.
      </p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!resendKey || !supabaseUrl || !serviceRoleKey) {
    console.error('accountability-digest: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: settings } = await admin.from('accountability_settings').select('email_enabled').eq('id', 1).maybeSingle();
  if (settings && settings.email_enabled === false) {
    return new Response(JSON.stringify({ skipped: 'disabled' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const { data: rows, error } = await admin.rpc('get_accountability_due', { p_days: DUE_AFTER_DAYS });
  if (error) {
    console.error('accountability-digest: due lookup failed', error.message);
    return new Response('Lookup failed', { status: 500 });
  }
  if (!rows?.length) {
    return new Response(JSON.stringify({ dueCount: 0, sent: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const { data: recipientRows, error: recipientError } = await admin.rpc('get_accountability_digest_recipients');
  if (recipientError || !recipientRows?.length) {
    console.error('accountability-digest: recipient lookup failed', recipientError?.message);
    return new Response('Recipient lookup failed', { status: 500 });
  }
  const recipients = recipientRows.map((r: { email: string }) => r.email);

  const subject = `${rows.length} member${rows.length === 1 ? ' needs' : 's need'} a check-in today`;
  try {
    await sendEmail(resendKey, recipients, subject, digestHtml(rows as DueRow[]));
  } catch (e) {
    console.error('accountability-digest: send failed', e instanceof Error ? e.message : e);
    return new Response('Send failed', { status: 500 });
  }

  return new Response(JSON.stringify({ dueCount: rows.length, sent: true, recipients: recipients.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
