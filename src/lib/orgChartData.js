// Org Chart (supabase/098_org_chart.sql) - real staff structure: job
// title, department, who reports to whom, employment type, and monthly
// compensation. Deliberately separate from profiles.role
// (067_permission_scopes.sql), which is only a portal permission level -
// a staff member here doesn't need to ever have signed into the portal at
// all (hence no FK to profiles/auth.users, email is optional free text).
// Admin-only in every direction: RLS (is_admin(auth.uid()) only, see the
// migration) rejects a community_manager or mentor outright on both reads
// and writes, same "admin-only, whole table" convention as member_profiles.

import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email || '',
    jobTitle: row.job_title,
    department: row.department || '',
    reportsToId: row.reports_to_id,
    employmentType: row.employment_type || '',
    monthlyCompensation: row.monthly_compensation,
    notes: row.notes || '',
    status: row.status,
    addedBy: row.added_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Admin-only: every staff member, active first, then alphabetically - RLS
 * rejects this entirely for a non-admin. */
export async function fetchOrgChartMembers() {
  const { data, error } = await supabase
    .from('org_chart_members')
    .select('*')
    .order('status', { ascending: true })
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Admin-only: adds a new staff member. reportsToId may be null (top of
 * the chart). */
export async function addOrgChartMember(form, addedByEmail) {
  const { data, error } = await supabase
    .from('org_chart_members')
    .insert({
      full_name: form.fullName.trim(),
      email: form.email?.trim() || null,
      job_title: form.jobTitle.trim(),
      department: form.department?.trim() || null,
      reports_to_id: form.reportsToId || null,
      employment_type: form.employmentType || null,
      monthly_compensation: form.monthlyCompensation === '' || form.monthlyCompensation == null ? null : Number(form.monthlyCompensation),
      notes: form.notes?.trim() || null,
      added_by: addedByEmail || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Admin-only: updates an existing staff member's details (including
 * moving them under a different manager). */
export async function updateOrgChartMember(id, form) {
  const { data, error } = await supabase
    .from('org_chart_members')
    .update({
      full_name: form.fullName.trim(),
      email: form.email?.trim() || null,
      job_title: form.jobTitle.trim(),
      department: form.department?.trim() || null,
      reports_to_id: form.reportsToId || null,
      employment_type: form.employmentType || null,
      monthly_compensation: form.monthlyCompensation === '' || form.monthlyCompensation == null ? null : Number(form.monthlyCompensation),
      notes: form.notes?.trim() || null,
      status: form.status || 'Active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Admin-only: soft-archives a departed staff member instead of deleting
 * them - matches this app's "don't erase people" convention elsewhere
 * (deleted_members, member_profiles.status='Left'). Anyone who reported to
 * them keeps their own row untouched. */
export async function archiveOrgChartMember(id) {
  const { error } = await supabase
    .from('org_chart_members')
    .update({ status: 'Inactive', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Admin-only: permanently removes a staff row. Safe even if other rows
 * report to this person - reports_to_id REFERENCES ... ON DELETE SET NULL
 * means their reports simply fall to the top level, never a failed delete
 * or an orphaned reference. Prefer archiveOrgChartMember() for a real
 * departure; this is for correcting a mistaken entry. */
export async function deleteOrgChartMember(id) {
  const { error } = await supabase.from('org_chart_members').delete().eq('id', id);
  if (error) throw error;
}
