import { ListChecks } from 'lucide-react';

// Cyber Question of the Day (supabase/087_daily_question.sql) - a blocking
// popup shown the first time a member opens the Dashboard each day until
// they've answered today's question. No backdrop-click or X-close while
// unanswered - answering is the only way out, same "have to answer" intent
// the founder asked for. Once answered, a Continue button appears.
export default function DailyQuestionModal({ question, submitting, onAnswer, onClose }) {
  if (!question) return null;

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

        {question.alreadyAnswered ? (
          <div>
            <p style={{ fontWeight: 600, fontSize: '1rem', color: question.wasCorrect ? 'var(--accent-green)' : 'var(--danger)', marginBottom: '16px' }}>
              {question.wasCorrect ? 'Correct! Come back tomorrow for the next one.' : "Not quite - come back tomorrow for the next one."}
            </p>
            {question.currentStreak > 0 && (
              <div
                title={`${question.currentStreak} day${question.currentStreak === 1 ? '' : 's'} in a row`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: 'var(--border-radius-md)',
                  background: 'rgba(var(--warning-rgb), 0.08)',
                  border: '1px solid rgba(var(--warning-rgb), 0.25)',
                  marginBottom: '18px',
                }}
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🔥</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.1 }}>{question.currentStreak}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    day{question.currentStreak === 1 ? '' : 's'} in a row
                  </div>
                </div>
              </div>
            )}

            {Number.isFinite(question.totalAnsweredToday) && question.totalAnsweredToday > 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                {question.totalCorrectToday} of {question.totalAnsweredToday} member{question.totalAnsweredToday === 1 ? '' : 's'} got today's question right so far
                {' '}({Math.round((question.totalCorrectToday / question.totalAnsweredToday) * 100)}%).
              </p>
            )}

            {question.explanation && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--border-radius-md)',
                  background: 'rgba(var(--overlay-rgb), 0.02)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '24px',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Explanation
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{question.explanation}</p>
              </div>
            )}

            <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
              Continue
            </button>
          </div>
        ) : (
          <div>
            <span className="badge badge-success" style={{ fontSize: '0.65rem', marginBottom: '12px', display: 'inline-block' }}>{question.domain}</span>
            <p style={{ fontSize: '0.95rem', marginBottom: '18px', lineHeight: 1.5 }}>{question.question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {question.choices.map((choice, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '10px 14px', fontSize: '0.85rem' }}
                  onClick={() => onAnswer(idx)}
                  disabled={submitting}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
