import { useState } from 'react';
import { X, UserPlus, Briefcase, Building2, Users, Banknote, Mail, FileText } from 'lucide-react';

const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Contractor', 'Volunteer'];

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

export default function AddOrgChartMemberModal({ allMembers, editingMember, onSave, onClose }) {
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
