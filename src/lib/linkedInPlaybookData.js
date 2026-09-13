// Shared structure/helpers for The Hacking Hub LinkedIn Playbook - a
// 12-week posting plan (a full quarter, no fast repeat), one real example
// post per week per specialty track. Pure helpers, no Supabase calls -
// read by both LinkedInPlaybookModal.jsx (the full guide) and
// MemberPortal.jsx (the inline "This Week" widget on the roadmap's "Post
// once a week" item), so there's exactly one source of truth for what
// "this week" means.
//
// The 84 actual example posts themselves live in the linkedin_playbook_posts
// table (059_linkedin_weekly_post.sql), fetched via
// linkedInPlaybookPostsData.js - NOT hardcoded here. They used to be a
// plain exported const, hand-duplicated into
// supabase/functions/linkedin-post-reminder-email/index.ts (an edge
// function can't import from src/), which meant editing one copy and
// forgetting the other silently left the reminder email quoting a stale
// post while the in-app widget showed the current one. Moving the actual
// post content into one real table both sides read closes that gap for
// good - only WEEKLY_THEMES/THEME_DESCRIPTIONS/DOMAIN_HASHTAGS below stay
// as plain static content, since those were never duplicated anywhere
// else and rarely change.

// Weeks 4, 8, and 11 are dedicated network-growth checkpoints: send 15-20
// PERSONALIZED connection requests to people in your target role/field that
// week. Deliberately not "mass connect everyone" - LinkedIn restricts
// accounts that send bulk unpersonalized invites, and an obviously-spammed
// connection reads badly to the exact recruiters this whole playbook is
// trying to impress. Aggressive and consistent beats reckless.
export const WEEKLY_THEMES = [
  { week: 1, theme: 'Introduce Yourself', isNetworkingWeek: false },
  { week: 2, theme: 'Build in Public', isNetworkingWeek: false },
  { week: 3, theme: 'Skill Spotlight', isNetworkingWeek: false },
  { week: 4, theme: 'Grow Your Network', isNetworkingWeek: true },
  { week: 5, theme: 'Lesson Learned', isNetworkingWeek: false },
  { week: 6, theme: 'Milestone', isNetworkingWeek: false },
  { week: 7, theme: 'Industry News Reaction', isNetworkingWeek: false },
  { week: 8, theme: 'Grow Your Network + Engage', isNetworkingWeek: true },
  { week: 9, theme: 'Deep-Dive', isNetworkingWeek: false },
  { week: 10, theme: 'Opinion / Hot Take', isNetworkingWeek: false },
  { week: 11, theme: 'Grow Your Network + Give Back', isNetworkingWeek: true },
  { week: 12, theme: 'Reflect & Recap', isNetworkingWeek: false },
];

export const THEME_DESCRIPTIONS = {
  'Introduce Yourself': "Say who you are, why this field, and what you're working toward - sets the tone for everything that follows.",
  'Build in Public': 'Show something real you did this week, not just that you studied - a room, a lab, a config, a writeup.',
  'Skill Spotlight': 'Explain one specific tool or technique in plain language - teaching it is the fastest way to prove you understand it.',
  'Grow Your Network': "Send 15-20 personalized connection requests this week to people in your target role - analysts, recruiters, hiring managers. A short, specific note beats a blank request every time.",
  'Lesson Learned': 'Something that tripped you up this week, and what it taught you - more relatable (and more memorable) than a highlight reel.',
  Milestone: 'A cert or course completed, or a competition placement - contextualized with what it actually took, not just a badge screenshot.',
  'Industry News Reaction': "React to real, current news in your field - shows recruiters you're plugged into the industry, not just working through a syllabus.",
  'Grow Your Network + Engage': 'Another 15-20 personalized connection requests, plus 5 genuine comments on other people\'s posts this week - a real question or your own experience, not just "Great post!"',
  'Deep-Dive': 'A longer, detailed technical walkthrough - the most substantial "proof of work" post of the cycle.',
  'Opinion / Hot Take': 'A respectful, informed opinion on a real debate in your field - shows independent thinking, not just information recall.',
  'Grow Your Network + Give Back': "A third round of personalized connection requests, to people at companies/teams you're specifically interested in - paired with sharing a genuinely useful free resource for beginners.",
  'Reflect & Recap': "A \"here's what changed\" post looking back on the last 3 months - closes the arc. Once you finish Week 12, start back at Week 1.",
};

// Real, tailored hashtags per domain (memberOptions.js ROADMAP_TRACKS minus
// 'Not Assigned') - small and static, never duplicated anywhere else the
// way the 84 example posts were, so this stays plain hardcoded content.
export const DOMAIN_HASHTAGS = {
  SOC: '#SOCAnalyst #BlueTeam #ThreatDetection #SIEM #CyberSecurity',
  'Offensive Security': '#OffSec #RedTeam #Pentesting #CTF #EthicalHacking',
  'Cloud Security': '#CloudSecurity #AWS #Azure #GCP #CyberSecurity',
  DevSecOps: '#DevSecOps #AppSec #CICD #ShiftLeft #CyberSecurity',
  IAM: '#IAM #IdentitySecurity #ZeroTrust #AccessManagement',
  'AI Security': '#AISecurity #LLMSecurity #PromptInjection #AIRedTeam',
  GRC: '#GRC #RiskManagement #Compliance #ISO27001',
};

export const DOMAINS = Object.keys(DOMAIN_HASHTAGS);

// Standard ISO-8601 week number (1-53), UTC-based - matches Postgres's
// EXTRACT(week FROM ...), which is also ISO-8601. Both sides land on the
// same "which of the 12 weeks is it" answer without needing any per-member
// anchor date.
export function getIsoWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/** 0-11, index into WEEKLY_THEMES / the fetched posts-by-track map for "this week". */
export function getCurrentWeekIndex(date = new Date()) {
  return (getIsoWeekNumber(date) - 1) % 12;
}

/** Resolves a roadmapTrack (possibly null/'Not Assigned'/unrecognized) to a
 * valid domain key, falling back to 'SOC'. */
export function resolveDomain(roadmapTrack) {
  return roadmapTrack && DOMAIN_HASHTAGS[roadmapTrack] ? roadmapTrack : 'SOC';
}

/** This week's theme alone (no example post) - domain-independent, so this
 * never needs the fetched posts-by-track content. Used wherever only the
 * theme name matters (e.g. the admin LinkedIn Playbook Engagement panel). */
export function getCurrentWeekTheme(date = new Date()) {
  const idx = getCurrentWeekIndex(date);
  const { week, theme, isNetworkingWeek } = WEEKLY_THEMES[idx];
  return { week, theme, isNetworkingWeek, description: THEME_DESCRIPTIONS[theme] };
}

/** This week's theme + example post + hashtags for a given track.
 * postsByTrack is the fetched linkedin_playbook_posts content (see
 * linkedInPlaybookPostsData.js's fetchLinkedInPlaybookPosts) - the actual
 * post text now lives in that table, not hardcoded here, so it stays in
 * sync with what the reminder email edge function sends without a
 * hand-kept second copy. */
export function getCurrentWeekContent(postsByTrack, roadmapTrack, date = new Date()) {
  const idx = getCurrentWeekIndex(date);
  const domain = resolveDomain(roadmapTrack);
  const { week, theme, isNetworkingWeek } = getCurrentWeekTheme(date);
  return {
    week,
    theme,
    isNetworkingWeek,
    description: THEME_DESCRIPTIONS[theme],
    post: postsByTrack?.[domain]?.[idx] || '',
    hashtags: DOMAIN_HASHTAGS[domain],
    domain,
  };
}
