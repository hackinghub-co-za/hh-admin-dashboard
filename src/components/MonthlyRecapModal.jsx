import { CheckSquare, Award, Target, CalendarDays } from 'lucide-react';

// Monthly Recap - a Duolingo/Spotify-Wrapped-style celebration shown once,
// automatically, the first time a member opens the Dashboard on the last
// day of the month (see MemberPortal's isLastDayOfMonth check). Every
// number is a rollup of data this app already tracks - no new tracking
// system, no new migration. Non-blocking (unlike DailyQuestionModal):
// backdrop click and the button both close it, since this is a celebration,
// not something that gates the portal.
//
// Two stats from the original design ("1-on-1s had", "presentations given")
// aren't included here - neither has a real dated history anywhere in the
// schema yet (1-on-1s only ever show the single next upcoming one, live
// from Google Calendar; matchmaker_groups has no "presented on" timestamp,
// only created_at, which is group-formation time, not presentation time).
// Showing a real feature with a made-up number felt worse than a shorter,
// honest one - see this file's companion note in the release notes.
export default function MonthlyRecapModal({ firstName, monthLabel, itemsCount, certsCount, roomsCount, eventsCount, totalCount, currentStreak, onClose }) {
  const stats = [
    { icon: CheckSquare, value: itemsCount, label: `Roadmap item${itemsCount === 1 ? '' : 's'} ticked off`, color: 'var(--accent-cyan)', bg: 'rgba(var(--accent-rgb), 0.14)' },
    { icon: Award, value: certsCount, label: `Cert${certsCount === 1 ? '' : 's'} completed`, color: 'var(--medal-gold)', bg: 'var(--medal-gold-bg)' },
    { icon: Target, value: roomsCount, label: `TryHackMe room${roomsCount === 1 ? '' : 's'} completed`, color: 'var(--info)', bg: 'rgba(59, 130, 246, 0.14)' },
    { icon: CalendarDays, value: eventsCount, label: `Event${eventsCount === 1 ? '' : 's'} attended`, color: 'var(--warning)', bg: 'rgba(var(--warning-rgb), 0.14)' },
  ];

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
        className="duo-pop"
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 'var(--border-radius-lg)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--glass-shadow)',
          padding: '36px 32px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{monthLabel}</span>
        <span style={{ fontSize: '1.15rem', fontWeight: 800, textAlign: 'center', marginBottom: '4px' }}>{firstName}'s Month in Review</span>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', margin: '10px 0 6px' }}>
          <span style={{ fontSize: '3.4rem', fontWeight: 800, lineHeight: 1, color: 'var(--accent-cyan)' }}>{totalCount}</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>thing{totalCount === 1 ? '' : 's'} you got done this month</span>
        </div>

        {currentStreak > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 16px', borderRadius: '999px', background: 'rgba(var(--warning-rgb), 0.1)', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px' }}>🔥</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--warning)' }}>{currentStreak} day{currentStreak === 1 ? '' : 's'} in a row right now</span>
          </div>
        )}

        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {stats.map(({ icon: Icon, value, label, color, bg }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 8px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-tertiary)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={17} color={color} />
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, lineHeight: 1 }}>{value}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </div>

        <button type="button" className="duo-continue" onClick={onClose} style={{ width: '100%', padding: '15px', borderRadius: 'var(--border-radius-lg)', border: 'none', borderBottom: '5px solid var(--accent-purple)', background: 'var(--accent-cyan)', color: 'var(--accent-ink)', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Keep Going
        </button>
      </div>
    </div>
  );
}
