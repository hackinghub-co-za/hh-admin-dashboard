// Other income (supabase/037_expenses.sql): money in that isn't a member
// payment, such as a referral fee or a sponsorship. Admin-only; shown on the
// Finances tab next to Business Expenses. Kept out of eft_payments, which
// count as membership revenue and fill intake spots.

import { supabase } from './supabase';

export const OTHER_INCOME_CATEGORIES = ['Referral fee', 'Sponsorship', 'Consulting / Services', 'Other'];

const fromRow = (row) => ({
  id: row.id,
  category: row.category,
  source: row.source,
  description: row.description || '',
  amount: Number(row.amount),
  date: row.received_on,
});

/** Every other-income entry, most recent first. */
export async function fetchOtherIncome() {
  const { data, error } = await supabase
    .from('other_income')
    .select('id, category, source, description, amount, received_on')
    .order('received_on', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

/** Admin-only: records money received. */
export async function addOtherIncome({ category, source, description, amount, date, createdBy }) {
  const { data, error } = await supabase
    .from('other_income')
    .insert({
      category,
      source,
      description: description || null,
      amount,
      received_on: date,
      created_by: createdBy ? createdBy.toLowerCase() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

/** Admin-only: removes an entry recorded by mistake. */
export async function deleteOtherIncome(id) {
  const { error } = await supabase.from('other_income').delete().eq('id', id);
  if (error) throw error;
}
