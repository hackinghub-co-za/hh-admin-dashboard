import { useState, useEffect } from 'react';
import { Check, LogOut } from 'lucide-react';
import { GENDERS, LOCATIONS, EMPLOYMENT_STATUSES, QUALIFICATION_LEVELS, QUALIFICATION_STUDY_YEARS } from '../lib/memberOptions';
import { fetchMyProfileGate, saveMyProfileGate, fetchProfileGateMissing, computeGateStatus, GATE_STEPS } from '../lib/profileGateData';
import { fetchMyQualification, saveMyQualification } from '../lib/memberDirectoryData';
import { friendlyMemberErrorMessage } from '../lib/errorMessages';
import logo from '../assets/hacking-hub-logo-sm.png';

// Shown instead of the portal until gender, location, employment status and
// qualification are filled in (109_qualifications.sql PART 2). No close
// button: the only other way out is signing out. Only asks for what is still
// missing - a step that is already done shows ticked and collapsed.

const STEP_TITLES = {
  gender: 'Gender',
  location: 'Where you live',
  employment: 'Employment status',
  qualification: 'Your qualification',
};
const EMPLOYMENT_OPTIONS = EMPLOYMENT_STATUSES.filter((s) => s !== 'Not Set');
const FINAL_YEAR_OPTIONS = [
  { value: 'yes', label: 'Yes, I finish this year' },
  { value: 'no', label: 'No, I have more than this year left' },
];

const labelStyle = { display: 'block', fontSize: '0.8rem', marginBottom: '6px', color: 'var(--text-secondary)' };

