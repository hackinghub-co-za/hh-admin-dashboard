// Pure helpers for the Talent Pool (supabase/107_talent_pool.sql), kept apart
// from talentData.js so they can be unit tested without the Supabase client.

export const MAX_SELF_SKILLS = 25;
export const MAX_SKILL_LENGTH = 40;

/**
 * "Splunk, python; Sigma rules" -> ["Splunk", "python", "Sigma rules"].
 * Splits on commas, semicolons and line breaks, trims, drops blanks and
 * case-insensitive repeats, and applies the same limits the database does.
 */
export function parseSkills(text) {
  const seen = new Set();
  const out = [];
  String(text || '').split(/[,;\n]+/).forEach((raw) => {
    const skill = raw.trim();
    const key = skill.toLowerCase();
    if (!skill || skill.length > MAX_SKILL_LENGTH || seen.has(key) || out.length >= MAX_SELF_SKILLS) return;
    seen.add(key);
    out.push(skill);
  });
  return out;
}

/** Whether a card's availability date means "available now" (no date counts as not stated). */
export function isAvailableNow(availableFrom, today = new Date().toISOString().slice(0, 10)) {
  return !!availableFrom && availableFrom <= today;
}

/** "Now", "from 12 Nov 2026" or "not stated". */
export function availabilityLabel(availableFrom, today = new Date().toISOString().slice(0, 10)) {
  if (!availableFrom) return 'not stated';
  if (availableFrom <= today) return 'now';
  const d = new Date(`${availableFrom}T00:00:00Z`);
  return `from ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
}

/**
 * Splits text into parts so the matched search terms can be highlighted
 * without injecting HTML: [{ text, hit }].
 */
export function highlightParts(text, terms) {
  const value = String(text || '');
  const clean = [...new Set((terms || []).map((t) => String(t).trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!value || !clean.length) return [{ text: value, hit: false }];
  const escaped = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'ig');
  // split() with one capture group alternates plain text and matches.
  return value.split(re).map((part, i) => ({ text: part, hit: i % 2 === 1 })).filter((part) => part.text !== '');
}

/**
 * The recruiter pack: anonymous cards as plain text to paste into an email.
 * Names, emails and phone numbers never go in it; they are released one
 * person at a time after that person agrees to an introduction.
 */
export function buildTalentPack(cards, today = new Date().toISOString().slice(0, 10)) {
  if (!cards || !cards.length) return '';
  const lines = [
    'HACKING HUB TALENT PACK',
    `${cards.length} candidate${cards.length === 1 ? '' : 's'}. Names and contact details follow once a candidate agrees to an introduction. A check mark means Hacking Hub verified the skill (a passed exam, an approved lab or an approved project). Everything else is self-reported and unchecked.`,
    '',
  ];
  cards.forEach((c) => {
    const role = c.role || c.headline || 'Candidate';
    const yrs = c.years == null ? '' : `, ${c.years} yr${c.years === 1 ? '' : 's'}`;
    const where = c.city ? `, ${c.city}` : '';
    const mode = c.workMode ? `, ${c.workMode.toLowerCase()}` : '';
    lines.push(`${c.displayId}  ${role}${yrs}${where}${mode}, available ${availabilityLabel(c.availableFrom, today)}${c.openToContract ? ', open to contract' : ''}`);
    const skills = [...c.verified.map((s) => `✓ ${s}`), ...c.self];
    if (skills.length) lines.push(`  Skills: ${skills.join(', ')}`);
    if (c.summary) lines.push(`  ${c.summary}`);
    lines.push('');
  });
  return lines.join('\n').trimEnd() + '\n';
}
