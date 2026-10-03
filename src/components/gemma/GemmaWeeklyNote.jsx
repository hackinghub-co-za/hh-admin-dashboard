import { useState, useEffect } from 'react';
import { ArrowRight, X } from 'lucide-react';
import GemmaAvatar from './GemmaAvatar';
import { GEMMA_ACTIONS, runGemmaAction } from './gemmaActions';
import { MOCK_WEEKLY_NOTE } from './gemmaMock';
import { fetchWeeklyNote, dismissWeeklyNote } from '../../lib/gemmaData';

// Dashboard card: Gemma's note for this week (generated once a week per
// member, server-side, from the same progress snapshot she chats with).
export default function GemmaWeeklyNote({ isMockSession, setActiveTab }) {
  const [note, setNote] = useState(isMockSession ? MOCK_WEEKLY_NOTE : null);

  useEffect(() => {
    if (isMockSession) return;
    fetchWeeklyNote().then(setNote).catch(() => {});
  }, [isMockSession]);

  useEffect(() => {
    const onDismiss = () => setNote((n) => (n ? { ...n, dismissed: true } : n));
    window.addEventListener('gemma:note-dismissed', onDismiss);
    return () => window.removeEventListener('gemma:note-dismissed', onDismiss);
  }, []);

  if (!note || note.dismissed) return null;

  const dismiss = () => {
    if (!isMockSession) dismissWeeklyNote(note.weekStart).catch(() => {});
    window.dispatchEvent(new Event('gemma:note-dismissed'));
  };

  const action = note.action && GEMMA_ACTIONS[note.action];

  return (
    <div className="glass-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px', border: '1px solid rgba(var(--accent-rgb), 0.35)' }}>
      <GemmaAvatar size={46} online />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Gemma's note this week</span>
        <strong style={{ fontSize: '1rem' }}>{note.headline}</strong>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{note.body}</p>
        <div className="gemma-actions" style={{ marginTop: '4px' }}>
          {action && (
            <button className="gemma-action" onClick={() => (action.quiz ? setActiveTab('gemma') : runGemmaAction(note.action, setActiveTab))}>
              <ArrowRight size={13} /> {action.label}
            </button>
          )}
          <button className="gemma-action gemma-action-quiet" onClick={() => setActiveTab('gemma')}>Chat with Gemma</button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Dismiss Gemma's note" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
        <X size={16} />
      </button>
    </div>
  );
}
