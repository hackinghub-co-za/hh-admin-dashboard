import { useState } from 'react';
import { X, Sparkles, RotateCw } from 'lucide-react';

// Personal, per-member reveal for a freshly-formed Matchmaker group
// (supabase/030_matchmaker.sql's matchmaker_groups). The real grouping and
// Project/Presentation assignment already happened server-side, fairly, the
// moment an admin ran the round - this modal never picks a different
// outcome than what's already in `group`, it only paces out *revealing* it.
// Offered once per group; MemberPortal.jsx remembers "already revealed" in
// localStorage so a member isn't asked again on their next visit.

const SEGMENT_COLORS = ['var(--accent-cyan)', 'var(--accent-purple)', 'var(--success)', 'var(--warning)', 'var(--danger)'];
const SPIN_MS = 2800;
const MIN_SEGMENTS = 6; // pad with filler segments so a 2-person group's wheel doesn't look sparse
const CX = 130;
const CY = 130;
const R = 118;

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function polarToCartesian(angleDeg, radius) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function sliceMode(startAngle, endAngle) {
  const start = polarToCartesian(endAngle, R);
  const end = polarToCartesian(startAngle, R);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

// One reusable wheel: `segments` are the real, targetable labels; padded
// with decorative "?" filler up to MIN_SEGMENTS so it never looks sparse.
// `onLanded(realIndexWithinSegments)` fires once the spin settles. The
// caller remounts this component (via a changing `key`) whenever the
// segment set shrinks, so each fresh wheel starts from rotation 0.
function Wheel({ segments, onLanded }) {
  const fillerCount = Math.max(0, MIN_SEGMENTS - segments.length);
  const filler = Array.from({ length: fillerCount }, () => '?');
  const allLabels = [...segments, ...filler];
  const n = allLabels.length;
  const segAngle = 360 / n;

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const reduced = prefersReducedMotion();

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const targetIdx = Math.floor(Math.random() * segments.length); // always a real segment, never filler
    const targetCenter = (targetIdx + 0.5) * segAngle;
    const jitter = (Math.random() - 0.5) * segAngle * 0.6;
    const effectiveCurrent = ((rotation % 360) + 360) % 360;
    const delta = (360 - targetCenter + jitter - effectiveCurrent + 3600) % 360;
    const spins = reduced ? 0 : 5;
    const nextRotation = rotation + spins * 360 + delta;
    setRotation(nextRotation);
    setTimeout(() => {
      setSpinning(false);
      onLanded(targetIdx);
    }, reduced ? 0 : SPIN_MS);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
      <div style={{ position: 'relative', width: '260px', height: '260px' }}>
        <div
          style={{
            position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
            borderTop: '16px solid var(--accent-cyan)', zIndex: 2, filter: 'drop-shadow(0 0 4px rgba(var(--accent-rgb), 0.6))',
          }}
        />
        <svg
          viewBox="0 0 260 260"
          width="260"
          height="260"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: reduced ? 'none' : `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.67, 0.1, 1)`,
          }}
        >
          {allLabels.map((label, i) => {
            const start = i * segAngle;
            const end = start + segAngle;
            const mid = start + segAngle / 2;
            const isFiller = i >= segments.length;
            const labelPos = polarToCartesian(mid, R * 0.66);
            return (
              <g key={i}>
                <path
                  d={sliceMode(start, end)}
                  style={{ fill: isFiller ? 'var(--bg-tertiary)' : SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                  stroke="var(--bg-primary)"
                  strokeWidth="2"
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fill: isFiller ? 'var(--text-muted)' : 'var(--accent-ink)',
                    fontSize: isFiller ? '14px' : '11px',
                    fontWeight: 700,
                  }}
                >
                  {isFiller ? label : label.length > 14 ? `${label.slice(0, 13)}…` : label}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r="20" style={{ fill: 'var(--bg-secondary)' }} stroke="var(--accent-cyan)" strokeWidth="2" />
        </svg>
      </div>
      <button className="btn btn-primary" onClick={spin} disabled={spinning}>
        <RotateCw size={15} className={spinning ? 'animate-spin' : ''} /> {spinning ? 'Spinning...' : 'Spin'}
      </button>
    </div>
  );
}

export default function MatchmakerWheelModal({ group, nameForEmail, myEmailLower, onReveal, onClose }) {
  const [phase, setPhase] = useState('choice'); // choice | teammates | activity | done
  const teammateEmails = group.memberEmails.filter((e) => e.toLowerCase() !== myEmailLower);
  const [revealedTeammates, setRevealedTeammates] = useState([]);
  const [activityRevealed, setActivityRevealed] = useState(false);
  const [spinToken, setSpinToken] = useState(0);

  const remaining = teammateEmails.filter((e) => !revealedTeammates.includes(e));

  const handleTeammateLanded = (idx) => {
    const email = remaining[idx];
    setRevealedTeammates((prev) => [...prev, email]);
    setSpinToken((t) => t + 1);
  };

  const handleActivityLanded = () => {
    setActivityRevealed(true);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)',
        zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={phase === 'choice' ? onClose : undefined}
    >
      <div
        className="glass-card"
        style={{
          width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', padding: '32px',
          border: '1px solid var(--accent-cyan)', boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)', position: 'relative', textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'choice' && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%',
              width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        )}

        {phase === 'choice' && (
          <>
            <Sparkles size={28} color="var(--accent-cyan)" style={{ marginBottom: '10px' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>Your group is ready!</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              How do you want to see it?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-primary" onClick={onReveal}>Randomised — just show me</button>
              <button className="btn btn-secondary" onClick={() => setPhase('teammates')}>
                <Sparkles size={14} /> Spin the Wheel
              </button>
            </div>
          </>
        )}

        {phase === 'teammates' && (
          <>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px' }}>Who's on your team?</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              {remaining.length} of {teammateEmails.length} left to reveal
            </p>

            {revealedTeammates.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '18px' }}>
                {revealedTeammates.map((email) => (
                  <span key={email} className="badge badge-success" style={{ fontSize: '0.78rem' }}>{nameForEmail(email)}</span>
                ))}
              </div>
            )}

            {remaining.length > 0 ? (
              <Wheel key={spinToken} segments={remaining.map(nameForEmail)} onLanded={handleTeammateLanded} />
            ) : (
              <button className="btn btn-primary" onClick={() => setPhase('activity')} style={{ marginTop: '8px' }}>
                Next: Project or Presentation <Sparkles size={14} />
              </button>
            )}
          </>
        )}

        {phase === 'activity' && (
          <>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px' }}>Project or Presentation?</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>One more spin...</p>

            {!activityRevealed ? (
              <Wheel segments={['Project', 'Presentation']} onLanded={handleActivityLanded} />
            ) : (
              <>
                <div style={{ margin: '20px 0' }}>
                  <span className="badge badge-warning" style={{ fontSize: '1rem', padding: '10px 20px' }}>{group.activityType}</span>
                </div>
                <button className="btn btn-primary" onClick={() => setPhase('done')}>Continue</button>
              </>
            )}
          </>
        )}

        {phase === 'done' && (
          <>
            <Sparkles size={28} color="var(--accent-cyan)" style={{ marginBottom: '10px' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '18px' }}>That's your group!</h2>
            <button className="btn btn-primary" onClick={onReveal}>See Your Group</button>
          </>
        )}
      </div>
    </div>
  );
}
