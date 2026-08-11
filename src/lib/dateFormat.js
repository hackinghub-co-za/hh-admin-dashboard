// Single source of truth for how dates are displayed across the app:
// "day - month - year" (e.g. "11 - August - 2026"), matching the format the
// Competitions run dates box already used before this became a global rule.

// Bare "YYYY-MM-DD" values (e.g. a Postgres DATE column) parse as UTC
// midnight in JS - appending a local time avoids that shifting the displayed
// day for members west of UTC, same fix already used for event countdowns.
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(dateInput) {
  if (!dateInput) return '';
  const date = dateInput instanceof Date
    ? dateInput
    : new Date(BARE_DATE.test(dateInput) ? `${dateInput}T00:00:00` : dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} - ${date.toLocaleDateString('en-ZA', { month: 'long' })} - ${date.getFullYear()}`;
}
