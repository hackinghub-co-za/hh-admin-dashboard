import { X, ShieldCheck, Ban } from 'lucide-react';

// In-app Study Hours rules for the "Learn More" button next to the timer -
// same move CompetitionRulesModal already made over an external doc: a
// real, always-in-sync guide instead of paraphrased copy someone forgets
// to update.
const SECTIONS = [
  {
    heading: 'What counts',
    body: 'A session started and run to completion right here in the portal - the timer counting down to zero is the proof. Closing the tab or navigating away mid-session doesn\'t log anything.',
  },
  {
    heading: 'Session lengths',
    body: 'Pick 25, 45, or 60 minutes when you start. Whatever you picked is what gets logged the moment it completes - there\'s no partial credit for stopping early.',
  },
  {
    heading: 'Streaks',
    body: 'Finishing at least one session today keeps your streak alive. Finishing three today doesn\'t triple it - a streak counts days, not sessions. Miss a day entirely and it resets to 1 on your next session.',
  },
  {
    heading: 'Opt in, opt out any time',
    body: 'Joining is what puts you on the leaderboard - nothing you do before clicking "Track My Study Hours" is logged. Opt out any time and your stats are kept, just hidden, so rejoining later picks up exactly where you left off.',
  },
  {
    heading: 'Honest by design, not policed',
    body: 'This is Phase 1 of a bigger plan - there\'s no admin approval queue like Room Logs, because the timer itself is the verification. It doesn\'t know if you were actually focused the whole time, only that the tab was open for the full length you chose. Treat it the same way you\'d treat any honor system: it only works if you don\'t game it.',
    danger: true,
  },
];

export default function StudyHoursRulesModal({ onClose }) {
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
          <ShieldCheck size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Study Hours Rules</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          How sessions get logged, streaks work, and what this can and can't verify - read this before you start.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SECTIONS.map((s) => (
            <div
              key={s.heading}
              style={{
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
                ...(s.danger
                  ? { background: 'rgba(var(--danger-rgb), 0.06)', border: '1px solid rgba(var(--danger-rgb), 0.2)', borderRadius: 'var(--border-radius-sm)', padding: '14px', marginBottom: '-2px' }
                  : {}),
              }}
            >
              <h4
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: s.danger ? 'var(--danger)' : 'var(--accent-cyan)',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {s.danger && <Ban size={14} />} {s.heading}
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
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
