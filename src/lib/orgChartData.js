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

// Staff documents (org_chart_documents + the private 'staff-documents'
// bucket, 098_org_chart.sql) - contracts and the like, per org chart person.
// Admin only. Files are private: opened through a signed link that expires
// after a minute, never a public URL.
const STAFF_DOCS_BUCKET = 'staff-documents';

function mapDocRow(row) {
  return { id: row.id, memberId: row.member_id, name: row.name, storagePath: row.storage_path, uploadedBy: row.uploaded_by || '', createdAt: row.created_at };
}

/** Every staff document, grouped by org chart member id, newest first. */
export async function fetchOrgChartDocuments() {
  const { data, error } = await supabase.from('org_chart_documents').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDocRow).reduce((acc, d) => {
    (acc[d.memberId] ||= []).push(d);
    return acc;
  }, {});
}

/** Uploads a file to this person's folder and records it. */
export async function uploadOrgChartDocument(memberId, file, uploadedBy) {
  const safeName = file.name.replace(/[^\w.\- ]+/g, '').trim() || 'document';
  const path = `${memberId}/${Date.now()}-${safeName.replace(/\s+/g, '-')}`;
  const { error: upErr } = await supabase.storage.from(STAFF_DOCS_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from('org_chart_documents')
    .insert({ member_id: memberId, name: safeName, storage_path: path, uploaded_by: uploadedBy || null })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(STAFF_DOCS_BUCKET).remove([path]);
    throw error;
  }
  return mapDocRow(data);
}

/** A link that opens the document for the next 60 seconds. */
export async function getOrgChartDocumentUrl(storagePath) {
  const { data, error } = await supabase.storage.from(STAFF_DOCS_BUCKET).createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteOrgChartDocument(doc) {
  const { error: rmErr } = await supabase.storage.from(STAFF_DOCS_BUCKET).remove([doc.storagePath]);
  if (rmErr) throw rmErr;
  const { error } = await supabase.from('org_chart_documents').delete().eq('id', doc.id);
  if (error) throw error;
}
