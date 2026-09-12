// Personal job application tracker (075_job_application_tracker.sql) on the
// member-facing Resources tab. Private to each member - RLS scopes every
// call here to the signed-in member's own rows, so there's no separate
// "for member X" variant of any of these like the admin-facing data libs
// have.

import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    jobTitle: row.job_title,
    company: row.company,
    location: row.location || '',
    applicationDate: row.application_date,
    salaryRange: row.salary_range || '',
    cvUsed: row.cv_used || '',
    status: row.status,
  };
}

/** Every application the signed-in member has logged, most recently
 * applied first. */
export async function fetchMyJobApplications() {
  const { data, error } = await supabase
    .from('job_applications')
    .select('id, job_title, company, location, application_date, salary_range, cv_used, status')
    .order('application_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Logs a new application for the signed-in member (RLS enforces
 * member_email can only ever be the caller's own). */
export async function addJobApplication({ jobTitle, company, location, applicationDate, salaryRange, cvUsed, status, memberEmail }) {
  const { data, error } = await supabase
    .from('job_applications')
    .insert({
      member_email: memberEmail.toLowerCase(),
      job_title: jobTitle,
      company,
      location: location || null,
      application_date: applicationDate,
      salary_range: salaryRange || null,
      cv_used: cvUsed || null,
      status,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Edits an existing application (any field) - used both for the full edit
 * form and for a quick inline status change. */
export async function updateJobApplication(id, { jobTitle, company, location, applicationDate, salaryRange, cvUsed, status }) {
  const { data, error } = await supabase
    .from('job_applications')
    .update({
      job_title: jobTitle,
      company,
      location: location || null,
      application_date: applicationDate,
      salary_range: salaryRange || null,
      cv_used: cvUsed || null,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Removes a mis-logged or duplicate entry. */
export async function deleteJobApplication(id) {
  const { error } = await supabase.from('job_applications').delete().eq('id', id);
  if (error) throw error;
}
