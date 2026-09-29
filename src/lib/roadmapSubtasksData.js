// Per-member subtask ticks for Core Foundations roadmap items
// (supabase/088_roadmap_subtasks.sql). The subtask catalog itself lives in
// memberOptions.js (CORE_FOUNDATION_SUBTASKS); this only reads/writes which
// ones a member has ticked. Only called for a real signed-in member - Mock
// sessions branch on isMockSession before reaching these.

import { supabase } from './supabase';

/**
 * Fetch the caller's ticked subtasks, shaped as { [itemTitle]: Set(subtaskKey) }
 * for O(1) "is this subtask done" lookups in the roadmap render.
 */
export async function fetchMyRoadmapSubtasks() {
  const { data, error } = await supabase
    .from('roadmap_item_subtasks')
    .select('item_title, subtask_key, completed');
  if (error) throw error;
  const byItem = {};
  (data || []).forEach((row) => {
    if (!row.completed) return;
    (byItem[row.item_title] = byItem[row.item_title] || new Set()).add(row.subtask_key);
  });
  return byItem;
}

/** Tick or un-tick one subtask for the caller - the RPC enforces ownership. */
export async function toggleMyRoadmapSubtask(itemTitle, subtaskKey, completed) {
  const { error } = await supabase.rpc('toggle_my_roadmap_subtask', {
    p_item_title: itemTitle,
    p_subtask_key: subtaskKey,
    p_completed: completed,
  });
  if (error) throw error;
}
