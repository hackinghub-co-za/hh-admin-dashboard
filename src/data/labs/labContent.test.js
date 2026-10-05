// Structural checks on Hub Lab content (src/data/labs/*.js) and its answer
// keys (supabase/099_labs.sql). Catches the two ways this content silently
// breaks: a content file whose task/option/item ids drift from the ids the
// SQL answer key expects (LabPlayer would auto-grade against the wrong set,
// or a match/single/multi id the UI renders would have no key to check
// against), and a malformed task (missing points, a risk_score task with a
// prompt that mentions risk_score explicitly to catch copy-paste drift,
// etc). Cross-checking the SQL is done by parsing the VALUES block that
// seeds lab_answer_keys, not by hitting a database - this runs in plain
// `npm test`.

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { HUB_LAB_CONTENT } from './index';

const VALID_TASK_TYPES = ['single', 'multi', 'match', 'risk_score', 'rubric'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.resolve(__dirname, '../../../supabase/099_labs.sql'), 'utf8');

// Pulls every ('slug', 'task_key', 'grading', ...) tuple's slug/task_key/grading
// out of the lab_answer_keys seed. Good enough for this file's own formatting
// (one tuple opens with "(\n   'slug', 'tkey', 'grading',"), and intentionally
// simple rather than a full SQL parser.
function parseAnswerKeySeed(text) {
  const re = /\(\s*'([a-z0-9-]+)',\s*'(t\d+)',\s*'(single|multi|match|risk_score|rubric)'/g;
  const rows = [];
  let m;
  while ((m = re.exec(text))) rows.push({ slug: m[1], taskKey: m[2], grading: m[3] });
  return rows;
}

const answerKeyRows = parseAnswerKeySeed(sql);
const answerKeysBySlug = answerKeyRows.reduce((acc, row) => {
  (acc[row.slug] = acc[row.slug] || []).push(row);
  return acc;
}, {});

describe('every Hub Lab content file', () => {
  const labs = Object.values(HUB_LAB_CONTENT);

  it('is registered in HUB_LAB_CONTENT under its own slug', () => {
    Object.entries(HUB_LAB_CONTENT).forEach(([key, lab]) => expect(lab.slug).toBe(key));
  });

  it('has no duplicate slugs', () => {
    const slugs = labs.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  labs.forEach((lab) => {
    describe(lab.slug, () => {
      it('has a brief and at least one evidence item', () => {
        expect(Array.isArray(lab.brief) && lab.brief.length).toBeTruthy();
        expect(Array.isArray(lab.evidence) && lab.evidence.length).toBeGreaterThan(0);
      });

      it('has unique evidence ids', () => {
        const ids = lab.evidence.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('has at least one task, all of a known type, with unique keys', () => {
        expect(Array.isArray(lab.tasks) && lab.tasks.length).toBeGreaterThan(0);
        const keys = lab.tasks.map((t) => t.key);
        expect(new Set(keys).size).toBe(keys.length);
        lab.tasks.forEach((t) => expect(VALID_TASK_TYPES).toContain(t.type));
      });

      it('gives every match task the same ids on both sides as its answer', () => {
        lab.tasks.filter((t) => t.type === 'match').forEach((t) => {
          expect(Array.isArray(t.items) && t.items.length).toBeGreaterThan(0);
          expect(Array.isArray(t.choices) && t.choices.length).toBeGreaterThan(0);
          const itemIds = new Set(t.items.map((i) => i.id));
          const choiceIds = new Set(t.choices.map((c) => c.id));
          expect(itemIds.size).toBe(t.items.length);
          expect(choiceIds.size).toBe(t.choices.length);
        });
      });

      it('gives every single/multi task unique, non-empty options', () => {
        lab.tasks.filter((t) => t.type === 'single' || t.type === 'multi').forEach((t) => {
          expect(Array.isArray(t.options) && t.options.length).toBeGreaterThan(1);
          const ids = t.options.map((o) => o.id);
          expect(new Set(ids).size).toBe(ids.length);
        });
      });

      it('has a rubric task as the final, 0-point written submission', () => {
        const last = lab.tasks[lab.tasks.length - 1];
        expect(last.type).toBe('rubric');
        expect(last.points).toBe(0);
        // Every other task should carry real, auto-graded points.
        lab.tasks.slice(0, -1).forEach((t) => expect(t.points).toBeGreaterThan(0));
      });

      it('has an answer-key row for every auto-graded task, with matching grading', () => {
        const keyed = answerKeysBySlug[lab.slug] || [];
        const byTaskKey = Object.fromEntries(keyed.map((r) => [r.taskKey, r]));
        lab.tasks.forEach((t) => {
          const row = byTaskKey[t.key];
          expect(row, `${lab.slug} ${t.key} has no lab_answer_keys row`).toBeTruthy();
          expect(row.grading, `${lab.slug} ${t.key} grading mismatch`).toBe(t.type);
        });
      });

      it('has no leftover answer-key rows for tasks that no longer exist', () => {
        const taskKeys = new Set(lab.tasks.map((t) => t.key));
        (answerKeysBySlug[lab.slug] || []).forEach((row) => {
          expect(taskKeys.has(row.taskKey), `${lab.slug} ${row.taskKey} in SQL has no matching task`).toBe(true);
        });
      });
    });
  });

  it('is seeded in the labs table for every content file (and vice versa)', () => {
    const contentSlugs = new Set(labs.map((l) => l.slug));
    const labsTableSlugMatches = [...sql.matchAll(/\('([a-z0-9-]+)', 'hub', /g)].map((m) => m[1]);
    const seededSlugs = new Set(labsTableSlugMatches);
    contentSlugs.forEach((s) => expect(seededSlugs.has(s), `${s} has content but no labs row`).toBe(true));
    seededSlugs.forEach((s) => expect(contentSlugs.has(s), `${s} is seeded but has no content file`).toBe(true));
  });
});
