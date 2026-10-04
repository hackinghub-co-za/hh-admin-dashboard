// Staff task tracker (supabase/101_staff_tasks.sql) - the kanban board on
// the admin side. Admins and community managers; RLS decides which rows
// each can see (community managers never get admin_only tasks).

import { supabase } from './supabase';

export const TASK_STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const COLUMNS = 'id, title, description, status, priority, assignee_email, due_date, labels, checklist, admin_only, sort_order, created_by, created_at, updated_at, completed_at';

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status,
    priority: row.priority,
    assigneeEmail: row.assignee_email || '',
    dueDate: row.due_date || '',
    labels: row.labels || [],
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    adminOnly: !!row.admin_only,
    sortOrder: row.sort_order,
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function toPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    status: form.status,
    priority: form.priority,
    assignee_email: form.assigneeEmail?.trim().toLowerCase() || null,
    due_date: form.dueDate || null,
    labels: form.labels,
    checklist: form.checklist.map((c) => ({ text: String(c.text).trim().slice(0, 200), done: !!c.done })).filter((c) => c.text),
    admin_only: !!form.adminOnly,
  };
}

export async function fetchTasks() {
  const { data, error } = await supabase.from('staff_tasks').select(COLUMNS).order('sort_order', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Creates a task at the end of its column. */
export async function createTask(form, sortOrder, createdByEmail) {
  const { data, error } = await supabase
    .from('staff_tasks')
    .insert({ ...toPayload(form), sort_order: sortOrder, created_by: createdByEmail || null })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateTask(id, form) {
  const { data, error } = await supabase.from('staff_tasks').update(toPayload(form)).eq('id', id).select(COLUMNS).single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteTask(id) {
  const { error } = await supabase.from('staff_tasks').delete().eq('id', id);
  if (error) throw error;
}

/** moves = [{ id, status, sortOrder }] - one round trip for a whole drag. */
export async function moveTasks(moves) {
  const { error } = await supabase.rpc('move_staff_tasks', {
    p_moves: moves.map((m) => ({ id: m.id, status: m.status, sort_order: m.sortOrder })),
  });
  if (error) throw error;
}

/** Admins and community managers a task can be assigned to. */
export async function fetchTaskAssignees() {
  const { data, error } = await supabase.rpc('get_task_assignees');
  if (error) throw error;
  return (data || []).map((a) => ({ email: a.email, fullName: a.full_name || '', role: a.role }));
}
