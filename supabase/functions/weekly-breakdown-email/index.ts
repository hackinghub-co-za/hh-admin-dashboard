// Hacking Hub Admin Dashboard - Weekly Incident Breakdown Send
//
// Deploy with: supabase functions deploy weekly-breakdown-email --no-verify-jwt
// Requires these secrets (all already set for the other email functions):
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
//   supabase secrets set CRON_SECRET=<the same random string>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// The SOC track's Friday ritual. Triggered by pg_cron at 06:00 UTC every
// Friday (= 08:00 SAST) - see supabase/069_weekly_breakdown_cron.sql.
//
// This function does NOT write or generate anything member-facing. A
// facilitator has already drafted the breakdown into weekly_breakdowns and
// a Community Manager or the founder has already flipped it to 'Approved'.
// All this does is:
//   1. ask the DB for an Approved edition dated today
//   2. if there isn't one -> email the founder "nothing went out", stop
//   3. mail the blurb + a read-it link to every active, opted-in member
//   4. post the same blurb as a community_broadcasts row (in-app copy)
//   5. mark the edition 'Sent' with the recipient count
//
// Unlike roadmap-reminder-email there's no Gemini call - the content is
// identical for everyone and already written. Simpler = more reliable for
// a ~94-recipient all-hands send.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const ADMIN_ALERT_EMAIL = 'siya@hackinghub.co.za';
const PORTAL_URL = 'https://portal.hackinghub.co.za';
const RESEND_BATCH_LIMIT = 100; // Resend's hard cap per POST /emails/batch call

async function sendOne(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, to: toEmail, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
}

// Resend's batch endpoint - up to 100 messages per call, each fully
// independent (its own `to` and `html`). Returns how many it accepted.
async function sendBatch(
  resendApiKey: string,
  messages: { to: string; subject: string; html: string }[],
): Promise<number> {
  let accepted = 0;
  for (let i = 0; i < messages.length; i += RESEND_BATCH_LIMIT) {
    const chunk = messages.slice(i, i + RESEND_BATCH_LIMIT);
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.map((m) => ({ from: FROM_ADDRESS, to: m.to, subject: m.subject, html: m.html }))),
    });
    if (!res.ok) {
      throw new Error(`Resend batch failed at offset ${i}: ${res.status} ${await res.text()}`);
    }
    const json = await res.json();
    accepted += Array.isArray(json?.data) ? json.data.length : chunk.length;
  }
  return accepted;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The email itself: Gemma's intro, the blurb, one prominent "read it"
// button, nothing more. Deliberately short - the point is to get them into
// the portal, not to reproduce the whole breakdown in an inbox.
function breakdownEmailHtml(
  firstName: string,
  title: string,
  sourceLabel: string | null,
  difficulty: string | null,
  blurb: string,
  readUrl: string,
  unsubscribeUrl: string,
): string {
  const meta = [sourceLabel, difficulty].filter(Boolean).join(' &middot; ');
  return `
    <p>Hi ${esc(firstName)},</p>
    <p>This week's incident breakdown is up: <strong>${esc(title)}</strong>${meta ? ` <span style="color:#888;">(${meta})</span>` : ''}.</p>
    <p>${esc(blurb).replace(/\n/g, '<br>')}</p>
    <p style="margin:24px 0;">
      <a href="${readUrl}" style="display:inline-block;background:#17954f;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Read the full breakdown</a>
    </p>
    <p style="color:#888;font-size:13px;">It's also on the <strong>Breakdowns</strong> tab in the portal, along with every past edition.</p>
    <p>&mdash; Gemma</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
    <p style="font-size:12px;color:#888;">You're getting this as an active Hacking Hub member. <a href="${unsubscribeUrl}">Unsubscribe from breakdowns</a>.</p>
  `;
}

