import { useState } from 'react';
import { X, ShieldCheck, CheckSquare, Square, GraduationCap } from 'lucide-react';
import { computeReadinessPercent } from '../lib/examReadinessData';

// Interactive companion to SecurityPlusGuideModal.jsx's read-only shell -
// same overlay/card/close-button chrome, but with a real checklist +
// score input instead of static links. Readiness % itself is computed by
// the shared computeReadinessPercent (src/lib/examReadinessData.js) so
// this modal and the Cert Calendar card badge always agree.

export default function ExamReadinessModal({
  certLabel,
  milestones,
  checklist,
  latestPracticeScore,
  latestPracticeScoreAt,
  onToggleMilestone,
  onSaveScore,
  onTakeQuiz,
  onClose,
}) {
  const [scoreInput, setScoreInput] = useState(typeof latestPracticeScore === 'number' ? String(latestPracticeScore) : '');
  const [savingScore, setSavingScore] = useState(false);
  const [scoreError, setScoreError] = useState(null);

  const doneCount = milestones.filter((m) => checklist?.[m.key]).length;
  const checklistPct = milestones.length ? Math.round((doneCount / milestones.length) * 100) : 0;
  const readinessPct = computeReadinessPercent(milestones, checklist, latestPracticeScore);

  const handleSaveScore = async () => {
    const n = Number(scoreInput);
    if (scoreInput === '' || Number.isNaN(n) || n < 0 || n > 100) {
      setScoreError('Enter a score between 0 and 100.');
      return;
    }
    setScoreError(null);
    setSavingScore(true);
    try {
      await onSaveScore(Math.round(n));
    } finally {
      setSavingScore(false);
    }
  };

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
          maxWidth: '560px',
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

        <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Exam Readiness</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>{certLabel}</p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderRadius: 'var(--border-radius-md)',
            background: 'rgba(var(--accent-rgb), 0.06)',
            border: '1px solid rgba(var(--accent-rgb), 0.2)',
            marginBottom: '24px',
          }}
        >
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}>{readinessPct}%</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {typeof latestPracticeScore === 'number'
                ? `${checklistPct}% checklist + ${latestPracticeScore}% latest practice score, blended`
                : 'Take a real practice test to move past 50% - checklist progress alone only gets you halfway'}
            </div>
          </div>
        </div>

        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)' }}>Prep Checklist</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {milestones.map((m) => {
            const done = !!checklist?.[m.key];
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onToggleMilestone(m.key, !done)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: done ? 'rgba(var(--accent-rgb), 0.06)' : 'transparent',
                  color: done ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.87rem',
                }}
              >
                {done ? <CheckSquare size={16} color="var(--accent-cyan)" style={{ flexShrink: 0 }} /> : <Square size={16} style={{ flexShrink: 0 }} />}
                {m.label}
              </button>
            );
          })}
        </div>

        {onTakeQuiz && (
          <div style={{ marginBottom: '24px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onTakeQuiz}
            >
              <GraduationCap size={15} /> Take Practice Quiz
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
              Real, first-party questions - finishing a quiz logs your score below automatically.
            </p>
          </div>
        )}

        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>Latest Practice Test Score</h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          {onTakeQuiz
            ? 'Set automatically when you finish a Practice Quiz above - or self-report a score from an external practice exam here instead.'
            : 'Self-reported after a real ExamCompass/PocketPrep (or similar) practice exam - not verified, same trust level as the rest of your own roadmap notes.'}
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            min="0"
            max="100"
            className="form-input"
            value={scoreInput}
            onChange={(e) => setScoreInput(e.target.value)}
            placeholder="e.g. 78"
            style={{ width: '100px' }}
          />
          <button type="button" className="btn btn-primary" onClick={handleSaveScore} disabled={savingScore}>
            {savingScore ? 'Saving...' : 'Save Score'}
          </button>
          {latestPracticeScoreAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last logged {new Date(latestPracticeScoreAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
        {scoreError && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '8px' }}>{scoreError}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
