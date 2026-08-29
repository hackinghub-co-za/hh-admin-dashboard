// Hacking Hub Admin Dashboard - Roadmap "Gone Quiet" Email Reminder
//
// Deploy with: supabase functions deploy roadmap-reminder-email --no-verify-jwt
// Requires these secrets set first:
//   supabase secrets set GEMINI_API_KEY=<same key gemma-chat already uses>
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
//   supabase secrets set CRON_SECRET=<a random string you make up>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// You'll also need a domain verified in Resend to send from - update
// FROM_ADDRESS below once you have one.
//
// Feature C of the roadmap accountability plan: an email that reaches a
// member even if they've stopped opening the portal entirely - the one
// population the in-app "gone quiet" banner (Feature B, MemberPortal.jsx)
// structurally can't reach. Gemma writes every word (the same Gemini prompt
// pattern gemma-chat/index.ts uses); this function's only job is deciding
// who qualifies and sending what she wrote.
//
// Cadence (founder-specified, 2026-08) - fully computed by the
// get_stale_roadmap_members_for_reminder() database function, not this
// file: a newcomer (first 30 days) gets checked in every 3 days; everyone
// else gets exactly 4 touches, at day 7, 14, 21, and 30. Day 21 also
// triggers a separate, plain-text disengagement alert to
// ADMIN_ALERT_EMAIL - a human should know before a member quietly
// disappears, not just the member.
//
// Triggered daily by pg_cron (see supabase/047_roadmap_reminder_cron.sql).
// --no-verify-jwt is required because pg_cron's http call carries no
// Supabase user JWT - but unlike payfast-webhook there's no independent
// signature to verify the caller with, so CRON_SECRET below is what stops
// anyone who finds this URL from mass-triggering member emails on demand.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// See the matching comment in gemma-chat/index.ts - pinned to this specific
// version after live-testing on 2026-08-27 showed 'gemini-flash-latest'
// failing with 503 "high demand" on 5/5 tries, while this version succeeded
// immediately. Will need bumping again eventually when Google deprecates it.
const GEMINI_MODEL = 'gemini-3.6-flash';
const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const ADMIN_ALERT_EMAIL = 'siya@hackinghub.co.za';
// The actual member portal (hackinghub.co.za on its own is the marketing
// site, not this app - confirmed with founder). There's no client-side
// router in this app (App.jsx is plain activeTab state, no react-router) -
// no tab is deep-linkable, so this is the honest link: it lands on the
// login screen if signed out, or straight on the dashboard if the browser
// still has a session, either way one click closer than typing the URL
// from scratch.
const PORTAL_URL = 'https://portal.hackinghub.co.za';
const MAX_EMAILS_PER_RUN = 50; // a sanity ceiling, not an expected volume - stops one buggy run from mass-emailing the whole roster

function buildReminderPrompt(fullName: string | null, jobReadiness: string | null, daysSinceTouch: number, isNewcomer: boolean): string {
  const firstName = (fullName || '').trim().split(' ')[0] || 'there';
  const newcomerNote = isNewcomer
    ? "They're brand new (still in their first 30 days) - the tone should be extra encouraging and low-pressure, since this is likely just the very normal lull of getting settled, not a real warning sign yet."
    : "They've been a member for a while - a bit more directness is fine, but still never shaming.";
  return `You are Gemma, a friendly, sharp AI assistant embedded in the Hacking Hub member portal - a cybersecurity coaching community. Your voice is warm, a little playful, never corporate.

Write a short email body to a member named ${firstName} who hasn't touched their roadmap checklist in ${daysSinceTouch} days. Their job readiness stage is: ${jobReadiness || 'not started'}. ${newcomerNote}

Hard rules:
- Specific and constructive, always paired with one concrete next step (log back in and check off a single item - don't ask for more than that).
- Never harsh, never shaming, never guilt-tripping.
- Plain text, 3-4 sentences. No subject line, no "Hi ${firstName}," greeting, no sign-off - all three are added separately by the template.
- Write in Gemma's own voice, not a generic corporate reminder.`;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      // The ?key= query-param style only works with the old "standard key"
      // type - Google's phasing that out entirely by September 2026 in
      // favor of "auth keys" (what every new key from AI Studio is now),
      // which authenticate via this header instead. Same fix as gemma-chat.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return text.trim();
}

