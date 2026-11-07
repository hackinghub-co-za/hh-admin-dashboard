import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { submitMyWeeklyUpdate, weekLabel, MIN_ANSWER, MAX_ANSWER } from '../lib/weeklyUpdateData';
import { friendlyMemberErrorMessage } from '../lib/errorMessages';
import logo from '../assets/hacking-hub-logo-sm.png';

// Weekly Updates (112_weekly_updates.sql) - shown instead of the portal the
// first time an active member signs in each week, from Sunday, until they've
// answered. Same shell as ProfileGate. The first two questions are required;
// achievements and blockers each have a "nothing" button. After submitting,
// a short thank-you with their Sunday streak, then the portal.

const QUESTIONS = [
  { key: 'did', label: 'What did you do this week?', placeholder: 'e.g. Finished TryHackMe Pre-Security, logged 6 study hours, sent 4 applications', required: true },
  { key: 'next', label: 'What will you work on next week?', placeholder: 'e.g. Start the Splunk rooms, book a mock interview', required: true },
  { key: 'achievement', label: 'Any major achievements?', placeholder: 'Passed a cert, got an interview, finished a project…', none: 'Nothing this week' },
  { key: 'blocker', label: 'Any major blockers?', placeholder: 'Anything stopping you: time, money, a topic you’re stuck on…', none: 'No blockers' },
];

export default function WeeklyUpdateGate({ user, weekEnding, onDone, onLogout }) {
  const [answers, setAnswers] = useState({ did: '', next: '', achievement: '', blocker: '' });
  const [nothing, setNothing] = useState({ achievement: false, blocker: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [streak, setStreak] = useState(null);
  const firstName = (user?.user_metadata?.full_name || '').split(' ')[0];

  const set = (key, value) => {
    setAnswers((a) => ({ ...a, [key]: value.slice(0, MAX_ANSWER) }));
    setError('');
  };
  const toggleNothing = (key) => {
    setNothing((n) => ({ ...n, [key]: !n[key] }));
    set(key, '');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (answers.did.trim().length < MIN_ANSWER) return setError('Tell us what you did this week (a sentence is enough).');
    if (answers.next.trim().length < MIN_ANSWER) return setError('Add what you’ll work on next week.');
    setError('');
    setSaving(true);
    try {
      const result = await submitMyWeeklyUpdate({
        did: answers.did.trim(),
        next: answers.next.trim(),
        achievement: nothing.achievement ? '' : answers.achievement.trim(),
        blocker: nothing.blocker ? '' : answers.blocker.trim(),
      });
      setStreak(result.streak);
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const shell = (children) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', background: 'radial-gradient(circle at 80% 0%, rgba(var(--accent-rgb), 0.10), transparent 55%), var(--bg-primary)' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '580px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px', border: '1px solid rgba(var(--accent-rgb), 0.2)' }} role="dialog" aria-modal="true" aria-labelledby="weekly-update-title">
        {children}
      </div>
    </div>
  );

  if (streak !== null) {
    return shell(
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center', padding: '12px 0' }}>
        <div className="duo-pop" style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(var(--accent-rgb), 0.14)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px', fontWeight: 800 }}>✓</div>
        <h1 id="weekly-update-title" style={{ fontSize: '1.35rem', margin: 0 }}>Update sent. Have a great week{firstName ? `, ${firstName}` : ''}.</h1>
        {streak > 1 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-color)', fontWeight: 700, fontSize: '0.9rem' }}>
            🔥 {streak} weeks in a row
          </span>
        )}
        <button type="button" className="btn btn-primary" onClick={onDone} style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}>Open the portal</button>
      </div>
    );
  }

  return shell(
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} noValidate>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src={logo} alt="Hacking Hub" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>Weekly update</div>
          <h1 id="weekly-update-title" style={{ fontSize: '1.3rem', margin: '2px 0 0' }}>How was your week{firstName ? `, ${firstName}` : ''}?</h1>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px 8px', whiteSpace: 'nowrap' }}>{weekLabel(weekEnding)}</span>
      </div>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        A quick look back and a plan for the week ahead. Siya reads every update, and only Siya sees them.
      </p>

      {QUESTIONS.map((q) => {
        const off = q.none && nothing[q.key];
        return (
          <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <label htmlFor={`wu-${q.key}`} style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                {q.label}
                {!q.required && <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.8rem' }}>optional</span>}
              </label>
              {q.none && (
                <button
                  type="button"
                  aria-pressed={off}
                  onClick={() => toggleNothing(q.key)}
                  style={{
                    font: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap',
                    color: off ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    background: off ? 'rgba(var(--accent-rgb), 0.14)' : 'transparent',
                    border: `1px ${off ? 'solid' : 'dashed'} ${off ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                  }}
                >
                  {q.none}
                </button>
              )}
            </div>
            <textarea
              id={`wu-${q.key}`}
              className="form-input"
              rows={3}
              value={answers[q.key]}
              onChange={(e) => set(q.key, e.target.value)}
              placeholder={off ? q.none : q.placeholder}
              disabled={off}
              maxLength={MAX_ANSWER}
              style={{ resize: 'vertical', opacity: off ? 0.5 : 1 }}
            />
            {q.required && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>{answers[q.key].length} / {MAX_ANSWER}</div>}
          </div>
        );
      })}

      {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
        {saving ? 'Sending...' : 'Send update and open the portal'}
      </button>
      <div style={{ textAlign: 'center' }}>
        <button type="button" onClick={onLogout} style={{ font: 'inherit', fontSize: '0.78rem', background: 'none', border: 0, color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
          <LogOut size={12} style={{ verticalAlign: '-1px', marginRight: '4px' }} />Sign out
        </button>
      </div>
    </form>
  );
}
