import { ShieldAlert, ExternalLink } from 'lucide-react';
import { renderMarkdown } from '../lib/renderMarkdown';
import { formatDate } from '../lib/dateFormat';
import { isSafeUrl } from '../lib/safeUrl';

const DIFFICULTY_COLOR = { Easy: 'var(--success)', Medium: 'var(--warning)', Hard: 'var(--danger)' };

// Weekly incident breakdowns (068_weekly_breakdowns.sql) - the archive list
// plus the selected edition. Lives inside the Resources tab; it used to be a
// tab of its own.
export default function BreakdownsPanel({ breakdowns, loading, error, openId, onOpen }) {
  const sorted = [...breakdowns].sort((a, b) => new Date(b.sendDate) - new Date(a.sendDate));
  const latest = sorted[0] || null;
  const open = openId ? sorted.find((b) => b.id === openId) : latest;

  return (
    <div>
      <p style={{ marginBottom: '20px' }}>A technical breakdown of one real security incident, every week — how the attack worked, what the SOC saw (or missed), and a detection exercise to try. Sent Friday mornings; every edition is kept here.</p>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Loading breakdowns...</p>
      ) : sorted.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <ShieldAlert size={40} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No breakdowns yet — the first one lands this Friday.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) 1fr', gap: '24px', alignItems: 'start' }} className="breakdowns-grid">
          {/* Archive list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sorted.map((b) => {
              const isOpen = open && open.id === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onOpen(b.id)}
                  className="glass-card"
                  style={{
                    textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', font: 'inherit', border: isOpen ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                    background: isOpen ? 'rgba(var(--accent-rgb), 0.06)' : undefined, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{b.title}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {formatDate(b.sendDate)}{b.difficulty ? ` · ${b.difficulty}` : ''}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected breakdown */}
          {open && (
            <div className="glass-card" style={{ padding: '28px 30px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                {open.difficulty && (
                  <span className="badge" style={{ fontSize: '0.62rem', color: DIFFICULTY_COLOR[open.difficulty], background: 'transparent', border: `1px solid ${DIFFICULTY_COLOR[open.difficulty]}` }}>{open.difficulty}</span>
                )}
                {open.sourceLabel && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{open.sourceLabel}</span>}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{formatDate(open.sendDate)}</span>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>{open.title}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '20px', borderLeft: '3px solid var(--accent-cyan)', paddingLeft: '14px' }}>{open.blurb}</p>

              {isSafeUrl(open.fullUrl) && (
                <a href={open.fullUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ marginBottom: '22px', fontSize: '0.82rem' }}>
                  <ExternalLink size={14} /> Full illustrated breakdown
                </a>
              )}

              <div
                className="markdown-body"
                style={{ fontSize: '0.92rem', lineHeight: 1.68, color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(open.bodyMd) }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