async function sendEmail(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: toEmail, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend request failed: ${res.status} ${text}`);
  }
}

function reminderEmailHtml(firstName: string, body: string, unsubscribeUrl: string): string {
  return `
    <p>Hi ${firstName},</p>
    <p>${body.replace(/\n/g, '<br>')}</p>
    <p>— Gemma</p>
    <p style="margin:22px 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Open your roadmap</a>
    </p>
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
    <p style="font-size:12px;color:#888;">Don't want these? <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>
  `;
}

// Plain and factual, not Gemma-voiced - this is an internal alert to a
// human, not a member-facing message, so it skips Gemini entirely (faster,
// more reliable, and there's nothing here that benefits from creative
// writing).
function disengagementAlertHtml(fullName: string | null, email: string, daysSinceTouch: number): string {
  const name = fullName || email;
  return `
    <p><strong>${name}</strong> (${email}) hasn't touched their roadmap in <strong>${daysSinceTouch} days</strong>.</p>
    <p>This crossed the 21-day disengagement threshold - worth a personal check-in before it becomes a churn number.</p>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!geminiKey || !resendKey || !supabaseUrl || !serviceRoleKey) {
    console.error('roadmap-reminder-email: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: staleMembers, error: queryError } = await adminClient.rpc('get_stale_roadmap_members_for_reminder');

  if (queryError) {
    console.error('roadmap-reminder-email: query failed', queryError.message);
    return new Response('Query failed', { status: 500 });
  }

  const targets = (staleMembers || []).slice(0, MAX_EMAILS_PER_RUN);
  let sent = 0;
  let alertsSent = 0;
  const failures: string[] = [];

  for (const member of targets) {
    try {
      const prompt = buildReminderPrompt(member.full_name, member.job_readiness, member.days_since_touch, member.is_newcomer);
      const body = await callGemini(geminiKey, prompt);
      const firstName = (member.full_name || '').trim().split(' ')[0] || 'there';
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/roadmap-reminder-unsubscribe?email=${encodeURIComponent(member.email)}`;

      await sendEmail(resendKey, member.email, 'Your Hacking Hub roadmap - checking in', reminderEmailHtml(firstName, body, unsubscribeUrl));

      const { error: markError } = await adminClient.rpc('mark_roadmap_reminder_sent', { p_email: member.email });
      if (markError) {
        // The email already went out - not marking it sent risks a
        // duplicate tomorrow, but it's not worth failing the whole run over
        // a logging write. Logged for follow-up instead.
        console.error(`roadmap-reminder-email: mark_roadmap_reminder_sent failed for ${member.email}`, markError.message);
      }
      sent += 1;

      if (member.needs_disengagement_alert) {
        try {
          await sendEmail(
            resendKey,
            ADMIN_ALERT_EMAIL,
            `⚠ ${member.full_name || member.email} has gone quiet (21 days)`,
            disengagementAlertHtml(member.full_name, member.email, member.days_since_touch)
          );
          const { error: alertMarkError } = await adminClient.rpc('mark_roadmap_disengagement_alert_sent', { p_email: member.email });
          if (alertMarkError) {
            console.error(`roadmap-reminder-email: mark_roadmap_disengagement_alert_sent failed for ${member.email}`, alertMarkError.message);
          }
          alertsSent += 1;
        } catch (alertErr) {
          // The member's own reminder already succeeded above - a failed
          // admin alert shouldn't be reported as a failure for this member.
          console.error(`roadmap-reminder-email: disengagement alert failed for ${member.email}`, alertErr instanceof Error ? alertErr.message : alertErr);
        }
      }
    } catch (err) {
      console.error(`roadmap-reminder-email: failed for ${member.email}`, err instanceof Error ? err.message : err);
      failures.push(member.email);
      // Keep going - one member's Gemini/Resend hiccup shouldn't block
      // everyone else's reminder for the day.
    }
  }

  return new Response(JSON.stringify({ candidates: targets.length, sent, alertsSent, failed: failures }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
