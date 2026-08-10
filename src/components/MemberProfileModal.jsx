import React, { useState } from 'react';
import { X, Mail, Phone, MapPin, Link, Calendar, CalendarClock, CreditCard, Wallet, Briefcase, Shield, UserCheck, Building2, Banknote, Flag } from 'lucide-react';
import { SPECIALTIES, JOB_READINESS_STAGES, GENDERS, LOCATIONS, AGES, MEMBERSHIP_STATUSES, EMPLOYMENT_STATUSES, LAPSED_AFTER_DAYS, MEETING_OVERDUE_AFTER_DAYS } from '../lib/memberOptions';

export default function MemberProfileModal({ member, profile, onSave, onClose, today }) {
  const [form, setForm] = useState({
    age: profile?.age || '',
    gender: profile?.gender || '',
    location: profile?.location || '',
    specialty: profile?.specialty || 'Not Set',
    linkedin: profile?.linkedin || '',
    phone: profile?.phone || '',
    moneyOwed: profile?.moneyOwed ?? 0,
    jobReadiness: profile?.jobReadiness || 'Not Started',
    status: profile?.status || 'Active',
    employmentStatus: profile?.employmentStatus || 'Not Set',
    jobTitle: profile?.jobTitle || '',
    monthlyRemuneration: profile?.monthlyRemuneration ?? '',
    jobPlacedDate: profile?.jobPlacedDate || '',
  });

  if (!member) return null;

  const daysSinceLastPayment = Math.floor((today - new Date(member.lastPaymentDate)) / (1000 * 60 * 60 * 24));
  const isLapsed = form.status === 'Active' && daysSinceLastPayment > LAPSED_AFTER_DAYS;

  const daysSinceLastMeeting = member.lastMeetingDate
    ? Math.floor((today - new Date(member.lastMeetingDate)) / (1000 * 60 * 60 * 24))
    : null;
  const isMeetingOverdue = daysSinceLastMeeting !== null && daysSinceLastMeeting > MEETING_OVERDUE_AFTER_DAYS;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const updateJobReadiness = (e) => {
    const value = e.target.value;
    const isNowPlaced = value === 'Job Placed';
    setForm({
      ...form,
      jobReadiness: value,
      // Default to today so a fresh placement doesn't sit with a blank date -
      // still fully editable below.
      jobPlacedDate: isNowPlaced && !form.jobPlacedDate
        ? today.toISOString().split('T')[0]
        : form.jobPlacedDate,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(member.email, {
      ...form,
      moneyOwed: Number(form.moneyOwed) || 0,
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

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-success">{member.lastPlan}</span>
            <span className="badge badge-warning">{form.jobReadiness}</span>
            <span className={`badge ${form.status === 'Left' ? 'badge-danger' : isLapsed ? 'badge-warning' : 'badge-success'}`}>
              {form.status === 'Left' ? 'Left'
                : form.status === 'Active (Permanent)' ? 'Active · Permanent'
                : isLapsed ? `Lapsed · ${daysSinceLastPayment}d since last payment`
                : 'Active'}
            </span>
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
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CalendarClock size={12} /> Last 1on1 Meeting
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', color: isMeetingOverdue ? 'var(--danger)' : 'inherit' }}>
              {member.lastMeetingDate ? (
                <>
                  {isMeetingOverdue && <Flag size={14} color="var(--danger)" />}
                  {new Date(member.lastMeetingDate).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {isMeetingOverdue && <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>· {daysSinceLastMeeting} days ago</span>}
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Not synced from Google Calendar yet</span>
              )}
            </div>
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
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Powers the "job placements this year" count on the dashboard.
              </p>
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

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <UserCheck size={13} /> Membership Status
            </label>
            <select className="form-input" value={form.status} onChange={update('status')}>
              {MEMBERSHIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {isLapsed && (
              <p style={{ fontSize: '0.78rem', color: 'var(--warning)', marginTop: '6px' }}>
                No payment in {daysSinceLastPayment} days. If they've paid in full or don't owe recurring dues (e.g. Permanent Access), set this to <strong>"Active (Permanent)"</strong> so it stops flagging. Set to <strong>"Left"</strong> once you know they're actually gone.
              </p>
            )}
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
