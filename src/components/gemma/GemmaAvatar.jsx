import { useId } from 'react';

// Gemma's face: an illustrated woman with an afro puff, gold hoops and a
// headset mic, on the portal's navy. Drawn flat so it still reads at 24px.
export default function GemmaAvatar({ size = 36, online = false, badge = 0, ring = true }) {
  const clipId = `gemma-clip-${useId().replace(/:/g, '')}`;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label="Gemma"
        style={{ borderRadius: '50%', boxShadow: ring ? '0 0 0 1.5px rgba(var(--accent-rgb), 0.55), 0 0 14px rgba(var(--accent-rgb), 0.25)' : 'none' }}
      >
        <defs>
          <clipPath id={clipId}><circle cx="32" cy="32" r="32" /></clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect width="64" height="64" fill="#141838" />
          <circle cx="32" cy="58" r="30" fill="#1b2150" />
          {/* hair: puff + back */}
          <circle cx="32" cy="11" r="10.5" fill="#1d1211" />
          <ellipse cx="32" cy="28" rx="15.5" ry="16" fill="#1d1211" />
          {/* body + neck */}
          <path d="M8 64 Q10 48 32 46.5 Q54 48 56 64Z" fill="#17a856" />
          <path d="M26 46.8 L32 55 L38 46.8 Q32 49 26 46.8Z" fill="#0f7a3e" />
          <rect x="28.2" y="39" width="7.6" height="9" rx="3" fill="#86502f" />
          {/* face */}
          <ellipse cx="32" cy="31" rx="11.2" ry="12.6" fill="#9b5c35" />
          <path d="M20.2 29 Q20.5 16.5 32 16.5 Q43.5 16.5 43.8 29 Q40 21.5 32 21.8 Q24 21.5 20.2 29Z" fill="#1d1211" />
          {/* brows, eyes, lashes */}
          <path d="M25.2 27.2 Q27.6 25.9 29.8 27" stroke="#1d1211" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M34.2 27 Q36.4 25.9 38.8 27.2" stroke="#1d1211" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <ellipse cx="27.6" cy="30.6" rx="1.5" ry="1.8" fill="#1d1211" />
          <ellipse cx="36.4" cy="30.6" rx="1.5" ry="1.8" fill="#1d1211" />
          <path d="M25.6 29.6 L24.6 28.8 M38.4 29.6 L39.4 28.8" stroke="#1d1211" strokeWidth="0.9" strokeLinecap="round" />
          <circle cx="28.1" cy="30" r="0.45" fill="#fff" />
          <circle cx="36.9" cy="30" r="0.45" fill="#fff" />
          {/* nose, cheeks, smile */}
          <path d="M31.2 32.5 Q32 35 33.1 34.4" stroke="#7a4426" strokeWidth="0.9" fill="none" strokeLinecap="round" />
          <circle cx="25.6" cy="35" r="2" fill="#c8705f" opacity="0.35" />
          <circle cx="38.4" cy="35" r="2" fill="#c8705f" opacity="0.35" />
          <path d="M28.2 37.2 Q32 40.6 35.8 37.2 Q32 38.6 28.2 37.2Z" fill="#6e2c2a" />
          {/* gold hoops */}
          <circle cx="20.6" cy="37.6" r="3.1" stroke="#f2c14e" strokeWidth="1.3" fill="none" />
          <circle cx="43.4" cy="37.6" r="3.1" stroke="#f2c14e" strokeWidth="1.3" fill="none" />
          {/* headset */}
          <path d="M19.6 31 Q19 13.5 32 13 Q45 13.5 44.4 31" stroke="#5ee37a" strokeWidth="1.5" fill="none" />
          <rect x="42.6" y="28" width="3.8" height="6.4" rx="1.6" fill="#5ee37a" />
          <path d="M44.6 34 Q44.2 40.5 37.6 40.4" stroke="#5ee37a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <circle cx="37.2" cy="40.4" r="1.3" fill="#5ee37a" />
        </g>
      </svg>
      {online && (
        <span style={{ position: 'absolute', right: 0, bottom: 0, width: Math.max(8, size * 0.26), height: Math.max(8, size * 0.26), borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--bg-primary)' }} />
      )}
      {badge > 0 && (
        <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--warning)', color: '#12132b', fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {badge}
        </span>
      )}
    </span>
  );
}
