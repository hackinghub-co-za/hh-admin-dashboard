import { X, Trophy } from 'lucide-react';

// The one-time celebration when a member's Core Foundations count crosses
// the Specialization threshold (fired from MemberPortal's roadmap toggle
// handler - see playSpecializationChime and randomSpecializationQuote there,
// kept in that file rather than here so this file only ever exports the
// component - a second export here breaks Fast Refresh).
export default function SpecializationUnlockedModal({ quote, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--modal-backdrop)',
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
          maxWidth: '440px',
          padding: '36px 32px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 40px rgba(var(--accent-rgb), 0.25)',
          position: 'relative',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>

        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(var(--accent-rgb), 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Trophy size={30} color="var(--accent-cyan)" />
        </div>

        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-cyan)',
            marginBottom: '10px',
          }}
        >
          Core Foundations Cleared
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
          You've qualified for the Specialization roadmap.
        </h2>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '26px' }}>
          "{quote}"
        </p>

        <button className="btn btn-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
          Let's Go
        </button>
      </div>
    </div>
  );
}
