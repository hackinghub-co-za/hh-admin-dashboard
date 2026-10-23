import { useState, useEffect, useCallback } from 'react';
import { UserPlus } from 'lucide-react';
import { formatDate } from '../lib/dateFormat';
import { friendlyErrorMessage } from '../lib/errorMessages';
import { fetchNewMembersOnboarding, setMemberOnboardingStep } from '../lib/onboardingData';
import { NEW_MEMBER_STEPS, onboardingProgress, waitingOn } from '../lib/newMembersHelpers';

// "New members" (supabase/006_onboarding.sql PART 4) - for Lesedi and admins:
// everyone who started in the last 30 days, how far through the checklist
// they are, and who the next move belongs to. Two tick boxes are hers:
// "LinkedIn reviewed" and "Intro approved". Approval needs the LinkedIn
// review first, and unticking the review withdraws an approval.

const DAYS = 30;
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const dayOnly = (iso) => iso.slice(0, 10);

const MOCK_MEMBERS = [
  { email: 'thabo.r@example.com', name: 'Thabo R.', startDate: dayOnly(isoDaysAgo(2)), steps: { watch_video: isoDaysAgo(2), setup_profile: isoDaysAgo(2), join_whatsapp: isoDaysAgo(2), say_hi_lesedi: isoDaysAgo(1) } },
  { email: 'thando.k@example.com', name: 'Thando K.', startDate: dayOnly(isoDaysAgo(9)), steps: Object.fromEntries(NEW_MEMBER_STEPS.map((k) => [k, isoDaysAgo(4)])) },
  { email: 'nandi.p@example.com', name: 'Nandi P.', startDate: dayOnly(isoDaysAgo(1)), steps: { setup_profile: isoDaysAgo(1), join_whatsapp: isoDaysAgo(1) } },
];

export default function NewMembersOnboarding({ isMockSession }) {
  const [members, setMembers] = useState(isMockSession ? MOCK_MEMBERS : []);
  const [loading, setLoading] = useState(!isMockSession);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchNewMembersOnboarding(DAYS)
      .then((rows) => { if (!cancelled) { setMembers(rows); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(friendlyErrorMessage(err)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [isMockSession]);

  const toggle = useCallback(async (member, stepKey) => {
    const turningOn = !member.steps[stepKey];
    const busy = `${member.email}:${stepKey}`;
    setBusyKey(busy);
    setError(null);
    const nextSteps = { ...member.steps };
    if (turningOn) nextSteps[stepKey] = new Date().toISOString();
    else {
      delete nextSteps[stepKey];
      // Mirrors the server: withdrawing the LinkedIn review withdraws the intro approval.
      if (stepKey === 'linkedin_reviewed') delete nextSteps.intro_approved;
    }
    try {
      if (!isMockSession) await setMemberOnboardingStep(member.email, stepKey, turningOn);
      setMembers((prev) => prev.map((m) => (m.email === member.email ? { ...m, steps: nextSteps } : m)));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }, [isMockSession]);

  const waitingOnLesedi = members.filter((m) => waitingOn(m.steps).who === 'lesedi').length;

  const toggleButton = (member, stepKey, onLabel, offLabel, disabled) => {
    const on = !!member.steps[stepKey];
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled || busyKey === `${member.email}:${stepKey}`}
        onClick={() => toggle(member, stepKey)}
        className={on ? 'btn btn-primary' : 'btn btn-secondary'}
        style={{ fontSize: '0.78rem', padding: '6px 12px', opacity: disabled ? 0.5 : 1 }}
      >
        {on ? onLabel : offLabel}
      </button>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <UserPlus size={26} color="var(--accent-cyan)" />
          <h1 style={{ fontSize: '2rem', margin: 0 }}>New members</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '62ch' }}>
          Everyone who started in the last {DAYS} days. Tick &quot;LinkedIn reviewed&quot; once you have fixed their profile with them, then &quot;Approve&quot; once their intro message is ready. That unlocks the step where they post it in the group.
        </p>
        {!loading && members.length > 0 && (
          <p style={{ marginTop: '10px', fontSize: '0.9rem', fontWeight: 600 }}>
            {waitingOnLesedi === 0 ? 'Nobody is waiting on you.' : `${waitingOnLesedi} ${waitingOnLesedi === 1 ? 'member is' : 'members are'} waiting on you.`}
          </p>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}
      {!loading && members.length === 0 && !error && (
        <div className="glass-card"><p style={{ color: 'var(--text-secondary)' }}>No new members in the last {DAYS} days.</p></div>
      )}

      {members.length > 0 && (
        <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 16px' }}>Member</th>
                <th style={{ padding: '14px 16px' }}>Started</th>
                <th style={{ padding: '14px 16px' }}>Progress</th>
                <th style={{ padding: '14px 16px' }}>LinkedIn</th>
                <th style={{ padding: '14px 16px' }}>Intro</th>
                <th style={{ padding: '14px 16px' }}>Waiting on</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const done = onboardingProgress(m.steps);
                const wait = waitingOn(m.steps);
                return (
                  <tr key={m.email} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700 }}>{m.name || m.email}</div>
                      {m.name && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.email}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{m.startDate ? formatDate(m.startDate) : ''}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div role="img" aria-label={`${done} of ${NEW_MEMBER_STEPS.length} steps done`} style={{ display: 'flex', gap: '4px' }}>
                        {NEW_MEMBER_STEPS.map((key, i) => (
                          <span key={key} style={{ width: '14px', height: '6px', borderRadius: '3px', background: i < done ? 'var(--accent-cyan)' : 'var(--border-color)' }} />
                        ))}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>{done} / {NEW_MEMBER_STEPS.length}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>{toggleButton(m, 'linkedin_reviewed', 'Reviewed', 'Mark reviewed', !!m.steps.intro_posted)}</td>
                    <td style={{ padding: '14px 16px' }}>{toggleButton(m, 'intro_approved', 'Approved', 'Approve', !m.steps.linkedin_reviewed || !!m.steps.intro_posted)}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: wait.who === 'lesedi' ? 'var(--warning, #f5b942)' : wait.who === 'done' ? 'var(--accent-cyan)' : 'inherit' }}>{wait.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
