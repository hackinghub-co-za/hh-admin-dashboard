// Pathway configuration for each Specialization track (see pathway.js).
//
// The track catalogs (SPECIALIZATION_CATALOGS in memberOptions.js) list what
// a member does but not how long it takes, so this file holds the one table
// of planning estimates the lane view needs. Treat every number here as a
// starting guess to be tuned from real completion times:
//   - certificate study time is in WEEKS at the standard six-hour pace
//     (three-and-a-half hours of certificate study a week, like a Core
//     sprint), so a 6-week entry is a 6-week sprint at the default pace;
//   - lab and course time is in HOURS.
// Only CySA+, SC-200 and Terraform Associate come from the in-app study
// guides (the middle of their published 4-12, 4-12 and 4-8 week ranges).
// Everything else is sized by exam level.

import { SPECIALIZATION_CATALOGS, PROJECTS_UNLOCK_PERCENT } from './memberOptions';
import { CORE_CONFIG } from './pathway';

// Study weeks by exam level.
const FOUNDATION = 3;
const ASSOCIATE = 6;
const PROFESSIONAL = 8;
const ADVANCED = 10;

export const CERT_STUDY_WEEKS = {
  'CySA+': 8, // in-app guide: 4 to 12 weeks
  'SC-200': 8, // in-app guide: 4 to 12 weeks
  'Terraform Associate': 6, // in-app guide: 4 to 8 weeks
  eJPT: ASSOCIATE,
  'Burp Suite Certified Practitioner': PROFESSIONAL,
  OSCP: 16,
  'AZ-104': PROFESSIONAL,
  'SC-500': PROFESSIONAL,
  'SC-100': PROFESSIONAL,
  'AZ-305': PROFESSIONAL,
  'AZ-400': PROFESSIONAL,
  'Linux Essentials': FOUNDATION,
  'GH-900': FOUNDATION,
  'GH-500': 4,
  KCNA: 4,
  KCSA: 4,
  CDP: PROFESSIONAL,
  'ISO/IEC 27001 Foundation': FOUNDATION,
  'ISACA IT Risk Fundamentals': FOUNDATION,
  'POPIA/GDPR Practitioner': FOUNDATION,
  'ITIL 4 Foundation': FOUNDATION,
  'ISC2 CGRC': ADVANCED,
  'ISACA CRISC': ADVANCED,
  'SC-300': ASSOCIATE,
  'Okta Certified Professional': ASSOCIATE,
  'CyberArk Defender': ASSOCIATE,
  'SailPoint Certified Identity Security Administrator': ASSOCIATE,
  'AI-103': ASSOCIATE,
  'CompTIA SecAI+': ASSOCIATE,
  CCNA: ADVANCED,
  'Fortinet NSE 4': ASSOCIATE,
  'Palo Alto Networks PCNSA': ASSOCIATE,
  'Wireshark Certified Network Analyst (WCNA)': ASSOCIATE,
};
const DEFAULT_CERT_WEEKS = ASSOCIATE;

// Hands-on paths, courses and self-study. These run in the labs lane.
export const LAB_STUDY_HOURS = {
  'THM SOC Level 1': 30,
  'Blue Team Level 1': 40,
  'CISCO Cybersecurity Defense Analyst': 40,
  'THM Junior Pentester': 30,
  'THM Offensive Pentesting': 40,
  'THM Active Directory Basics': 6,
  'THM AI Security': 12,
  'OWASP Top 10 for LLM Applications': 10,
  'TryHackMe Network Fundamentals': 6,
  'NIST Cybersecurity Framework (CSF)': 12,
  'Python (or any programming language)': 30,
};
const DEFAULT_LAB_HOURS = 20;

/** Study time at the standard pace, as the certificate hours the engine wants. */
const certHoursFor = (weeks) => weeks * 3.5;

/** Whether a track item belongs in the labs lane (hands-on or self-study) rather than the certificate lane. */
export const isLabItem = (title) => title in LAB_STUDY_HOURS;

export const TRACKS_WITH_PATHWAY = Object.keys(SPECIALIZATION_CATALOGS);

/**
 * The pathway config for one track, or null if the track has no catalog.
 * Milestones follow the portal's real rules: Projects unlocks at half the
 * track done, and the track is complete when every item is.
 */
export function buildTrackConfig(track) {
  const catalog = SPECIALIZATION_CATALOGS[track];
  if (!catalog?.items?.length) return null;
  const titles = catalog.items.map((i) => i.title);
  const labs = {};
  const certs = {};
  titles.forEach((t) => {
    if (isLabItem(t)) labs[t] = LAB_STUDY_HOURS[t] ?? DEFAULT_LAB_HOURS;
    else certs[t] = certHoursFor(CERT_STUDY_WEEKS[t] ?? DEFAULT_CERT_WEEKS);
  });
  const half = Math.max(1, Math.ceil((titles.length * PROJECTS_UNLOCK_PERCENT) / 100));
  const milestones = [{ at: half, label: 'Projects unlock' }];
  if (titles.length > half) milestones.push({ at: titles.length, label: 'Track complete' });
  return {
    key: `track:${track}`,
    labs,
    certs,
    defaultCertStarts: null,
    catalogTitles: titles,
    milestones,
    advice: () => [],
  };
}

export { CORE_CONFIG };
