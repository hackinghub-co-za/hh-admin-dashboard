import React from 'react';
import { X, Megaphone } from 'lucide-react';
import { RELEASE_NOTES } from '../data/releaseNotes';
import { formatDate } from '../lib/dateFormat';

export default function ReleaseNotesModal({ onClose }) {
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
          maxWidth: '620px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <Megaphone size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>What's New</h2>
        </div>

        {RELEASE_NOTES.map((release, i) => (
          <div key={release.version} style={{ marginBottom: i === RELEASE_NOTES.length - 1 ? 0 : '32px', paddingBottom: i === RELEASE_NOTES.length - 1 ? 0 : '32px', borderBottom: i === RELEASE_NOTES.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span className="badge badge-success" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{release.version}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(release.date)}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{release.headline}</h3>
            {release.intro && <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>{release.intro}</p>}

            {release.groups.map((group) => (
              <div key={group.label} style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ width: '18px', height: '3px', borderRadius: '2px', background: group.color }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{group.label}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {group.items.map((item) => (
                    <div key={item.title} style={{ padding: '14px 16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '1.05rem' }}>{item.icon}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.title}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: item.where ? '8px' : 0 }}>{item.body}</p>
                      {item.where && (
                        <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Find it: {item.where}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
