import React, { useState } from 'react';
import { X, Mail, Phone, MapPin, Link, Calendar, CreditCard, Briefcase, UserCheck, UserPlus, Building2, Banknote } from 'lucide-react';
import {
  SPECIALTIES,
  JOB_READINESS_STAGES,
  GENDERS,
  LOCATIONS,
  AGES,
  MEMBERSHIP_STATUSES,
  MEMBERSHIP_TIERS,
  EMPLOYMENT_STATUSES,
} from '../lib/memberOptions';

const emptyForm = {
  member: '',
  email: '',
  startDate: '',
  lastPlan: MEMBERSHIP_TIERS[0],
  totalSpent: '',
  age: '',
  gender: '',
  location: '',
  specialty: 'Not Set',
  linkedin: '',
  phone: '',
  moneyOwed: 0,
  jobReadiness: 'Not Started',
  status: 'Active',
  employmentStatus: 'Not Set',
  jobTitle: '',
  monthlyRemuneration: '',
  jobPlacedDate: '',
};

export default function AddMemberModal({ onSave, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const updateJobReadiness = (e) => {
    const value = e.target.value;
    const isNowPlaced = value === 'Job Placed';
    setForm({
      ...form,
      jobReadiness: value,
      jobPlacedDate: isNowPlaced && !form.jobPlacedDate
        ? new Date().toISOString().split('T')[0]
        : form.jobPlacedDate,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.member.trim() || !form.email.trim() || !form.startDate) {
      setError('Name, email, and start date are required.');
      return;
    }
    onSave({
      ...form,
      monthlyRemuneration: form.employmentStatus === 'Employed' ? (Number(form.monthlyRemuneration) || 0) : 0,
      jobTitle: form.employmentStatus === 'Employed' ? form.jobTitle : '',
      jobPlacedDate: form.jobReadiness === 'Job Placed' ? form.jobPlacedDate : '',
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 30px rgba(94, 227, 122, 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Add Member Manually</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          For members who haven't paid through PayFast yet (e.g. added before you had a gateway, or on a manual arrangement).
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Full Name *</label>
              <input type="text" className="form-input" placeholder="e.g. Thabo Mokoena" value={form.member} onChange={update('member')} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Mail size={13} /> Email *
              </label>
              <input type="email" className="form-input" placeholder="e.g. thabo@gmail.com" value={form.email} onChange={update('email')} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Calendar size={13} /> Start Date *
              </label>
              <input type="date" className="form-input" value={form.startDate} onChange={update('startDate')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Membership Tier</label>
              <select className="form-input" value={form.lastPlan} onChange={update('lastPlan')}>
                {MEMBERSHIP_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <CreditCard size={13} /> Total Spent on HH so far (R)
            </label>
            <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={form.totalSpent} onChange={update('totalSpent')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Age</label>
              <select className="form-input" value={form.age} onChange={update('age')}>
                <option value="">Not set</option>
                {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Gender</label>
              <select className="form-input" value={form.gender} onChange={update('gender')}>
                <option value="">Not set</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <MapPin size={13} /> Location
            </label>
            <select className="form-input" value={form.location} onChange={update('location')}>
              <option value="">Not set</option>
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Specialty</label>
              <select className="form-input" value={form.specialty} onChange={update('specialty')}>
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Briefcase size={13} /> Job Readiness
              </label>
              <select className="form-input" value={form.jobReadiness} onChange={updateJobReadiness}>
                {JOB_READINESS_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {form.jobReadiness === 'Job Placed' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Calendar size={13} /> Date Placed
              </label>
              <input type="date" className="form-input" value={form.jobPlacedDate} onChange={update('jobPlacedDate')} />
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <Building2 size={13} /> Employment Status
            </label>
            <select className="form-input" value={form.employmentStatus} onChange={update('employmentStatus')}>
              {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {form.employmentStatus === 'Employed' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  <Briefcase size={13} /> Job Title
                </label>
                <input type="text" className="form-input" placeholder="e.g. SOC Analyst" value={form.jobTitle} onChange={update('jobTitle')} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  <Banknote size={13} /> Monthly Remuneration (R)
                </label>
                <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={form.monthlyRemuneration} onChange={update('monthlyRemuneration')} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Link size={13} /> LinkedIn Profile
              </label>
              <input type="url" className="form-input" placeholder="https://linkedin.com/in/..." value={form.linkedin} onChange={update('linkedin')} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Phone size={13} /> Phone Number
              </label>
              <input type="tel" className="form-input" placeholder="+27 ..." value={form.phone} onChange={update('phone')} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Money Owed (R)</label>
              <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={form.moneyOwed} onChange={update('moneyOwed')} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <UserCheck size={13} /> Membership Status
              </label>
              <select className="form-input" value={form.status} onChange={update('status')}>
                {MEMBERSHIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Member</button>
          </div>
        </form>
      </div>
    </div>
  );
}
