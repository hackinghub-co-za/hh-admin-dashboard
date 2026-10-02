import { useState } from 'react';
import { X, Coffee, ExternalLink, Heart } from 'lucide-react';

const BREAK_DAY_OPTIONS = [3, 7, 14];

const RECOVERY_TIPS = [
  'Step fully away from the material - no "just one room" for the first couple of days.',
  'Protect your sleep. Burnout and sleep debt feed each other more than almost anything else.',
  'Move your body daily, even a short walk - it does more for focus than another study session would.',
  'Reconnect with something that has nothing to do with cybersecurity or your career.',
  'Tell someone close to you that you are taking a deliberate break, not falling behind.',
];

export default function TakeABreakModal({ submitting, error, onStart, onClose }) {
  const [selectedDays, setSelectedDays] = useState(7);

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{ width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Coffee size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Take a Break</h2>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
          Burnout is a real risk in this field - it's okay to pause. Pick a fixed length below and your
          accountability check-ins, roadmap nudges, login streak and competition pace checks all pause
          with you. There's no "end early" button by design - once you start, it just quietly resumes on
          its own on the date you pick.
        </p>

        <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--accent-rgb), 0.05)', border: '1px solid rgba(var(--accent-rgb), 0.15)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px' }}>
            <Heart size={13} /> While you're away
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.83rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {RECOVERY_TIPS.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
          <a
            href="https://tcm-sec.com/preventing-cybersecurity-burnout/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '0.82rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}
          >
            Preventing Cybersecurity Burnout (TCM Security) <ExternalLink size={13} />
          </a>
        </div>

        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>How long?</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {BREAK_DAY_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              disabled={submitting}
              onClick={() => setSelectedDays(days)}
              className={`btn ${selectedDays === days ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '10px 18px', opacity: submitting ? 0.6 : 1 }}
            >
              {days} days
            </button>
          ))}
        </div>

        {error && (
          <p style={{ fontSize: '0.82rem', color: 'var(--danger)', marginBottom: '14px' }}>{error}</p>
        )}

        <button
          type="button"
          className="btn btn-primary"
          disabled={submitting}
          onClick={() => onStart(selectedDays)}
          style={{ width: '100%', padding: '12px', fontSize: '0.9rem', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Starting...' : `Start My Break (${selectedDays} days)`}
        </button>
      </div>
    </div>
  );
}
