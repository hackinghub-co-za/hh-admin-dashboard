// Kept in the same vocabulary as ROADMAP_TRACKS below so a member's
// self-described specialty badge and their coach-assigned roadmap track
// always mean the same thing - these used to diverge (Red Team/Blue Team
// here vs Offensive Security/SOC there, DevSecOps missing entirely), which
// made it easy to assign a specialty that didn't match the actual roadmap
// track. GRC now has a roadmap track counterpart too (see ROADMAP_TRACKS
// and SPECIALIZATION_CATALOGS.GRC below).
export const SPECIALTIES = ['Not Set', 'SOC', 'Offensive Security', 'Cloud Security', 'DevSecOps', 'IAM', 'AI Security', 'GRC'];
export const JOB_READINESS_STAGES = ['Not Started', 'In Progress', 'Interview Ready', 'Job Placed'];
export const GENDERS = ['Male', 'Female'];
export const LOCATIONS = [
  'Cape Town',
  'Johannesburg',
  'Durban',
  'Pretoria',
  'Other (SA)',
  'Other (Rest of the World)',
];
export const AGES = ['16-18', '18-21', '21-24', '24-27', '27-30', '30-35', '35-40', '40+'];
// 'Active' is auto-flagged "Lapsed" after LAPSED_AFTER_DAYS with no payment.
// 'Active (Permanent)' is exempt from that check entirely - for members who've paid
// in full or are otherwise not expected to pay again. 'Leaving' is a grace period -
// access control still lets them sign in (only 'Left' actually blocks), but they see
// a farewell/exit-feedback screen instead of the normal portal; submitting or
// skipping that finalizes them to 'Left'. 'Left' can also be set directly for an
// immediate cutoff with no grace period.
export const MEMBERSHIP_STATUSES = ['Active', 'Active (Permanent)', 'Leaving', 'Left'];

export const OFFBOARDING_REASONS = [
  'Financial constraints',
  'Time constraints',
  'Achieved goals / graduated',
  'Not engaging',
  'Found opportunities elsewhere',
  'Other',
];
export const EMPLOYMENT_STATUSES = ['Not Set', 'Employed', 'Unemployed', 'Student'];
export const MEMBERSHIP_TIERS = ['Basic Access', 'Monthly Operative', 'Permanent Access', 'Custom Plan', 'Maintenance Fee'];

// The learning path a coach assigns a member to - drives which checklist shows
// up under "My Roadmap". Distinct from SPECIALTIES above (that's the member's
// own self-described directory badge); this one is coach-assigned.
export const ROADMAP_TRACKS = ['Not Assigned', 'SOC', 'Offensive Security', 'Cloud Security', 'DevSecOps', 'IAM', 'AI Security', 'GRC'];
export const ROADMAP_PHASES = ['Core Foundations', 'Specialization'];

// The standard Core Foundations "Certifications" catalog every assigned
// roadmap draws from, regardless of track - a member needs at least
// CORE_FOUNDATIONS_MIN_REQUIRED of these done before their Core Foundations
// certs count as complete. Specialization stays fully track-specific beyond
// this, with its own courses/certs.
export const CORE_FOUNDATIONS_CATALOG = [
  { title: 'CISCO Junior Cyber Pathway', defaultDetail: '6/6 courses' },
  { title: 'Immersive Labs', defaultDetail: '20 collections' },
  { title: 'TryHackMe Pre-Security', defaultDetail: '' },
  { title: 'TryHackMe Cyber 101', defaultDetail: '' },
  { title: 'AZ-900', defaultDetail: '' },
  { title: 'AI-901', defaultDetail: '' },
  { title: 'SC-900', defaultDetail: '' },
  { title: 'CompTIA Security+', defaultDetail: '' },
];
export const CORE_FOUNDATIONS_MIN_REQUIRED = 4;

// A member only sees their Specialization section once they've completed
// this many Core Foundations certs - a higher bar than
// CORE_FOUNDATIONS_MIN_REQUIRED (which just marks foundations as "met"),
// deliberately: Specialization stays hidden a little longer than the
// minimum, so it reads as something earned rather than available from day
// one.
export const SPECIALIZATION_UNLOCK_MIN = 5;

// Standard Specialization catalogs, by roadmap_track and the category name
// each track's specialization items are grouped under. Only tracks with a
// defined catalog here get the admin "Add Standard Specialization"
// quick-fill.
export const SPECIALIZATION_CATALOGS = {
  SOC: {
    category: 'SOC',
    items: [
      { title: 'CySA+', defaultDetail: '' },
      { title: 'SC-200', defaultDetail: '' },
      { title: 'THM SOC Level 1', defaultDetail: '' },
      { title: 'Blue Team Level 1', defaultDetail: '' },
    ],
  },
  'Offensive Security': {
    category: 'Pen Testing',
    items: [
      { title: 'eJPT', defaultDetail: '' },
      { title: 'THM Junior Pentester', defaultDetail: '' },
      { title: 'THM Offensive Pentesting', defaultDetail: '' },
      { title: 'Burp Suite Certified Practitioner', defaultDetail: '' },
      { title: 'OSCP', defaultDetail: '' },
    ],
  },
  'Cloud Security': {
    category: 'Cloud Security',
    items: [
      { title: 'AZ-104', defaultDetail: '' },
      { title: 'SC-200', defaultDetail: '' },
      { title: 'SC-500', defaultDetail: '' },
      { title: 'Terraform Associate', defaultDetail: '' },
      { title: 'SC-100', defaultDetail: '' },
      { title: 'AZ-305', defaultDetail: '' },
    ],
  },
  DevSecOps: {
    category: 'DevSecOps',
    items: [
      { title: 'Linux Essentials', defaultDetail: '' },
      { title: 'GH-900', defaultDetail: '' },
      { title: 'GH-500', defaultDetail: '' },
      { title: 'KCNA', defaultDetail: '' },
      { title: 'KCSA', defaultDetail: '' },
      { title: 'Terraform Associate', defaultDetail: '' },
      { title: 'AZ-104', defaultDetail: '' },
      { title: 'AZ-400', defaultDetail: '' },
      { title: 'SC-500', defaultDetail: '' },
      { title: 'Python (or any programming language)', defaultDetail: 'Optional' },
    ],
  },
  GRC: {
    category: 'GRC',
    items: [
      { title: 'ISO/IEC 27001 Foundation', defaultDetail: '' },
      { title: 'NIST Cybersecurity Framework (CSF)', defaultDetail: '' },
      { title: 'ISC2 CGRC', defaultDetail: '' },
      { title: 'ISACA CRISC', defaultDetail: '' },
      { title: 'POPIA/GDPR Practitioner', defaultDetail: '' },
      { title: 'ITIL 4 Foundation', defaultDetail: '' },
    ],
  },
};

