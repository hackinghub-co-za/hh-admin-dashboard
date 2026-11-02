// The "One last step" profile gate (109_qualifications.sql PART 2): a member
// who has not filled in gender, location, employment status and qualification
// sees ProfileGate instead of the portal. my_profile_gate_missing() is the one
// place that decides what is missing; computeGateStatus() below mirrors it so
// the form can tick steps off as the member types.

import { supabase } from './supabase';

export const GATE_STEPS = ['gender', 'location', 'employment', 'qualification'];

/** Which of GATE_STEPS this member still has to fill in. Empty for staff and
 * for anyone the server does not stop. */
export async function fetchProfileGateMissing() {
  const { data, error } = await supabase.rpc('my_profile_gate_missing');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** The member's own current answers, to pre-fill the form. */
export async function fetchMyProfileGate() {
  const { data, error } = await supabase.rpc('get_my_profile_gate');
  if (error) throw error;
  const row = data?.[0];
  return {
    gender: row?.gender || '',
    location: row?.location || '',
    employmentStatus: row?.employment_status && row.employment_status !== 'Not Set' ? row.employment_status : '',
    jobTitle: row?.job_title || '',
    monthlySalary: Number(row?.monthly_remuneration) > 0 ? String(Number(row.monthly_remuneration)) : '',
    salaryDeclined: row?.salary_declined === true,
  };
}

/** Saves gender, location, employment status, job title and salary on the
 * member's own row. The qualification is saved with saveMyQualification. */
export async function saveMyProfileGate({ gender, location, employmentStatus, jobTitle, monthlySalary, salaryDeclined }) {
  const { error } = await supabase.rpc('save_my_profile_gate', {
    p_gender: gender || null,
    p_location: location || null,
    p_employment_status: employmentStatus || null,
    p_job_title: jobTitle || null,
    p_monthly_remuneration: monthlySalary === '' || monthlySalary === null || monthlySalary === undefined ? null : Number(monthlySalary),
    p_salary_declined: !!salaryDeclined,
  });
  if (error) throw error;
}

/** Which steps the form has filled in. Same rules as my_profile_gate_missing(). */
export function computeGateStatus(f) {
  const employed = f.employmentStatus === 'Employed';
  const studying = f.qualificationStatus === 'In Progress' && f.qualificationLevel !== 'Matric';
  return {
    gender: !!f.gender,
    location: !!f.location,
    employment: !!f.employmentStatus
      && (!employed || (!!String(f.jobTitle || '').trim() && (Number(f.monthlySalary) > 0 || !!f.salaryDeclined))),
    qualification: !!f.qualificationLevel && !!f.qualificationStatus
      && !!String(f.qualificationName || '').trim() && !!String(f.qualificationInstitution || '').trim()
      && !!f.qualificationYear && (!studying || (!!f.qualificationStudyYear && !!f.qualificationFinalYear)),
  };
}
