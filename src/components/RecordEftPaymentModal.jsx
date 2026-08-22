import React, { useState } from 'react';
import { X, Landmark, Mail, Calendar, CreditCard, Hash, FileText, Users } from 'lucide-react';
import { MEMBERSHIP_TIERS } from '../lib/memberOptions';

const todayInputValue = () => new Date().toISOString().split('T')[0];

const emptyForm = {
  member: '',
  email: '',
  amount: '',
  date: todayInputValue(),
  plan: MEMBERSHIP_TIERS[0],
  bankReference: '',
  notes: '',
};

export default function RecordEftPaymentModal({ activeMembers = [], onSave, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [memberQuery, setMemberQuery] = useState('');

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleMemberQueryChange = (e) => {
    const value = e.target.value;
    setMemberQuery(value);
    const picked = activeMembers.find((m) => `${m.member} (${m.email})` === value);
    if (picked) setForm({ ...form, member: picked.member, email: picked.email });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.member.trim() || !form.email.trim() || !form.amount || !form.date) {
      setError('Member name, email, amount, and date are required.');
      return;
    }
    onSave(form);
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
          maxWidth: '560px',
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

        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Landmark size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Record EFT Payment</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          For payments made straight into the business bank account rather than through PayFast. Only record this once you've confirmed it landed — it'll be added to the transaction ledger and counted in revenue immediately.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <Users size={13} /> Existing Active Member
            </label>
            <input
              type="text"
              className="form-input"
              list="eft-active-members"
              placeholder="Search by name or email to auto-fill —"
              value={memberQuery}
              onChange={handleMemberQueryChange}
            />
            <datalist id="eft-active-members">
              {activeMembers.map((m) => (
                <option key={m.email} value={`${m.member} (${m.email})`} />
              ))}
            </datalist>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Not listed (new or lapsed member)? Just type their name and email below.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Member Name *</label>
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
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Amount Received (R) *</label>
              <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={form.amount} onChange={update('amount')} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Calendar size={13} /> Date Received *
              </label>
              <input type="date" className="form-input" value={form.date} onChange={update('date')} />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <CreditCard size={13} /> Plan / What It's For
            </label>
            <select className="form-input" value={form.plan} onChange={update('plan')}>
              {MEMBERSHIP_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <Hash size={13} /> Bank Reference
            </label>
            <input type="text" className="form-input" placeholder="Reference the payer used, for reconciling against your statement" value={form.bankReference} onChange={update('bankReference')} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <FileText size={13} /> Notes
            </label>
            <input type="text" className="form-input" placeholder="Optional" value={form.notes} onChange={update('notes')} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Confirm Payment Received</button>
          </div>
        </form>
      </div>
    </div>
  );
}
