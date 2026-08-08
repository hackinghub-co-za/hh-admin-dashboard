export const SPECIALTIES = ['Not Set', 'Red Team', 'Blue Team', 'Cloud Security', 'GRC'];
export const JOB_READINESS_STAGES = ['Not Started', 'In Progress', 'Interview Ready', 'Job Placed'];
export const GENDERS = ['Male', 'Female'];
export const LOCATIONS = [
  'Cape Town',
  'Johannesburg',
  'Durban',
  'Pretoria',
  'Other (SA)',
  'Other (Rest of the World)',
];
export const AGES = ['16-18', '18-21', '21-24', '24-27', '27-30', '30-35', '35-40', '40+'];
export const MEMBERSHIP_STATUSES = ['Active', 'Left'];
export const EMPLOYMENT_STATUSES = ['Not Set', 'Employed', 'Unemployed', 'Student'];
export const MEMBERSHIP_TIERS = ['Basic Access', 'Monthly Operative', 'Permanent Access', 'Custom Plan', 'Maintenance Fee'];

// A member is flagged "Lapsed" if they haven't paid in this many days and haven't
// been explicitly marked Active or Left by an admin - a nudge to go check on them,
// not a verdict.
export const LAPSED_AFTER_DAYS = 45;

// A member's "Last 1on1 Meeting" is flagged once it's this many days old.
export const MEETING_OVERDUE_AFTER_DAYS = 30;
