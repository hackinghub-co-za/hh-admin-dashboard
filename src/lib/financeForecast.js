// Pure money helpers for the Finances tab and the Monday report: which of
// last month's costs should repeat this month, and the month's forecast.
// Kept free of Supabase so they can be unit tested.

/** "YYYY-MM" for a "YYYY-MM-DD" date string. */
export const monthOf = (date) => String(date || '').slice(0, 7);

/** The month before a "YYYY-MM" month, as "YYYY-MM". */
export function previousMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** A description's words, lowercased, letters and digits only. */
export function words(description) {
  return String(description || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

/** First word of a description: "Google workspace" -> "google". */
export function matchKey(description) {
  return words(description)[0] || '';
}

/**
 * Whether two expense descriptions look like the same cost: the first word
 * of either appears among the words of the other. So "claude sub" matches
 * "Claude subscription", and "Domain" matches "Diamatrix (domain hosting)".
 */
export function sameCost(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return false;
  return wb.includes(wa[0]) || wa.includes(wb[0]);
}

/**
 * Last month's costs that are not marked one-off and have not shown up yet
 * this month. A cost counts as already logged this month when an expense in
 * the same category looks like the same cost (sameCost above). Each
 * expected cost uses last month's amount.
 */
export function expectedRecurringCosts(expenses, month) {
  const last = previousMonth(month);
  const thisMonth = (expenses || []).filter((x) => monthOf(x.date) === month);
  return (expenses || [])
    .filter((x) => monthOf(x.date) === last && !x.isOneOff)
    .filter((x) => !thisMonth.some((t) => t.category === x.category && sameCost(x.description, t.description)));
}

/** Logged costs this month plus the recurring ones still expected. */
export function forecastExpenses(expenses, month) {
  const logged = (expenses || []).filter((x) => monthOf(x.date) === month).reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const expected = expectedRecurringCosts(expenses, month);
  const expectedTotal = expected.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  return { logged, expected, expectedTotal, total: logged + expectedTotal };
}
