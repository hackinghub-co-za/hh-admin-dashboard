// Hacking Hub Admin Dashboard - Weekly LinkedIn Post Reminder
//
// Deploy with: supabase functions deploy linkedin-post-reminder-email --no-verify-jwt
// Requires:
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
//   supabase secrets set CRON_SECRET=<same value roadmap-reminder-email uses, or a new one>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Reaches members who haven't clicked "Mark as Posted This Week" in the
// portal yet, telling them exactly what to post - their track's
// current-week example post. No Gemini here (unlike roadmap-reminder-email):
// the content is already fixed/written per track/week, so this is a plain
// templated email, same "plain and factual" shape as
// matchmaker-group-email's groupEmailHtml().
//
// The actual post text is read from linkedin_playbook_posts
// (059_linkedin_weekly_post.sql) via the service-role client below, NOT
// hardcoded here - it used to be a hand-kept duplicate of
// src/lib/linkedInPlaybookData.js's DOMAIN_CONTENT (Deno edge functions
// can't import from the React app's src/ tree), which meant editing one
// copy and forgetting the other silently left this email quoting a stale
// post while the in-app widget showed the current one. WEEKLY_THEMES below
// stays a small hardcoded copy (just theme name + isNetworkingWeek, 12
// short entries) - low churn, and this email doesn't need the longer
// per-theme description the in-app guide shows.
//
// Triggered weekly by pg_cron (see the cron block at the bottom of
// supabase/059_linkedin_weekly_post.sql).
// --no-verify-jwt is required because pg_cron's http call carries no
// Supabase user JWT - CRON_SECRET below is what stops anyone who finds
// this URL from mass-triggering member emails on demand, same reasoning as
// roadmap-reminder-email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const PORTAL_URL = 'https://portal.hackinghub.co.za';
const MAX_EMAILS_PER_RUN = 100;

// Theme name + whether it's a network-growth week - must match
// src/lib/linkedInPlaybookData.js WEEKLY_THEMES exactly, same order.
const WEEKLY_THEMES: { theme: string; isNetworkingWeek: boolean }[] = [
  { theme: 'Introduce Yourself', isNetworkingWeek: false },
  { theme: 'Build in Public', isNetworkingWeek: false },
  { theme: 'Skill Spotlight', isNetworkingWeek: false },
  { theme: 'Grow Your Network', isNetworkingWeek: true },
  { theme: 'Lesson Learned', isNetworkingWeek: false },
  { theme: 'Milestone', isNetworkingWeek: false },
  { theme: 'Industry News Reaction', isNetworkingWeek: false },
  { theme: 'Grow Your Network + Engage', isNetworkingWeek: true },
  { theme: 'Deep-Dive', isNetworkingWeek: false },
  { theme: 'Opinion / Hot Take', isNetworkingWeek: false },
  { theme: 'Grow Your Network + Give Back', isNetworkingWeek: true },
  { theme: 'Reflect & Recap', isNetworkingWeek: false },
];

function getCurrentWeekIndex(): number {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return (isoWeek - 1) % 12;
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

function reminderEmailHtml(firstName: string, weekNumber: number, theme: string, post: string, isNetworkingWeek: boolean, unsubscribeUrl: string): string {
  return `
    <p>Hi ${firstName},</p>
    <p>You haven't posted on LinkedIn yet this week - Week ${weekNumber} of your 12-week plan is <strong>${theme}</strong>:</p>
    <p style="padding:14px 16px;background:#f4f4f4;border-radius:6px;">${post}</p>
    ${isNetworkingWeek ? '<p>This is also a network-growth week - send 15-20 personalized connection requests to people in your target role.</p>' : ''}
    <p>Write it in your own words - one post is enough to stay visible to recruiters, takes 10 minutes.</p>
    <p style="margin:22px 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Open your roadmap</a>
    </p>
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
    <p style="font-size:12px;color:#888;">Don't want these? <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>
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

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!resendKey || !supabaseUrl || !serviceRoleKey) {
    console.error('linkedin-post-reminder-email: missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: members, error: queryError } = await adminClient.rpc('get_members_needing_linkedin_reminder');
  if (queryError) {
    console.error('linkedin-post-reminder-email: query failed', queryError.message);
    return new Response('Query failed', { status: 500 });
  }

  const weekIndex = getCurrentWeekIndex();
  const { theme, isNetworkingWeek } = WEEKLY_THEMES[weekIndex];

  // This week's post for every track in one query, rather than one query
  // per member - linkedin_playbook_posts (059_linkedin_weekly_post.sql) is
  // the same table the in-app widget/guide read from, so this can never
  // drift from what a member sees in the portal the way the old hardcoded
  // DOMAIN_CONTENT copy could.
  const { data: weekPosts, error: postsError } = await adminClient
    .from('linkedin_playbook_posts')
    .select('roadmap_track, post_text')
    .eq('week_index', weekIndex);
  if (postsError) {
    console.error('linkedin-post-reminder-email: fetching posts failed', postsError.message);
    return new Response('Fetching posts failed', { status: 500 });
  }
  const postByTrack: Record<string, string> = Object.fromEntries(
    (weekPosts || []).map((row: { roadmap_track: string; post_text: string }) => [row.roadmap_track, row.post_text])
  );

  const targets = (members || []).slice(0, MAX_EMAILS_PER_RUN);
  let sent = 0;
  const failures: string[] = [];

  for (const member of targets) {
    try {
      const post = postByTrack[member.roadmap_track] || postByTrack.SOC;
      const firstName = (member.full_name || '').trim().split(' ')[0] || 'there';
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/linkedin-reminder-unsubscribe?email=${encodeURIComponent(member.email)}`;

      await sendEmail(
        resendKey,
        member.email,
        "This week's LinkedIn post - what to write",
        reminderEmailHtml(firstName, weekIndex + 1, theme, post, isNetworkingWeek, unsubscribeUrl)
      );
      sent += 1;
    } catch (err) {
      console.error(`linkedin-post-reminder-email: failed for ${member.email}`, err instanceof Error ? err.message : err);
      failures.push(member.email);
      // Keep going - one member's Resend hiccup shouldn't block everyone
      // else's reminder for the week.
    }
  }

  return new Response(JSON.stringify({ candidates: targets.length, sent, failed: failures }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
