import { X, Compass, Briefcase, Banknote } from 'lucide-react';
import { TRACK_DESCRIPTIONS, TRACK_INFO } from '../lib/memberOptions';

// What a whole domain/track actually is, opened by clicking its name in the
// Members directory's By Domain view (GroupedMemberDirectory.jsx) - same
// idea and layout as CoreFoundationInfoModal, just one level up (a whole
// specialty rather than a single roadmap item). TRACK_INFO is real, curated
// copy per track, not a generic template - "Other" (no track assigned yet)
// and any future track added to ROADMAP_TRACKS without a matching entry
// here just renders nothing, same "no info yet" guard CoreFoundationInfoModal
// uses.
export default function DomainInfoModal({ track, onClose }) {
  const info = TRACK_INFO[track];
  if (!info) return null;
  const tagline = TRACK_DESCRIPTIONS[track];

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px', paddingRight: '40px' }}>{track}</h2>
        {tagline && <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '24px' }}>{tagline}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Compass size={16} color="var(--accent-cyan)" />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>What It Actually Is</h4>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{info.whatItIs}</p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Briefcase size={16} color="var(--accent-cyan)" />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Typical Roles</h4>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {info.roles.map((r) => (
                <span key={r} className="badge badge-success" style={{ fontSize: '0.75rem' }}>{r}</span>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Banknote size={16} color="var(--accent-cyan)" />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Typical Salary (South Africa)</h4>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{info.salaryRange}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Indicative only - real pay varies a lot by employer, experience, and certifications.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginTop: '24px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
