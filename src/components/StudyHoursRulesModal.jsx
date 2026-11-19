import { X, ShieldCheck, Ban } from 'lucide-react';

// "Learn More" for the Study Marathon on the Competitions tab (the Study
// Hours timer and leaderboard, 081_study_sessions.sql). Same in-app guide
// pattern as CompetitionRulesModal, so the rules never drift from the app.
const SECTIONS = [
  {
    heading: 'What the Study Marathon is',
    body: 'A community-wide push to put in real study hours. It started on Monday 16 November, and only sessions from that day onward count. Join, run focused sessions with the timer, and climb the leaderboard alongside everyone else.',
  },
  {
    heading: 'What counts',
    body: 'A session you start here and let run to zero. The moment it finishes, it logs itself. You can switch tabs, open your study material in another window or minimise the browser: the timer keeps running. Even if you close the portal, it finishes on time and logs the next time you open it.',
  },
  {
    heading: 'Session lengths',
    body: 'Pick 25, 45 or 60 minutes, or set your own between 5 and 180. The length you picked is what gets logged. Stopping early with Reset logs nothing, and Pause holds the time you have left.',
  },
  {
    heading: 'Streaks',
    body: 'Finish at least one session a day to keep your streak going. Three sessions in one day still count as one day. Miss a day and your streak starts again at 1 on your next session.',
  },
  {
    heading: 'Joining and leaving',
    body: 'Click "Join the Study Marathon" to appear on the leaderboard. You can leave any time; your hours are kept, so rejoining picks up where you left off.',
  },
  {
    heading: 'Play fair',
    body: 'There is no approval queue: the timer is the record. It knows the session ran, not whether you were studying, so only start it when you are actually putting the work in.',
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>The Study Marathon</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          What it is, how sessions count, and how the leaderboard works.
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
