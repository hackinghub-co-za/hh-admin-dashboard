import { ListChecks } from 'lucide-react';

// Cyber Question of the Day (supabase/087_daily_question.sql) - a blocking
// popup shown the first time a member opens the Dashboard each day until
// they've answered today's question. No backdrop-click or X-close while
// unanswered - answering is the only way out, same "have to answer" intent
// the founder asked for. Once answered, a Continue button appears.
//
// Duolingo-inspired result screen (see the "Duolingo-Inspired Design
// System" canvas): once answered, the whole card becomes a full-bleed
// --success/--danger panel instead of a small colored line of text -
// right/wrong is a moment, not a caption. The pre-answer question step
// keeps the app's own glass-card look, with pressable (keycap-style)
// choice buttons.
export default function DailyQuestionModal({ question, submitting, onAnswer, onClose }) {
  if (!question) return null;

  if (question.alreadyAnswered) {
    const resultColor = question.wasCorrect ? 'var(--success)' : 'var(--danger)';
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
      >
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            borderRadius: 'var(--border-radius-lg)',
            overflow: 'hidden',
            background: resultColor,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 32px 24px' }}>
            <div className="duo-pop" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0, 0, 0, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '40px', color: 'var(--accent-ink)', fontWeight: 800, lineHeight: 1 }}>{question.wasCorrect ? '✓' : '✕'}</span>
            </div>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent-ink)', textAlign: 'center' }}>
              {question.wasCorrect ? 'Correct!' : 'Not quite'}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(18, 19, 43, 0.75)', textAlign: 'center', marginTop: '-12px' }}>
              Come back tomorrow for the next one.
            </span>

            {question.explanation && (
              <div style={{ width: '100%', padding: '18px 20px', borderRadius: 'var(--border-radius-md)', background: 'rgba(0, 0, 0, 0.14)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(18, 19, 43, 0.65)', marginBottom: '6px' }}>
                  Explanation
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--accent-ink)', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{question.explanation}</p>
              </div>
            )}

            {question.currentStreak > 0 && (
              <div
                title={`${question.currentStreak} day${question.currentStreak === 1 ? '' : 's'} in a row`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '999px', background: 'rgba(0, 0, 0, 0.16)' }}
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🔥</span>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-ink)' }}>
                  {question.currentStreak} day{question.currentStreak === 1 ? '' : 's'} streak
                </span>
              </div>
            )}

            {Number.isFinite(question.totalAnsweredToday) && question.totalAnsweredToday > 0 && (
              <p style={{ fontSize: '0.78rem', color: 'rgba(18, 19, 43, 0.7)', fontWeight: 600, textAlign: 'center', margin: 0 }}>
                {question.totalCorrectToday} of {question.totalAnsweredToday} member{question.totalAnsweredToday === 1 ? '' : 's'} got today's question right so far
                {' '}({Math.round((question.totalCorrectToday / question.totalAnsweredToday) * 100)}%).
              </p>
            )}
          </div>

          <div style={{ padding: '20px 32px 28px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              className="duo-continue"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 'var(--border-radius-lg)',
                border: 'none',
                borderBottom: '5px solid var(--bg-primary)',
                background: '#1a1c3d',
                color: '#ffffff',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <ListChecks size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Cyber Question of the Day</h2>
        </div>

        <span className="badge badge-success" style={{ fontSize: '0.65rem', marginBottom: '12px', display: 'inline-block' }}>{question.domain}</span>
        <p style={{ fontSize: '0.95rem', marginBottom: '18px', lineHeight: 1.5 }}>{question.question}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {question.choices.map((choice, idx) => (
            <button
              key={idx}
              type="button"
              className="duo-choice"
              style={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                padding: '13px 16px',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--bg-tertiary)',
                border: '2px solid var(--border-color)',
                borderBottom: '4px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
              onClick={() => onAnswer(idx)}
              disabled={submitting}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