function Pills({ options, value, onChange, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const on = value === val;
        return (
          <button
            key={val}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(val)}
            style={{
              font: 'inherit', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', padding: '9px 16px', borderRadius: '10px',
              color: on ? 'var(--accent-cyan)' : 'var(--text-primary)',
              background: on ? 'rgba(var(--accent-rgb), 0.16)' : 'rgba(0,0,0,0.25)',
              border: `1px solid ${on ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function ProfileGate({ user, onDone, onLogout }) {
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openStep, setOpenStep] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyProfileGate(), fetchMyQualification()])
      .then(([basics, qual]) => {
        if (cancelled) return;
        setForm({
          gender: basics.gender,
          location: basics.location,
          employmentStatus: basics.employmentStatus,
          jobTitle: basics.jobTitle,
          monthlySalary: basics.monthlySalary,
          salaryDeclined: basics.salaryDeclined,
          qualificationLevel: qual.qualificationLevel,
          qualificationName: qual.qualificationName,
          qualificationInstitution: qual.qualificationInstitution,
          qualificationStatus: qual.qualificationStatus,
          qualificationYear: qual.qualificationYear === null ? '' : String(qual.qualificationYear ?? ''),
          qualificationStudyYear: qual.qualificationStudyYear === null ? '' : String(qual.qualificationStudyYear ?? ''),
          qualificationFinalYear: qual.qualificationFinalYear || '',
        });
      })
      .catch((err) => { if (!cancelled) setLoadError(friendlyMemberErrorMessage(err)); });
    return () => { cancelled = true; };
  }, []);

  const set = (patch) => { setError(''); setForm((f) => ({ ...f, ...patch })); };

  const firstName = (user?.user_metadata?.full_name || '').split(' ')[0];

  const shell = (children) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', background: 'radial-gradient(circle at 80% 0%, rgba(var(--accent-rgb), 0.10), transparent 55%), var(--bg-primary)' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '580px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px', border: '1px solid rgba(var(--accent-rgb), 0.2)' }} role="dialog" aria-modal="true" aria-labelledby="profile-gate-title">
        {children}
      </div>
    </div>
  );

  if (loadError) {
    return shell(
      <>
        <h1 id="profile-gate-title" style={{ fontSize: '1.3rem', margin: 0 }}>We could not load your profile</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{loadError} Refresh the page to try again.</p>
        <button type="button" className="btn btn-secondary" onClick={onLogout}><LogOut size={14} /> Sign out</button>
      </>
    );
  }
  if (!form) {
    return shell(<p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading your profile...</p>);
  }

  const status = computeGateStatus(form);
  const doneCount = GATE_STEPS.filter((k) => status[k]).length;
  const allDone = doneCount === GATE_STEPS.length;
  const studying = form.qualificationStatus === 'In Progress' && form.qualificationLevel !== 'Matric';

  const leftText = (() => {
    const left = [];
    if (!status.gender) left.push('gender');
    if (!status.location) left.push('where you live');
    if (!status.employment) {
      left.push(form.employmentStatus === 'Employed' ? (String(form.jobTitle).trim() ? 'your monthly salary, or Prefer not to say' : 'your job title') : 'employment status');
    }
    if (!status.qualification) left.push('your qualification');
    return left.length ? `Still needed: ${left.join(', ')}.` : '';
  })();

  const handleContinue = async () => {
    if (!allDone || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveMyProfileGate(form);
      await saveMyQualification({
        ...form,
        qualificationFinalYear: studying ? form.qualificationFinalYear : '',
      });
      const missing = await fetchProfileGateMissing();
      if (missing.length === 0) {
        onDone();
      } else {
        setError(`We could not save everything. Still missing: ${missing.map((k) => STEP_TITLES[k].toLowerCase()).join(', ')}.`);
      }
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const renderStep = (key, body) => {
    const done = status[key];
    const open = !done || openStep === key;
    return (
      <div key={key} style={{ border: `1px solid ${done ? 'rgba(var(--accent-rgb), 0.35)' : 'var(--border-color)'}`, borderRadius: '14px', background: done ? 'rgba(var(--accent-rgb), 0.05)' : 'rgba(var(--overlay-rgb), 0.03)' }}>
        <div
          onClick={done ? () => setOpenStep(openStep === key ? null : key) : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', cursor: done ? 'pointer' : 'default' }}
        >
          <span style={{ width: '22px', height: '22px', borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${done ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: done ? 'var(--accent-cyan)' : 'transparent', color: 'var(--accent-ink)' }}>
            {done && <Check size={13} strokeWidth={3} />}
          </span>
          <b style={{ flex: 1, fontSize: '0.95rem' }}>{STEP_TITLES[key]}</b>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: done ? 'var(--accent-cyan)' : 'var(--warning)' }}>{done ? 'Done' : 'Needed'}</span>
        </div>
        {open && <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>{body}</div>}
      </div>
    );
  };

  return shell(
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src={logo} alt="Hacking Hub" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} />
        <div>
          <h1 id="profile-gate-title" style={{ fontSize: '1.35rem', lineHeight: 1.2, margin: 0, fontWeight: 800 }}>One last step before you continue{firstName ? `, ${firstName}` : ''}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>We need four things on your profile before you can use the portal. It takes about a minute.</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'rgba(var(--overlay-rgb), 0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${(doneCount / GATE_STEPS.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-cyan))', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{doneCount} of {GATE_STEPS.length} done</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {renderStep('gender', <Pills ariaLabel="Gender" options={GENDERS} value={form.gender} onChange={(v) => set({ gender: v })} />)}
        {renderStep('location', (
          <div>
            <label htmlFor="gate-location" style={labelStyle}>City</label>
            <select id="gate-location" className="form-input" value={form.location} onChange={(e) => set({ location: e.target.value })}>
              <option value="">Choose one</option>
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        ))}
        {renderStep('employment', (
          <>
            <Pills ariaLabel="Employment status" options={EMPLOYMENT_OPTIONS} value={form.employmentStatus} onChange={(v) => set({ employmentStatus: v })} />
            {form.employmentStatus === 'Employed' && (
              <>
                <div>
                  <label htmlFor="gate-job" style={labelStyle}>Your job title</label>
                  <input id="gate-job" type="text" className="form-input" maxLength={120} placeholder="e.g. IT Support Technician" value={form.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="gate-salary" style={labelStyle}>Your gross monthly salary in rand, before tax</label>
                  <input id="gate-salary" type="number" min={0} max={10000000} className="form-input" placeholder="e.g. 18500" disabled={form.salaryDeclined} value={form.salaryDeclined ? '' : form.monthlySalary} onChange={(e) => set({ monthlySalary: e.target.value })} />
                </div>
                <Pills ariaLabel="Salary" options={['Prefer not to say']} value={form.salaryDeclined ? 'Prefer not to say' : ''} onChange={() => set({ salaryDeclined: !form.salaryDeclined, monthlySalary: '' })} />
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>Only Siya can see your salary. It is never shown to other members or to the rest of the team.</p>
              </>
            )}
          </>
        ))}
        {renderStep('qualification', (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div>
                <label htmlFor="gate-level" style={labelStyle}>Highest qualification</label>
                <select id="gate-level" className="form-input" value={form.qualificationLevel} onChange={(e) => set({ qualificationLevel: e.target.value })}>
                  <option value="">Choose one</option>
                  {QUALIFICATION_LEVELS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <span style={labelStyle}>Status</span>
                <Pills ariaLabel="Qualification status" options={['Completed', 'In Progress']} value={form.qualificationStatus} onChange={(v) => set({ qualificationStatus: v })} />
              </div>
            </div>
            {form.qualificationLevel && (
              <>
                <div>
                  <label htmlFor="gate-qname" style={labelStyle}>Qualification name</label>
                  <input id="gate-qname" type="text" className="form-input" maxLength={120} placeholder="e.g. BSc Computer Science" value={form.qualificationName} onChange={(e) => set({ qualificationName: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div>
                    <label htmlFor="gate-inst" style={labelStyle}>{form.qualificationStatus === 'In Progress' ? 'School or university' : 'Institution'}</label>
                    <input id="gate-inst" type="text" className="form-input" maxLength={120} placeholder="e.g. University of Johannesburg" value={form.qualificationInstitution} onChange={(e) => set({ qualificationInstitution: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="gate-year" style={labelStyle}>{form.qualificationStatus === 'In Progress' ? 'Expected year' : 'Year'}</label>
                    <input id="gate-year" type="number" min={1960} max={2100} className="form-input" placeholder="e.g. 2026" value={form.qualificationYear} onChange={(e) => set({ qualificationYear: e.target.value })} />
                  </div>
                </div>
                {studying && (
                  <>
                    <div>
                      <label htmlFor="gate-study" style={labelStyle}>Year of study</label>
                      <select id="gate-study" className="form-input" value={form.qualificationStudyYear} onChange={(e) => set({ qualificationStudyYear: e.target.value })}>
                        <option value="">Choose one</option>
                        {QUALIFICATION_STUDY_YEARS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
                      </select>
                    </div>
                    <div>
                      <span style={labelStyle}>Are you in your final year this year?</span>
                      <Pills ariaLabel="Final year" options={FINAL_YEAR_OPTIONS} value={form.qualificationFinalYear} onChange={(v) => set({ qualificationFinalYear: v })} />
                    </div>
                  </>
                )}
              </>
            )}
          </>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
        Only the Hacking Hub team can see this. It helps us put you forward for roles and understand who is in the community.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button type="button" className="btn btn-primary" disabled={!allDone || saving} onClick={handleContinue} style={{ width: '100%', justifyContent: 'center', opacity: allDone && !saving ? 1 : 0.5, cursor: allDone && !saving ? 'pointer' : 'not-allowed' }}>
          {saving ? 'Saving...' : 'Continue to the portal'}
        </button>
        <div role="status" aria-live="polite" style={{ minHeight: '1.2em', fontSize: '0.8rem', textAlign: 'center', color: error ? 'var(--danger)' : 'var(--warning)' }}>
          {error || (allDone ? '' : leftText)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Not you?</span>
          <button type="button" onClick={onLogout} style={{ font: 'inherit', fontSize: '0.78rem', background: 'none', border: 0, color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Sign out</button>
        </div>
      </div>
    </>
  );
}
