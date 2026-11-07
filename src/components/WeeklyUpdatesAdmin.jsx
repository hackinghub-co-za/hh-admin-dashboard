import { useEffect, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { fetchWeeklyUpdates, weekLabel, shiftWeek } from '../lib/weeklyUpdateData';
import { addCommunityWin } from '../lib/communityContentData';
import { friendlyErrorMessage } from '../lib/errorMessages';

// Founder-only Weekly Updates page (112_weekly_updates.sql): every answer for
// one week, blockers first, who hasn't answered yet, and a one-click way to
// post an achievement as a Recent Win (the text can be edited first).

const FIRST_WEEK = '2026-11-08';

const MOCK = {
  weekEnding: FIRST_WEEK, eligible: 6, submitted: 3, withBlocker: 1, withAchievement: 1, previousRate: null,
  answers: [
    { id: 1, email: 'mock-b@example.com', name: 'Example member B', location: 'Pretoria', did: 'Two AZ-104 modules and the storage lab.', next: 'Finish the networking module, book AZ-900.', achievement: '', blocker: 'My laptop freezes when I run the VM labs.' },
    { id: 2, email: 'mock-a@example.com', name: 'Example member A', location: 'Johannesburg', did: 'Finished the SOC Level 1 networking rooms, 6 study hours.', next: 'Splunk rooms and a mock interview.', achievement: 'got a first-round interview for a SOC internship', blocker: '' },
    { id: 3, email: 'mock-c@example.com', name: 'Example member C', location: 'Cape Town', did: 'Read ISO 27001 Annex A and drafted a risk register.', next: 'ISACA IT Risk Fundamentals practice questions.', achievement: '', blocker: '' },
  ],
  missing: [{ email: 'd@example.com', name: 'Example member D' }, { email: 'e@example.com', name: 'Example member E' }, { email: 'f@example.com', name: 'Example member F' }],
};

function Stat({ n, label, warn }) {
  return (
    <div className="glass-card" style={{ padding: '16px' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: warn ? 'var(--warning)' : 'var(--text-primary)' }}>{n}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function Answer({ title, text, emptyText }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '2px' }}>{title}</div>
      <p style={{ margin: 0, fontSize: '0.88rem', color: text ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text || emptyText}</p>
    </div>
  );
}

export default function WeeklyUpdatesAdmin({ isMockSession, user }) {
  const [week, setWeek] = useState(null); // null = current week
  const [thisWeek, setThisWeek] = useState(isMockSession ? MOCK.weekEnding : null);
  const [data, setData] = useState(isMockSession ? MOCK : null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [winDraft, setWinDraft] = useState({}); // answer id -> text being edited
  const [winPosted, setWinPosted] = useState({}); // answer id -> true

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchWeeklyUpdates(week)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError('');
        if (week === null) setThisWeek(d.weekEnding);
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => { cancelled = true; };
  }, [isMockSession, week]);

  const postWin = async (a) => {
    const text = (winDraft[a.id] || '').trim();
    if (!text) return;
    try {
      if (!isMockSession) {
        await addCommunityWin({
          member: (a.name || '').split(' ')[0] || a.name,
          memberEmail: a.email,
          achievement: text,
          achievedDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' }),
          linkedinUrl: '',
          createdBy: user?.email,
        });
      }
      setWinPosted((p) => ({ ...p, [a.id]: true }));
      setWinDraft((d) => { const next = { ...d }; delete next[a.id]; return next; });
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const current = data?.weekEnding;
  const rate = data && data.eligible ? Math.round((data.submitted / data.eligible) * 100) : 0;
  let answers = data?.answers || [];
  if (filter === 'blocked') answers = answers.filter((a) => a.blocker);
  if (filter === 'win') answers = answers.filter((a) => a.achievement);

  const chip = (id, label) => (
    <button
      key={id}
      type="button"
      aria-pressed={filter === id}
      onClick={() => setFilter(id)}
      style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '999px', cursor: 'pointer', fontWeight: 600, border: `1px solid ${filter === id ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: filter === id ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent', color: filter === id ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CalendarCheck size={28} color="var(--accent-cyan)" /> Weekly Updates
        </h1>
        <p>Every week, from Sunday, active members answer four questions before the portal opens. Only you can see these answers.</p>
        {isMockSession && <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '8px' }}>Mock Admin: these members are invented, to show how the screen works.</p>}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}
      {!data && !error && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" disabled={isMockSession || current <= FIRST_WEEK} onClick={() => setWeek(shiftWeek(current, -1))} aria-label="Previous week"><ChevronLeft size={16} /></button>
            <strong style={{ fontSize: '1.05rem' }}>{weekLabel(current)}</strong>
            <button type="button" className="btn btn-secondary" disabled={isMockSession || !thisWeek || current >= thisWeek} onClick={() => setWeek(shiftWeek(current, 1))} aria-label="Next week"><ChevronRight size={16} /></button>
            {current < FIRST_WEEK && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Weekly Updates start with the week ending Sunday 8 November.</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <Stat n={`${data.submitted} / ${data.eligible}`} label="active members answered" />
            <Stat n={`${rate}%`} label={data.previousRate == null ? 'response rate' : `response rate (week before: ${data.previousRate}%)`} />
            <Stat n={data.withBlocker} label="reported a blocker" warn={data.withBlocker > 0} />
            <Stat n={data.withAchievement} label="shared an achievement" />
          </div>

          <div role="group" aria-label="Filter answers" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {chip('all', `All (${data.answers.length})`)}
            {chip('blocked', `Blockers (${data.withBlocker})`)}
            {chip('win', `Achievements (${data.withAchievement})`)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {answers.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No answers here yet.</p>}
            {answers.map((a) => (
              <article key={a.id} className="glass-card" style={{ padding: '18px', borderLeft: a.blocker ? '4px solid var(--warning)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div>
                    <strong>{a.name}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{[a.location, a.email].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    {a.blocker && <span className="badge badge-warning">Blocker</span>}
                    {a.achievement && <span className="badge badge-success">Achievement</span>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px 20px' }}>
                  <Answer title="This week" text={a.did} />
                  <Answer title="Next week" text={a.next} />
                  <Answer title="Achievement" text={a.achievement} emptyText="Nothing this week" />
                  <Answer title="Blocker" text={a.blocker} emptyText="No blockers" />
                </div>

                {a.achievement && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    {winPosted[a.id] ? (
                      <span style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>Posted to Recent Wins.</span>
                    ) : winDraft[a.id] === undefined ? (
                      <button type="button" className="btn btn-secondary" onClick={() => setWinDraft((d) => ({ ...d, [a.id]: a.achievement }))}>
                        <Trophy size={14} /> Post as a Recent Win
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{(a.name || '').split(' ')[0]}</span>
                        <input
                          className="form-input"
                          aria-label="Win text"
                          value={winDraft[a.id]}
                          onChange={(e) => setWinDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                          style={{ flex: 1, minWidth: '220px' }}
                        />
                        <button type="button" className="btn btn-primary" onClick={() => postWin(a)} disabled={!winDraft[a.id]?.trim()}>Post</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setWinDraft((d) => { const n = { ...d }; delete n[a.id]; return n; })}>Cancel</button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>

          {data.missing.length > 0 && (
            <div className="glass-card" style={{ padding: '16px', marginTop: '16px' }}>
              <strong>{data.missing.length} still to answer</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                They’ll see the card the next time they sign in this week. {data.missing.map((m) => m.name).join(', ')}.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
