// Pure helpers for resource steps and per-member completion
// (supabase/026_resources.sql). Kept out of resourcesData.js (which pulls in
// the Supabase client) so they can be unit tested on their own.

export const MAX_STEPS = 20;

/** Cleans whatever came back from the database into [{ id, title, link }]. */
export function normalizeSteps(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s.id === 'string' && typeof s.title === 'string' && s.title.trim())
    .map((s) => ({ id: s.id, title: s.title, link: typeof s.link === 'string' ? s.link : '' }));
}

/** "Title | https://link" per line (link optional) -> steps with stable ids. */
export function parseStepLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_STEPS)
    .map((line, i) => {
      const [title, link] = line.split('|').map((part) => part.trim());
      return { id: `s${i + 1}`, title: title.slice(0, 200), link: link || null };
    })
    .filter((s) => s.title);
}

/**
 * The same rules the database applies in set_my_resource_progress(), used for
 * the instant optimistic update: completing the resource ticks every step;
 * ticking the last step completes it; un-ticking a step un-completes it;
 * un-completing the resource alone leaves the steps as they were.
 * `stepId` null means the resource itself. Returns the new { completed, steps }.
 */
export function applyProgress(current, resource, stepId, done) {
  const allIds = resource.steps.map((s) => s.id);
  const have = new Set(current?.steps || []);
  let completed = !!current?.completed;

  if (!stepId) {
    completed = done;
    if (done) allIds.forEach((id) => have.add(id));
  } else if (done) {
    have.add(stepId);
    if (allIds.length > 0 && allIds.every((id) => have.has(id))) completed = true;
  } else {
    have.delete(stepId);
    completed = false;
  }
  return { completed, steps: [...have] };
}