// A member is flagged "Lapsed" if they haven't paid in this many days and haven't
// been explicitly marked Active or Left by an admin - a nudge to go check on them,
// not a verdict.
export const LAPSED_AFTER_DAYS = 45;

// A member's "Last 1on1 Meeting" is flagged once it's this many days old.
export const MEETING_OVERDUE_AFTER_DAYS = 30;

// A member's roadmap is flagged "gone quiet" once the most recent item
// update is this many days old - shared by the member-facing dashboard
// banner and the admin Stale Roadmaps queue so both sides agree on what
// "stale" means.
export const ROADMAP_STALE_AFTER_DAYS = 14;

// The email escalation (supabase/functions/roadmap-reminder-email) is a
// full checkpoint cadence, not a single threshold like the in-app nudge
// above - fully computed inside get_stale_roadmap_members_for_reminder()
// in 028_roadmap.sql, which can't import this file (separate Deno/Postgres
// runtime), so these exist here purely as documentation for any future
// client-side UI that wants to reference the same numbers, not as values
// anything actually reads from at send-time.
export const ROADMAP_REMINDER_CHECKPOINTS_DAYS = [7, 14, 21, 30];
export const ROADMAP_NEWCOMER_REMINDER_INTERVAL_DAYS = 3;
export const ROADMAP_NEWCOMER_WINDOW_DAYS = 30;
export const ROADMAP_DISENGAGEMENT_ALERT_AFTER_DAYS = 21;

// ============================================================================
// MEMBERS DIRECTORY - GROUPED BY DOMAIN VIEW
// ============================================================================

// The Team - founder + mentors, shown in their own group ahead of the
// Specialization tracks in both the admin and member Members views. Small
// and rarely changes membership, so it's a plain constant here rather than
// a database table or admin-editable setting - the same "just hardcode it,
// it barely changes" treatment gemma-chat/index.ts's FAQ_KNOWLEDGE gives
// mentor info. Same four people as the real MENTORS list in
// MemberPortal.jsx's Book a 1on1 screen. Nokulunga's real email isn't
// confirmed yet (2026-08) - add her here once it is; until then she just
// won't show up in this grouped view, same as anyone else with no matching
// row. Extend this array (by email, lowercase) as mentors change - the
// display name always comes from that person's own real profile, never
// duplicated here.
export const TEAM_MEMBERS = [
  { email: 'siya@hackinghub.co.za', role: 'Founder' },
  { email: 'nonhlanhlakamangethe@gmail.com', role: 'Community Mentor · Data Security & AI' },
  { email: 'kmchunu029@gmail.com', role: 'Community Mentor · Red Teaming' },
];

// One accent hue per track, reused for both the compact group card's accent
// border and its avatar-stack tint - keeps a track visually identifiable at
// a glance across the whole grouped view. Offensive Security gets the
// product's own accent-cyan since it's the flagship track; the rest are
// hues already used elsewhere in this app (release-note group colors) so
// nothing here is a freshly invented palette.
export const TRACK_COLORS = {
  'Offensive Security': '#5ee37a',
  'SOC': '#3b82f6',
  'Cloud Security': '#22d3ee',
  'DevSecOps': '#a78bfa',
  'IAM': '#f5b942',
  'AI Security': '#f472b6',
  'GRC': '#fb923c',
};
export const OTHER_GROUP_COLOR = '#94a3b8';
export const TEAM_GROUP_COLOR = '#f5b942';

/**
 * Splits a flat member list into { team, tracks, other } for the grouped
 * directory view - team matched by email against TEAM_MEMBERS, then each
 * real ROADMAP_TRACKS entry (excluding the "Not Assigned" placeholder
 * value), then "other" for anyone left with no track assigned at all.
 * `getEmail`/`getTrack` adapt this to whichever shape of member object the
 * caller has (the admin roster and the member-facing directory use
 * different field names for the same underlying data).
 */
export function groupMembersByDomain(members, getEmail, getTrack) {
  const teamEmails = new Set(TEAM_MEMBERS.map((t) => t.email.toLowerCase()));
  const team = [];
  const tracks = {};
  ROADMAP_TRACKS.filter((t) => t !== 'Not Assigned').forEach((t) => { tracks[t] = []; });
  const other = [];

  (members || []).forEach((m) => {
    const email = (getEmail(m) || '').toLowerCase();
    if (teamEmails.has(email)) {
      team.push(m);
      return;
    }
    const track = getTrack(m);
    if (track && tracks[track]) {
      tracks[track].push(m);
    } else {
      other.push(m);
    }
  });

  return { team, tracks, other };
}
