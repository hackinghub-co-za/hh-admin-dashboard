import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import { isSafeUrl } from '../lib/safeUrl';

// A member's headshot next to their name, with their profile card on hover
// (or keyboard focus, or a tap on a touch screen). Used on the Cert Calendar
// on both the admin and member side. `profile` is whatever profile object
// that side already has for the member (the admin's member_profiles overlay,
// or a member's public directory card): both use the same field names for
// the parts shown here. The card renders in a portal with fixed positioning,
// because the glass cards it sits inside would otherwise clip it.
const CARD_WIDTH = 300;

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Avatar({ name, url, size }) {
  const [broken, setBroken] = useState(false);
  const common = { width: size, height: size, borderRadius: '50%', flexShrink: 0 };
  if (url && !broken) {
    return <img src={url} alt="" onError={() => setBroken(true)} style={{ ...common, objectFit: 'cover', border: '1px solid var(--border-color)' }} />;
  }
  return (
    <span aria-hidden="true" style={{ ...common, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: `${Math.max(11, Math.round(size * 0.38))}px` }}>
      {initials(name)}
    </span>
  );
}

export default function MemberHoverCard({ name, email, profile, size = 36, nameStyle }) {
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const closeTimer = useRef(null);

  const open = useCallback(() => {
    clearTimeout(closeTimer.current);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 8));
    const below = rect.bottom + 8;
    const top = below + 260 > window.innerHeight ? Math.max(8, rect.top - 8) : below;
    setPos({ left, top, above: below + 260 > window.innerHeight });
  }, []);
  const closeSoon = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPos(null), 120);
  }, []);

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!pos) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPos(null); };
    const onScroll = () => setPos(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll, true); };
  }, [pos]);

  const p = profile || {};
  const displayName = name || p.fullName || email || 'Member';
  const meta = [p.specialty && p.specialty !== 'Not Set' ? p.specialty : '', p.location].filter(Boolean).join(' · ');
  const work = [p.jobTitle, p.employmentStatus && p.employmentStatus !== 'Not Set' ? p.employmentStatus : ''].filter(Boolean).join(' · ');
  const rows = [
    ['Experience', p.yearsExperience !== null && p.yearsExperience !== undefined && p.yearsExperience !== '' ? `${p.yearsExperience} year${Number(p.yearsExperience) === 1 ? '' : 's'}` : ''],
    ['Certifications', p.certifications],
    ['Fun fact', p.funFact],
  ].filter(([, v]) => v);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={!!pos}
        aria-label={`${displayName}, show profile`}
        onMouseEnter={open}
        onMouseLeave={closeSoon}
        onFocus={open}
        onBlur={closeSoon}
        onClick={(e) => { e.stopPropagation(); if (pos) setPos(null); else open(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (pos) setPos(null); else open(); } }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'default', maxWidth: '100%' }}
      >
        <Avatar name={displayName} url={p.headshotUrl} size={size} />
        <span style={{ fontWeight: 700, overflowWrap: 'anywhere', ...nameStyle }}>{displayName}</span>
      </span>
      {pos && createPortal(
        <div
          role="dialog"
          aria-label={`${displayName} profile`}
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={closeSoon}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            transform: pos.above ? 'translateY(-100%)' : 'none',
            width: CARD_WIDTH,
            maxWidth: 'calc(100vw - 16px)',
            zIndex: 2000,
            background: 'var(--bg-primary)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: 'var(--border-radius-md)',
            boxShadow: 'var(--glass-shadow)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar name={displayName} url={p.headshotUrl} size={56} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', overflowWrap: 'anywhere' }}>{displayName}</div>
              {meta && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{meta}</div>}
              {work && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{work}</div>}
            </div>
          </div>
          {p.about ? (
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.about}</p>
          ) : (
            !rows.length && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>No profile details added yet.</p>
          )}
          {rows.map(([label, value]) => (
            <div key={label} style={{ fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
              <span style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{value}</span>
            </div>
          ))}
          {isSafeUrl(p.linkedin) && (
            <a href={p.linkedin} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>
              <ExternalLink size={13} /> LinkedIn
            </a>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
