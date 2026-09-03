import { X, Headphones, ExternalLink } from 'lucide-react';

// Recommended Podcasts - same in-app guide pattern as the cert study guides
// (SecurityPlusGuideModal.jsx et al.), but for the 'Podcasts' resource
// category instead of 'Cert Prep'. Catalogued in Resources
// (supabase/026_resources.sql) with just a teaser description; this is the
// real content, the "Read Guide" button opens.
const SECTIONS = [
  {
    heading: 'CyberWire Daily',
    body: 'Daily cybersecurity news and analysis, published every weekday - also includes interviews with industry experts from all over the world.',
    linkLabel: 'CyberWire Daily — Spotify',
    href: 'https://open.spotify.com/show/0CnYnxrAcfRjh0YSQINAwe',
  },
  {
    heading: 'The Secure Developer',
    body: 'AI and DevSecOps podcast, hosted by Snyk. Infrequent but high quality episodes.',
    linkLabel: 'The Secure Developer — Spotify',
    href: 'https://open.spotify.com/show/0NX5cgorayOLBM6oc9zExW',
  },
];

export default function PodcastsGuideModal({ onClose }) {
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
          maxWidth: '620px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
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
          <Headphones size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Recommended Podcasts</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.6 }}>
          An easy way to digest what's happening in the cyber industry and threat landscape in general.
          Listen on a drive to work or school, or use them as background noise for benign activities.
        </p>
        <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '24px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--accent-rgb), 0.08)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
          After you're done listening to an episode, share any key takeaways or insights on LinkedIn.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SECTIONS.map((s) => (
            <div key={s.heading} style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>{s.heading}</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
              {s.href && (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
                >
                  <ExternalLink size={14} /> {s.linkLabel}
                </a>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={onClose}>Got It</button>
        </div>
      </div>
    </div>
  );
}
