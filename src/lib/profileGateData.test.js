import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeGateStatus, GATE_STEPS } from './profileGateData';
import { GENDERS, LOCATIONS } from './memberOptions';

const full = {
  gender: 'Female', location: 'Pretoria', employmentStatus: 'Student', jobTitle: '', monthlySalary: '', salaryDeclined: false,
  qualificationLevel: 'Diploma', qualificationStatus: 'Completed', qualificationName: 'IT', qualificationInstitution: 'TUT', qualificationYear: '2025',
  qualificationStudyYear: '', qualificationFinalYear: '',
};

describe('computeGateStatus', () => {
  it('is done for a complete profile', () => {
    expect(GATE_STEPS.every((s) => computeGateStatus(full)[s])).toBe(true);
  });
  it('needs a job title and a salary (or Prefer not to say) when employed', () => {
    const emp = { ...full, employmentStatus: 'Employed' };
    expect(computeGateStatus(emp).employment).toBe(false);
    expect(computeGateStatus({ ...emp, jobTitle: 'Analyst' }).employment).toBe(false);
    expect(computeGateStatus({ ...emp, jobTitle: 'Analyst', monthlySalary: '18000' }).employment).toBe(true);
    expect(computeGateStatus({ ...emp, jobTitle: 'Analyst', salaryDeclined: true }).employment).toBe(true);
  });
  it('needs year of study and final year while studying, except for Matric', () => {
    const studying = { ...full, qualificationStatus: 'In Progress' };
    expect(computeGateStatus(studying).qualification).toBe(false);
    expect(computeGateStatus({ ...studying, qualificationStudyYear: '3', qualificationFinalYear: 'yes' }).qualification).toBe(true);
    expect(computeGateStatus({ ...studying, qualificationLevel: 'Matric' }).qualification).toBe(true);
  });
  it('treats an empty form as missing everything', () => {
    const s = computeGateStatus({});
    expect(GATE_STEPS.some((k) => s[k])).toBe(false);
  });
});

describe('the SQL and the options agree', () => {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/109_qualifications.sql'), 'utf8');
  it('every gender and location option is accepted by save_my_profile_gate', () => {
    GENDERS.forEach((g) => expect(sql, g).toContain(`'${g}'`));
    LOCATIONS.forEach((l) => expect(sql, l).toContain(`'${l}'`));
  });
  it('stops staff and the server-side check lists all four steps', () => {
    expect(sql).toContain("COALESCE(v_role, 'member') <> 'member'");
    GATE_STEPS.forEach((k) => expect(sql, k).toContain(`array_append(v_missing, '${k}')`));
  });
});
