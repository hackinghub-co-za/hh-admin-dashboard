// Members must give a deadline to their next 2 unfinished roadmap items
// (RoadmapDeadlinesModal). "Next" means the order the My Roadmap tab shows
// them in: phase order, then categories in the order they first appear,
// then sort order. Only phases the member has unlocked count, so nobody is
// asked to date something they can't see yet.

import { ROADMAP_PHASES } from './memberOptions';

export const DEADLINE_ITEMS_REQUIRED = 2;

export function orderRoadmapItems(items) {
  const ordered = [];
  for (const phase of ROADMAP_PHASES) {
    const inPhase = items.filter((i) => i.phase === phase);
    const categories = [...new Set(inPhase.map((i) => i.category))];
    for (const category of categories) {
      ordered.push(...inPhase.filter((i) => i.category === category).sort((a, b) => a.sortOrder - b.sortOrder));
    }
  }
  return ordered;
}

/** The next unfinished items (up to `count`) in the phases the member can see. */
export function nextRoadmapItems(items, visiblePhases, count = DEADLINE_ITEMS_REQUIRED) {
  return orderRoadmapItems(items)
    .filter((i) => !i.completed && visiblePhases.has(i.phase))
    .slice(0, count);
}

/** Those of the next items that still have no deadline. */
export function nextItemsMissingDeadline(items, visiblePhases, count = DEADLINE_ITEMS_REQUIRED) {
  return nextRoadmapItems(items, visiblePhases, count).filter((i) => !i.dueDate);
}