function noSendAlertHtml(sendDate: string): string {
  return `
    <p><strong>No weekly breakdown went out today (${sendDate}).</strong></p>
    <p>The Friday send ran on schedule but found no <code>Approved</code> edition for today's date in <code>weekly_breakdowns</code>, so nothing was mailed to members and no broadcast was posted.</p>
    <p>If that's intentional (a skipped week), nothing to do. If not, approve this week's draft and send it manually.</p>
  `;
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
    console.error('weekly-breakdown-email: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // "Today" in UTC - the cron fires at 06:00 UTC Friday, so this is the
  // Friday date the facilitator set as send_date.
  const today = new Date().toISOString().slice(0, 10);

  const { data: editions, error: editionErr } = await admin
    .rpc('get_approved_breakdown_for_date', { p_send_date: today });
  if (editionErr) {
    console.error('weekly-breakdown-email: lookup failed', editionErr.message);
    return new Response('Lookup failed', { status: 500 });
  }

  const edition = Array.isArray(editions) ? editions[0] : editions;

  if (!edition) {
    // Nothing approved for today - a missed week should be a known miss.
    try {
      await sendOne(resendKey, ADMIN_ALERT_EMAIL, `No breakdown went out today (${today})`, noSendAlertHtml(today));
    } catch (e) {
      console.error('weekly-breakdown-email: even the no-send alert failed', e instanceof Error ? e.message : e);
    }
    return new Response(JSON.stringify({ sent: 0, reason: 'no approved edition for today' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: recipients, error: recErr } = await admin.rpc('get_breakdown_recipients');
  if (recErr) {
    console.error('weekly-breakdown-email: recipient query failed', recErr.message);
    return new Response('Recipient query failed', { status: 500 });
  }

  const readUrl = (edition.full_url && /^https?:\/\//.test(edition.full_url)) ? edition.full_url : PORTAL_URL;
  const subject = `HH SOC Breakdown: ${edition.title}`;

  const messages = (recipients || []).map((r: { email: string; full_name: string | null }) => {
    const firstName = (r.full_name || '').trim().split(' ')[0] || 'there';
    const unsubscribeUrl = `${supabaseUrl}/functions/v1/breakdown-unsubscribe?email=${encodeURIComponent(r.email)}`;
    return {
      to: r.email,
      subject,
      html: breakdownEmailHtml(firstName, edition.title, edition.source_label, edition.difficulty, edition.blurb, readUrl, unsubscribeUrl),
    };
  });

  let accepted = 0;
  try {
    accepted = await sendBatch(resendKey, messages);
  } catch (e) {
    console.error('weekly-breakdown-email: batch send failed', e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: 'send failed', accepted }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // In-app copy: a broadcast row so it shows on the dashboard feed too.
  // The member dashboard rotates through EVERY active broadcast, so retire
  // last week's auto-posted breakdown first - exactly one is ever live, and
  // the standing hand-curated broadcasts are untouched (created_by differs).
  const { error: retireErr } = await admin
    .from('community_broadcasts')
    .update({ active: false })
    .eq('created_by', 'weekly-breakdown-email')
    .eq('active', true);
  if (retireErr) {
    console.error('weekly-breakdown-email: retiring old breakdown broadcast failed (non-fatal)', retireErr.message);
  }

  let broadcastId: number | null = null;
  const { data: bRow, error: bErr } = await admin
    .from('community_broadcasts')
    .insert({
      emoji: '🛡️',
      title: `This week's breakdown: ${edition.title}`,
      body: `${edition.blurb}${edition.full_url ? '' : '  Read the full write-up on the Breakdowns tab.'}`,
      sort_order: 5,
      created_by: 'weekly-breakdown-email',
    })
    .select('id')
    .single();
  if (bErr) {
    console.error('weekly-breakdown-email: broadcast insert failed (non-fatal)', bErr.message);
  } else {
    broadcastId = bRow?.id ?? null;
  }

  const { error: markErr } = await admin.rpc('mark_weekly_breakdown_sent', {
    p_id: edition.id, p_recipient_count: accepted, p_broadcast_id: broadcastId,
  });
  if (markErr) {
    console.error('weekly-breakdown-email: mark_sent failed - edition stays Approved, risks a resend next Friday if send_date matches', markErr.message);
  }

  return new Response(JSON.stringify({ sent: accepted, editionId: edition.id, broadcastId }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
