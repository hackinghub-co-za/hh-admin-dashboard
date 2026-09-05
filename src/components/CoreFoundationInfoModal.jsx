import { X, BookOpen, Compass, ExternalLink } from 'lucide-react';
import { ROADMAP_ITEM_DESCRIPTIONS, ROADMAP_ITEM_INFO, ROADMAP_ITEM_LINKS } from '../lib/memberOptions';

// What a roadmap item actually teaches, and why it's on the roadmap at all -
// real, tailored copy per item (ROADMAP_ITEM_INFO), not a generic template.
// Covers Core Foundations, Specialization, and Projects items alike, since
// ROADMAP_ITEM_INFO is one flat, phase-agnostic, title-keyed map. Opened by
// clicking an item's description on My Roadmap; the checkbox/progress row
// itself still just toggles completion.
export default function CoreFoundationInfoModal({ title, onOpenResource, onClose }) {
  const info = ROADMAP_ITEM_INFO[title];
  if (!info) return null;
  const tagline = ROADMAP_ITEM_DESCRIPTIONS[title];
  const hasResource = !!ROADMAP_ITEM_LINKS[title] || title === 'CompTIA Security+';

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

        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '4px', paddingRight: '40px' }}>{title}</h2>
        {tagline && <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '24px' }}>{tagline}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <BookOpen size={16} color="var(--accent-cyan)" />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>What It Teaches</h4>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{info.teaches}</p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Compass size={16} color="var(--accent-cyan)" />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Why It's On Your Roadmap</h4>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{info.journey}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          {hasResource && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { onClose(); onOpenResource?.(title); }}
            >
              <ExternalLink size={14} /> Open Link / Resource
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
