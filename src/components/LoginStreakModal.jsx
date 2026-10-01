import { X, Flame, Trophy } from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Builds the GitHub-style grid: weeks (columns, oldest to newest) of 7 days
// (rows, Sun-Sat), covering the trailing ~year. Starts on the most recent
// Sunday on/before the window start so every week column is a real,
// complete Sun-Sat week, same as GitHub's own contribution graph.
function buildWeeks(loggedInDates, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today.getTime() - days * DAY_MS);
  const gridStart = new Date(windowStart.getTime() - windowStart.getDay() * DAY_MS);

  const weeks = [];
  let cursor = new Date(gridStart);
  while (cursor <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = toDateStr(cursor);
      week.push({
        dateStr,
        inRange: cursor >= windowStart && cursor <= today,
        loggedIn: loggedInDates.has(dateStr),
        isMonthStart: cursor.getDate() <= 7,
        month: cursor.getMonth(),
      });
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    weeks.push(week);
  }
  return weeks;
}

// One label per week column that starts a new month - avoids a label on
// every single week, same as GitHub's own sparse month row. A plain
// function (not inline in the component) so its local mutation of
// `lastMonth` while scanning stays outside the render body itself.
function buildMonthLabels(weeks) {
  let lastMonth = null;
  return weeks.map((week) => {
    const firstRealDay = week.find((d) => d.inRange) || week[0];
    if (firstRealDay.month !== lastMonth) {
      lastMonth = firstRealDay.month;
      return MONTH_LABELS[firstRealDay.month];
    }
    return null;
  });
}

export default function LoginStreakModal({ currentStreak, longestStreak, loginHistory, topStreak, loading, onClose }) {
  const weeks = buildWeeks(loginHistory, 371);
  const monthLabels = buildMonthLabels(weeks);

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{ width: '100%', maxWidth: '780px', maxHeight: '85vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>🔥</span>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Login Streak</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--warning-rgb), 0.08)', border: '1px solid rgba(var(--warning-rgb), 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
              <Flame size={13} /> Current Streak
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.6rem' }}>{currentStreak} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)' }}>day{currentStreak === 1 ? '' : 's'}</span></div>
          </div>

          <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--accent-rgb), 0.05)', border: '1px solid rgba(var(--accent-rgb), 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
              <Trophy size={13} /> Your Longest Streak
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.6rem' }}>{longestStreak} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)' }}>day{longestStreak === 1 ? '' : 's'}</span></div>
          </div>

          <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--success-rgb), 0.06)', border: '1px solid rgba(var(--success-rgb), 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
              <Trophy size={13} color="var(--success)" /> Community Leader
            </div>
            {topStreak ? (
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {topStreak.fullName || 'A fellow member'}
                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)', marginTop: '2px' }}>{topStreak.streak} day{topStreak.streak === 1 ? '' : 's'} in a row</span>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No active streaks yet</div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Your login history, last 12 months</div>
        {loading ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</p>
        ) : (
        <div style={{ overflowX: 'auto', paddingBottom: '6px' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', minWidth: `${weeks.length * 13}px` }}>
            <div style={{ display: 'flex', gap: '3px', height: '14px' }}>
              {monthLabels.map((label, i) => (
                <div key={i} style={{ width: '10px', fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0, position: 'relative' }}>
                  {label && <span style={{ position: 'absolute', whiteSpace: 'nowrap' }}>{label}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      title={day.inRange ? `${day.dateStr}${day.loggedIn ? ' - logged in' : ''}` : undefined}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '2px',
                        background: !day.inRange
                          ? 'transparent'
                          : day.loggedIn
                            ? 'var(--success)'
                            : 'var(--bg-tertiary)',
                        border: day.inRange && !day.loggedIn ? '1px solid var(--border-color)' : 'none',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
