import React, { useState } from 'react';
import { X, Mail, Phone, MapPin, Link, Calendar, CreditCard, Wallet, Briefcase, Shield } from 'lucide-react';

const SPECIALTIES = ['Not Set', 'Red Team', 'Blue Team', 'Cloud Security', 'GRC'];
const JOB_READINESS_STAGES = ['Not Started', 'In Progress', 'Interview Ready', 'Job Placed'];

export default function MemberProfileModal({ member, profile, onSave, onClose }) {
  const [form, setForm] = useState({
    age: profile?.age || '',
    gender: profile?.gender || '',
    location: profile?.location || '',
    specialty: profile?.specialty || 'Not Set',
    linkedin: profile?.linkedin || '',
    phone: profile?.phone || '',
    moneyOwed: profile?.moneyOwed ?? 0,
    jobReadiness: profile?.jobReadiness || 'Not Started',
  });

  if (!member) return null;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(member.email, { ...form, moneyOwed: Number(form.moneyOwed) || 0 });
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
          boxShadow: '0 0 30px rgba(0, 242, 254, 0.2)',
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

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <span className="badge badge-success">{member.lastPlan}</span>
            <span className="badge badge-warning">{form.jobReadiness}</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{member.member}</h2>
          <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={14} /> {member.email}
          </p>
        </div>

        {/* Derived-from-payments facts (read-only) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '16px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} /> Start Date
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.firstPaymentDate.split(' ')[0]}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={12} /> Months in HH
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.monthsInHH}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CreditCard size={12} /> Total Spent on HH
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--success)' }}>R {member.totalSpent.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wallet size={12} /> Payments Made
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.paymentCount}</div>
          </div>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          The fields below aren't in the PayFast export — fill them in and they'll be remembered for this member.
        </p>

        {/* Editable profile fields */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Age</label>
              <input type="number" min="0" className="form-input" placeholder="e.g. 24" value={form.age} onChange={update('age')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Gender</label>
              <input type="text" className="form-input" placeholder="e.g. Female" value={form.gender} onChange={update('gender')} />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <MapPin size={13} /> Location
            </label>
            <input type="text" className="form-input" placeholder="e.g. Johannesburg, South Africa" value={form.location} onChange={update('location')} />
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
              <select className="form-input" value={form.jobReadiness} onChange={update('jobReadiness')}>
                {JOB_READINESS_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

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

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Money Owed (R)</label>
            <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={form.moneyOwed} onChange={update('moneyOwed')} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Profile</button>
          </div>
        </form>
      </div>
    </div>
  );
}
