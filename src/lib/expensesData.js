// Persisted business expenses - the money-out side of the Finances tab.
// Admin-only, no member-facing equivalent (RLS rejects a non-admin entirely).
// Only called for real (non-mock) sessions - Mock Admin has no Supabase
// session, so it uses local-only demo state instead.

import { supabase } from './supabase';

/** Fetch every expense, most recent first. RLS rejects this for non-admins. */
export async function fetchExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, category, description, amount, expense_date, created_by')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    date: row.expense_date,
    createdBy: row.created_by || '',
  }));
}

/** Admin-only: logs a new expense. */
export async function addExpense({ category, description, amount, date, createdBy }) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      category,
      description,
      amount,
      expense_date: date,
      created_by: createdBy ? createdBy.toLowerCase() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    category: data.category,
    description: data.description,
    amount: Number(data.amount),
    date: data.expense_date,
    createdBy: data.created_by || '',
  };
}

/** Admin-only: edits an existing expense. */
export async function updateExpense(id, { category, description, amount, date }) {
  const { error } = await supabase
    .from('expenses')
    .update({ category, description, amount, expense_date: date })
    .eq('id', id);
  if (error) throw error;
}

/** Admin-only: removes an expense entirely. */
export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}
