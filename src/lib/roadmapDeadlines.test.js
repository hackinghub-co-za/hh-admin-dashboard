import { describe, it, expect } from 'vitest';
import { orderRoadmapItems, nextRoadmapItems, nextItemsMissingDeadline } from './roadmapDeadlines';

const item = (id, phase, category, sortOrder, extra = {}) => ({ id, phase, category, sortOrder, completed: false, dueDate: null, ...extra });
const core = new Set(['Core Foundations']);
const coreAndSpec = new Set(['Core Foundations', 'Specialization']);

describe('orderRoadmapItems', () => {
  it('orders by phase, then category as first seen, then sort order', () => {
    const items = [
      item(1, 'Specialization', 'Certs', 0),
      item(2, 'Core Foundations', 'Networking', 1),
      item(3, 'Core Foundations', 'Certifications', 0),
      item(4, 'Core Foundations', 'Networking', 0),
    ];
    expect(orderRoadmapItems(items).map((i) => i.id)).toEqual([4, 2, 3, 1]);
  });
});

describe('nextRoadmapItems', () => {
  it('skips finished items and takes the next two', () => {
    const items = [item(1, 'Core Foundations', 'C', 0, { completed: true }), item(2, 'Core Foundations', 'C', 1), item(3, 'Core Foundations', 'C', 2), item(4, 'Core Foundations', 'C', 3)];
    expect(nextRoadmapItems(items, core).map((i) => i.id)).toEqual([2, 3]);
  });

  it('ignores locked phases', () => {
    const items = [item(1, 'Core Foundations', 'C', 0), item(2, 'Specialization', 'S', 0)];
    expect(nextRoadmapItems(items, core).map((i) => i.id)).toEqual([1]);
    expect(nextRoadmapItems(items, coreAndSpec).map((i) => i.id)).toEqual([1, 2]);
  });
});

describe('nextItemsMissingDeadline', () => {
  it('returns only the next items without a deadline', () => {
    const items = [item(1, 'Core Foundations', 'C', 0, { dueDate: '2026-12-01' }), item(2, 'Core Foundations', 'C', 1), item(3, 'Core Foundations', 'C', 2)];
    expect(nextItemsMissingDeadline(items, core).map((i) => i.id)).toEqual([2]);
  });

  it('is empty once both next items have deadlines', () => {
    const items = [item(1, 'Core Foundations', 'C', 0, { dueDate: '2026-12-01' }), item(2, 'Core Foundations', 'C', 1, { dueDate: '2027-01-15' }), item(3, 'Core Foundations', 'C', 2)];
    expect(nextItemsMissingDeadline(items, core)).toEqual([]);
  });

  it('is empty when the roadmap is finished', () => {
    expect(nextItemsMissingDeadline([item(1, 'Core Foundations', 'C', 0, { completed: true })], core)).toEqual([]);
  });
});
