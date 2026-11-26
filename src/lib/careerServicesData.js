// Career Services requests (supabase/117_career_services.sql): free LinkedIn
// and CV reviews requested on the public site. Admin only; rows are created
// by the linkedin-review-intake and cv-review-intake Edge Functions.

import { supabase } from './supabase';

export const CAREER_SERVICES = ['LinkedIn review', 'CV review'];
export const CAREER_STATUSES = ['New', 'Call booked', 'Reviewed', 'Used for content', 'Closed'];

const fromRow = (row) => ({
  id: row.id,
  service: row.service,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone || '',
  linkedinUrl: row.linkedin_url || '',
  targetRole: row.target_role || '',
  situation: row.situation || '',
  contentConsent: !!row.content_consent,
  status: row.status,
  notes: row.notes || '',
  createdAt: row.created_at,
});

/** Every request, newest first. */
export async function fetchCareerServiceRequests() {
  const { data, error } = await supabase
    .from('career_service_requests')
    .select('id, service, full_name, email, phone, linkedin_url, target_role, situation, content_consent, status, notes, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

/** Changes the status and/or notes of one request. */
export async function updateCareerServiceRequest(id, { status, notes }) {
  const patch = { updated_at: new Date().toISOString() };
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes.trim() || null;
  const { error } = await supabase.from('career_service_requests').update(patch).eq('id', id);
  if (error) throw error;
}

/** Removes a request (spam, or a test). */
export async function deleteCareerServiceRequest(id) {
  const { error } = await supabase.from('career_service_requests').delete().eq('id', id);
  if (error) throw error;
}
