// Small pure helpers for the staff task board. Date logic lives here, not in
// the components, so no Date.now() runs in a render body (React Compiler
// purity rule) and "today" is always the SAST calendar day.

const SAST = 'Africa/Johannesburg';
const DAY_MS = 86400000;
export const DONE_VISIBLE_DAYS = 14;

export const todaySast = () => new Date().toLocaleDateString('en-CA', { timeZone: SAST });

export function addDaysSast(days) {
  const d = new Date(`${todaySast()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 'overdue' | 'today' | 'soon' (within 2 days) | 'later' | null (no date or already Done). */
export function dueState(task) {
  if (!task.dueDate || task.status === 'Done') return null;
  const today = todaySast();
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  return task.dueDate <= addDaysSast(2) ? 'soon' : 'later';
}

export function formatDueShort(dueDate) {
  if (!dueDate) return '';
  return new Date(`${dueDate}T00:00:00Z`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Done tasks older than this drop off the board (still in the database). */
export function isRecentlyDone(task) {
  if (task.status !== 'Done' || !task.completedAt) return true;
  return Date.now() - new Date(task.completedAt).getTime() <= DONE_VISIBLE_DAYS * DAY_MS;
}

export function personName(assignees, email) {
  if (!email) return '';
  const hit = assignees.find((a) => a.email === email.toLowerCase());
  return hit?.fullName || email.split('@')[0];
}

export function initialsOf(name) {
  return (name || '?').split(/[\s._-]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export const PRIORITY_COLOR = {
  Low: 'var(--text-muted)',
  Medium: 'var(--info)',
  High: 'var(--warning)',
  Urgent: 'var(--danger)',
};

export const STATUS_COLOR = {
  Backlog: 'var(--text-muted)',
  'To Do': 'var(--info)',
  'In Progress': 'var(--warning)',
  'In Review': 'var(--accent-purple)',
  Done: 'var(--success)',
};

export function parseLabels(text) {
  const seen = new Set();
  return text
    .split(',')
    .map((l) => l.trim().slice(0, 24))
    .filter((l) => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()))
    .slice(0, 6);
}
