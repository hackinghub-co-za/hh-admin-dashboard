// Staff task tracker (supabase/101_staff_tasks.sql) - the kanban board on
// the admin side. Admins and community managers; RLS decides which rows
// each can see (community managers never get admin_only tasks).

import { supabase } from './supabase';

export const TASK_STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const COLUMNS = 'id, title, description, status, priority, assignee_email, due_date, labels, checklist, admin_only, sort_order, created_by, created_at, updated_at, completed_at, staff_task_comments(count)';

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
    commentCount: row.staff_task_comments?.[0]?.count || 0,
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

/** Oldest first - reads like a conversation. */
export async function fetchTaskComments(taskId) {
  const { data, error } = await supabase
    .from('staff_task_comments')
    .select('id, task_id, author_email, body, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map((c) => ({ id: c.id, taskId: c.task_id, authorEmail: c.author_email, body: c.body, createdAt: c.created_at }));
}

/** The author is always the signed-in staff member (RLS rejects anything else). */
export async function addTaskComment(taskId, body, authorEmail) {
  const { data, error } = await supabase
    .from('staff_task_comments')
    .insert({ task_id: taskId, body: body.trim(), author_email: authorEmail.toLowerCase() })
    .select('id, task_id, author_email, body, created_at')
    .single();
  if (error) throw error;
  return { id: data.id, taskId: data.task_id, authorEmail: data.author_email, body: data.body, createdAt: data.created_at };
}

export async function deleteTaskComment(id) {
  const { error } = await supabase.from('staff_task_comments').delete().eq('id', id);
  if (error) throw error;
}
