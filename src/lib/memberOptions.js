// Kept in the same vocabulary as ROADMAP_TRACKS below so a member's
// self-described specialty badge and their coach-assigned roadmap track
// always mean the same thing - these used to diverge (Red Team/Blue Team
// here vs Offensive Security/SOC there, DevSecOps missing entirely), which
// made it easy to assign a specialty that didn't match the actual roadmap
// track. GRC has no roadmap track counterpart (no catalog defined for it)
// but stays as a specialty option since it's a real, distinct area members
// describe themselves with.
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
export const ROADMAP_TRACKS = ['Not Assigned', 'SOC', 'Offensive Security', 'Cloud Security', 'DevSecOps', 'IAM', 'AI Security'];
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

// The email escalation (supabase/functions/roadmap-reminder-email) only
// fires at a longer threshold than the in-app nudge above - email is for
// someone who's genuinely stopped opening the portal, not everyone who
// crosses the softer in-app threshold. Keep this in sync with
// EMAIL_REMINDER_AFTER_DAYS in that function - it can't literally import
// this file (separate Deno runtime).
export const ROADMAP_EMAIL_REMINDER_AFTER_DAYS = 30;
