import { useState, useEffect } from 'react';
import { X, UserPlus, UserCheck, Briefcase, Building2, Users, Banknote, Mail, FileText } from 'lucide-react';

import { fetchTaskAssignees } from '../lib/tasksData';

const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Contractor', 'Volunteer'];

const ROLE_TITLE = { admin: 'Founder', community_manager: 'Community Manager' };
const MOCK_TEAM = [
  { email: 'founder@example.com', fullName: 'You (Founder)', role: 'admin' },
  { email: 'thandiwe@example.com', fullName: 'Thandiwe Nkosi', role: 'community_manager' },
  { email: 'blessing@example.com', fullName: 'Blessing Mahlangu', role: 'community_manager' },
];

const emptyForm = {
  fullName: '', email: '', jobTitle: '', department: '',
  reportsToId: '', employmentType: '', monthlyCompensation: '', notes: '',
};

// Best-effort cycle guard: a manager pick is invalid if it's the member
// being edited, or anyone already downstream of them (their own reports,
// transitively) - Postgres' self-referencing FK can't block a cycle on its
// own, so this is the only thing standing between a careless edit and
// A reports to B reports to A. Deliberately simple, not exhaustive.
function getDescendantIds(memberId, allMembers) {
  const ids = new Set();
  const stack = [memberId];
  while (stack.length) {
    const current = stack.pop();
    allMembers.filter((m) => m.reportsToId === current).forEach((child) => {
      if (!ids.has(child.id)) { ids.add(child.id); stack.push(child.id); }
    });
  }
  return ids;
}

export default function AddOrgChartMemberModal({ allMembers, editingMember, isMockSession, onSave, onClose }) {
  const [form, setForm] = useState(
    editingMember
      ? {
          fullName: editingMember.fullName, email: editingMember.email,
          jobTitle: editingMember.jobTitle, department: editingMember.department,
          reportsToId: editingMember.reportsToId || '', employmentType: editingMember.employmentType,
          monthlyCompensation: editingMember.monthlyCompensation ?? '', notes: editingMember.notes,
        }
      : emptyForm
  );
  const [error, setError] = useState(null);
  // The portal's own founder and community managers, so they can be added
  // with one pick instead of retyping a name and email that already exist.
  const [team, setTeam] = useState(() => (isMockSession ? MOCK_TEAM : []));
  const [picked, setPicked] = useState('');

  useEffect(() => {
    if (isMockSession || editingMember) return undefined;
    let cancelled = false;
    fetchTaskAssignees().then((people) => { if (!cancelled) setTeam(people); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isMockSession, editingMember]);

  const chartEmails = new Set(allMembers.map((m) => (m.email || '').toLowerCase()).filter(Boolean));

  const pickTeamMember = (email) => {
    setPicked(email);
    const person = team.find((t) => t.email === email);
    if (!person) return;
    // Fill what the portal already knows; anything typed afterwards still
    // wins. A community manager defaults to reporting to the founder if
    // the founder is already on the chart.
    const founderOnChart = allMembers.find((m) => team.some((t) => t.role === 'admin' && t.email === (m.email || '').toLowerCase()));
    setForm((prev) => ({
      ...prev,
      fullName: person.fullName || person.email.split('@')[0],
      email: person.email,
      jobTitle: prev.jobTitle || ROLE_TITLE[person.role] || '',
      reportsToId: prev.reportsToId || (person.role !== 'admin' && founderOnChart ? founderOnChart.id : ''),
    }));
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const excludedIds = editingMember
    ? new Set([editingMember.id, ...getDescendantIds(editingMember.id, allMembers)])
    : new Set();
  const managerOptions = allMembers.filter((m) => !excludedIds.has(m.id));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.jobTitle.trim()) {
      setError('Full name and job title are required.');
      return;
    }
    onSave({ ...form, reportsToId: form.reportsToId ? Number(form.reportsToId) : null });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)', boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={18} />
        </button>

        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>{editingMember ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--danger-rgb), 0.1)', border: '1px solid rgba(var(--danger-rgb), 0.2)', color: 'var(--danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {!editingMember && team.length > 0 && (
            <div>
              <label htmlFor="org-pick-team" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <UserCheck size={13} /> Pick from the team
              </label>
              <select id="org-pick-team" className="form-input" value={picked} onChange={(e) => pickTeamMember(e.target.value)}>
                <option value="">Someone else (type their details below)</option>
                {team.map((t) => (
                  <option key={t.email} value={t.email} disabled={chartEmails.has(t.email)}>
                    {t.fullName || t.email} - {ROLE_TITLE[t.role] || t.role}{chartEmails.has(t.email) ? ' (already on the chart)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Full Name *</label>
              <input type="text" className="form-input" placeholder="e.g. Thandiwe Nkosi" value={form.fullName} onChange={update('fullName')} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Mail size={13} /> Email (optional)
              </label>
              <input type="email" className="form-input" placeholder="e.g. thandiwe@hackinghub.co.za" value={form.email} onChange={update('email')} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Briefcase size={13} /> Job Title *
              </label>
              <input type="text" className="form-input" placeholder="e.g. Head of Partnerships" value={form.jobTitle} onChange={update('jobTitle')} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Building2 size={13} /> Department
              </label>
              <input type="text" className="form-input" placeholder="e.g. Partnerships" value={form.department} onChange={update('department')} />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <Users size={13} /> Reports To
            </label>
            <select className="form-input" value={form.reportsToId} onChange={update('reportsToId')}>
              <option value="">Nobody (top of the chart)</option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName} — {m.jobTitle}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Employment Type</label>
              <select className="form-input" value={form.employmentType} onChange={update('employmentType')}>
                <option value="">Not set</option>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Banknote size={13} /> Monthly Compensation (R)
              </label>
              <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={form.monthlyCompensation} onChange={update('monthlyCompensation')} />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <FileText size={13} /> Notes
            </label>
            <textarea className="form-input" rows={3} placeholder="Anything else worth noting..." value={form.notes} onChange={update('notes')} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingMember ? 'Save Changes' : 'Add Staff Member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
