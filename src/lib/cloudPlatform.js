// Azure / AWS switch for every roadmap (supabase/028_roadmap.sql keeps the
// choice; awsEquivalents.js holds the Azure -> AWS table).
//
// The database keeps one canonical row per slot, always titled with the
// Azure cert ("AZ-900"), and stamps each row with the platform it is being
// worked on under ('Azure' or 'AWS'). Nothing in the database is ever
// renamed, so every server-side rule that counts Core Foundations by title
// keeps working untouched. This file is the display layer: it shows a row
// stamped 'AWS' as its AWS equivalent.
//
// Rows a member has already finished keep the platform they were finished
// on, so switching to AWS never relabels an AZ-900 they actually passed as
// an AWS cert they never sat.

import { AZURE_TO_AWS } from './awsEquivalents';

export const CLOUD_PLATFORMS = ['Azure', 'AWS'];
export const DEFAULT_CLOUD_PLATFORM = 'Azure';

/** The Azure titles that have an AWS equivalent. */
export const CLOUD_VARIANT_TITLES = Object.keys(AZURE_TO_AWS);

export const isCloudVariantTitle = (title) => Object.prototype.hasOwnProperty.call(AZURE_TO_AWS, title);

/** The title to show for a slot title on a given platform. */
export function displayTitleFor(title, platform) {
  return platform === 'AWS' && isCloudVariantTitle(title) ? AZURE_TO_AWS[title] : title;
}

/**
 * One member's roadmap rows as they should be shown. Each row's `title` is
 * swapped for its AWS equivalent when the row is stamped 'AWS' (`slotTitle`
 * keeps the canonical title, which catalog checks and the pathway engine
 * match on). Where two rows land on the same AWS cert in the same
 * category - every Microsoft security cert maps to the one AWS Security
 * Specialty - only one is shown: a finished row wins, otherwise the first.
 * The rest stay in the database, hidden, so switching back loses nothing.
 */
export function applyCloudPlatform(items) {
  const shown = (items || []).map((item) => ({
    ...item,
    slotTitle: item.title,
    title: displayTitleFor(item.title, item.platform),
  }));
  const winners = new Map();
  shown.forEach((item) => {
    const key = `${item.memberEmail || ''}|${item.phase}|${item.category}|${item.title}`;
    const current = winners.get(key);
    if (!current || (!current.completed && item.completed)) winners.set(key, item);
  });
  return shown.filter((item) => winners.get(`${item.memberEmail || ''}|${item.phase}|${item.category}|${item.title}`) === item);
}

/** The platform a member is working on, from their profile value. */
export const normalizeCloudPlatform = (value) => (value === 'AWS' ? 'AWS' : DEFAULT_CLOUD_PLATFORM);

/**
 * Local-only version of the server switch, for demo sessions: every
 * unfinished Azure-capable row takes the chosen platform.
 */
export function switchItemsPlatform(items, platform) {
  const next = normalizeCloudPlatform(platform);
  return (items || []).map((item) => (
    isCloudVariantTitle(item.title) && !item.completed ? { ...item, platform: next } : item
  ));
}
