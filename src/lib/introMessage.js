// The introduction a new member posts in the community group, built from
// their profile. Follows the structure in the onboarding guide: a greeting,
// the goal, a line on their background and focus areas, then a LinkedIn link.

export const INTRO_GOALS = [
  'land my first cybersecurity role',
  'move from IT into cybersecurity',
  'get promoted into a security role',
];

export const INTRO_BACKGROUNDS = [
  "I'm currently working in IT",
  "I'm currently working outside IT",
  "I'm a recent graduate",
  "I'm between jobs",
];

export const INTRO_FOCUS_AREAS = ['SOC', 'Cloud Security', 'GRC', 'Pen testing', 'DevSecOps', 'AI Security'];

/** "SOC" -> "SOC", ["SOC", "GRC"] -> "SOC and GRC", three or more -> "A, B and C". */
export function joinWithAnd(items) {
  const list = (items || []).filter(Boolean);
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** First word of a full name, or '' if there is none. */
export function firstNameOf(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

/**
 * Focus areas to pre-select from the member's own track or specialty, so most
 * members only pick a goal. Anything not one of the six areas is ignored.
 */
export function suggestFocusAreas(track) {
  const t = String(track || '').toLowerCase();
  if (t.includes('soc')) return ['SOC'];
  if (t.includes('cloud')) return ['Cloud Security'];
  if (t.includes('grc')) return ['GRC'];
  if (t.includes('devsecops')) return ['DevSecOps'];
  if (t.includes('ai')) return ['AI Security'];
  if (t.includes('offensive') || t.includes('pen')) return ['Pen testing'];
  return [];
}

export function buildIntroMessage({ name, goal, background, areas, linkedin } = {}) {
  const who = String(name || '').trim();
  const greeting = who ? `Hi everyone, I'm ${who}.` : 'Hi everyone.';
  const focus = joinWithAnd(areas);
  const focusLine = focus ? ` I'm focusing on ${focus}.` : '';
  const link = String(linkedin || '').trim();
  const lines = [
    `${greeting} My goal is to ${goal || INTRO_GOALS[0]}.`,
    `${background || INTRO_BACKGROUNDS[0]}.${focusLine}`,
  ];
  if (link) lines.push(`You can find me on LinkedIn: ${link}`);
  return lines.join('\n\n');
}
