import { useState, useEffect } from 'react';
import { X, GraduationCap, CheckCircle2, XCircle, Clock, BookOpen, Timer, RotateCcw } from 'lucide-react';
import { fetchQuizQuestions, submitQuizAttempt } from '../lib/quizData';

// Real, first-party practice quiz - opened from ExamReadinessModal's "Take
// Practice Quiz" button. Replaces the old "go take a practice test on
// ExamCompass/PocketPrep, then type your score in by hand" flow: finishing
// a quiz here calls submit_quiz_attempt(), which logs the score into
// Exam Readiness automatically (supabase/054_quiz_system.sql).
//
// Two modes: Study (answer, see immediately whether you were right + why,
// no time pressure) and Exam (no feedback until the very end, mirrors real
// exam conditions). Assumes a real (non-mock) session, same as
// ExamReadinessModal itself - MemberPortal.jsx only ever renders the
// trigger for a real session.

const QUESTION_COUNT_OPTIONS = [10, 15, 20];

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function QuizModal({ certName, certLabel, onClose, onScoreLogged }) {
  const [phase, setPhase] = useState('setup'); // setup | loading | taking | submitting | results
  const [mode, setMode] = useState('study');
  const [questionCount, setQuestionCount] = useState(15);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]); // [{ questionId, chosenIndex }]
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [result, setResult] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (phase !== 'taking') return;
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleStart = async () => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const qs = await fetchQuizQuestions(certName, questionCount);
      if (!qs.length) {
        setErrorMsg('No questions are available for this cert yet - check back soon.');
        setPhase('setup');
        return;
      }
      setQuestions(qs);
      setCurrentIndex(0);
      setAnswers([]);
      setSelectedChoice(null);
      setRevealed(false);
      setElapsedSec(0);
      setStartedAt(new Date().toISOString());
      setPhase('taking');
    } catch (err) {
      setErrorMsg(err.message || 'Could not load questions.');
      setPhase('setup');
    }
  };

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const handleChoose = (choiceIndex) => {
    if (mode === 'study') {
      if (revealed) return;
      setSelectedChoice(choiceIndex);
      setRevealed(true);
      setAnswers((prev) => [...prev, { questionId: currentQuestion.id, chosenIndex: choiceIndex }]);
    } else {
      setSelectedChoice(choiceIndex);
    }
  };

  const goNext = () => {
    if (mode === 'exam') {
      if (selectedChoice === null) return;
      const finalAnswers = [...answers, { questionId: currentQuestion.id, chosenIndex: selectedChoice }];
      if (isLastQuestion) {
        handleSubmit(finalAnswers);
      } else {
        setAnswers(finalAnswers);
        setCurrentIndex((i) => i + 1);
        setSelectedChoice(null);
      }
      return;
    }

    // Study mode: the answer for this question was already recorded when chosen.
    if (isLastQuestion) {
      handleSubmit(answers);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedChoice(null);
      setRevealed(false);
    }
  };

  const handleSubmit = async (finalAnswers) => {
    setPhase('submitting');
    setErrorMsg(null);
    try {
      const res = await submitQuizAttempt(certName, mode, startedAt, finalAnswers);
      setResult({ ...res, finalAnswers });
      setPhase('results');
      onScoreLogged?.(res.score);
    } catch (err) {
      setErrorMsg(err.message || 'Could not submit your quiz - your answers are still here, try again.');
      setPhase('taking');
    }
  };

  const handleRetake = () => {
    setPhase('setup');
    setResult(null);
    setErrorMsg(null);
  };

  // Per-domain breakdown for the results screen - cheap to compute since
  // every question already carries its domain and we have the full
  // question list + graded answers in memory.
  const domainBreakdown = (() => {
    if (!result) return [];
    const byDomain = {};
    result.finalAnswers.forEach((a) => {
      const q = questions.find((q2) => q2.id === a.questionId);
      if (!q) return;
      byDomain[q.domain] = byDomain[q.domain] || { correct: 0, total: 0 };
      byDomain[q.domain].total += 1;
      if (a.chosenIndex === q.correctIndex) byDomain[q.domain].correct += 1;
    });
    return Object.entries(byDomain).map(([domain, stats]) => ({ domain, ...stats }));
  })();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)',
        zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={phase === 'taking' ? undefined : onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%', maxWidth: '620px', maxHeight: '88vh', overflowY: 'auto', padding: '32px',
          border: '1px solid var(--accent-cyan)', boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)', position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase !== 'taking' && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%',
              width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        )}

        <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GraduationCap size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Practice Quiz</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>{certLabel}</p>

        {errorMsg && phase !== 'taking' && (
          <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '16px' }}>{errorMsg}</p>
        )}

        {phase === 'setup' && (
          <>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)' }}>Mode</h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => setMode('study')}
                style={{
                  flex: 1, textAlign: 'left', padding: '14px', borderRadius: 'var(--border-radius-sm)',
                  border: mode === 'study' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                  background: mode === 'study' ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  <BookOpen size={15} /> Study Mode
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  See the answer and explanation right after each question.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('exam')}
                style={{
                  flex: 1, textAlign: 'left', padding: '14px', borderRadius: 'var(--border-radius-sm)',
                  border: mode === 'exam' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                  background: mode === 'exam' ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  <Timer size={15} /> Exam Mode
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  No feedback until the end - mirrors real exam pressure.
                </div>
              </button>
            </div>

            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)' }}>Question Count</h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
              {QUESTION_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuestionCount(n)}
                  style={{
                    padding: '8px 18px', borderRadius: '20px',
                    border: questionCount === n ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                    background: questionCount === n ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent',
                    color: questionCount === n ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleStart}>
              Start Quiz
            </button>
          </>
        )}

        {phase === 'loading' && (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>Loading questions...</p>
        )}

        {phase === 'taking' && currentQuestion && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Question {currentIndex + 1} of {questions.length} &middot; {currentQuestion.domain}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={13} /> {formatElapsed(elapsedSec)}</span>
            </div>

            <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
              <div style={{ width: `${((currentIndex + 1) / questions.length) * 100}%`, height: '100%', background: 'var(--accent-cyan)', transition: 'width 0.3s ease' }} />
            </div>

            <p style={{ fontSize: '1.02rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '18px', lineHeight: 1.5 }}>
              {currentQuestion.question}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {currentQuestion.choices.map((choice, idx) => {
                const isChosen = selectedChoice === idx;
                const isCorrectChoice = idx === currentQuestion.correctIndex;
                let borderColor = 'var(--border-color)';
                let bg = 'transparent';
                if (mode === 'study' && revealed) {
                  if (isCorrectChoice) { borderColor = 'var(--success, #22c55e)'; bg = 'rgba(34, 197, 94, 0.08)'; }
                  else if (isChosen) { borderColor = 'var(--danger)'; bg = 'rgba(239, 68, 68, 0.08)'; }
                } else if (isChosen) {
                  borderColor = 'var(--accent-cyan)';
                  bg = 'rgba(var(--accent-rgb), 0.08)';
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChoose(idx)}
                    disabled={mode === 'study' && revealed}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
                      padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', border: `1px solid ${borderColor}`,
                      background: bg, color: 'var(--text-primary)', fontSize: '0.88rem',
                      cursor: mode === 'study' && revealed ? 'default' : 'pointer',
                    }}
                  >
                    <span>{choice}</span>
                    {mode === 'study' && revealed && isCorrectChoice && <CheckCircle2 size={16} color="var(--success, #22c55e)" style={{ flexShrink: 0, marginLeft: '10px' }} />}
                    {mode === 'study' && revealed && isChosen && !isCorrectChoice && <XCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginLeft: '10px' }} />}
                  </button>
                );
              })}
            </div>

            {mode === 'study' && revealed && (
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '12px 14px', marginBottom: '20px', lineHeight: 1.5 }}>
                {currentQuestion.explanation}
              </p>
            )}

            {errorMsg && <p style={{ fontSize: '0.82rem', color: 'var(--danger)', marginBottom: '12px' }}>{errorMsg}</p>}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={goNext}
              disabled={(mode === 'exam' && selectedChoice === null) || (mode === 'study' && !revealed)}
            >
              {isLastQuestion ? 'Finish Quiz' : 'Next Question'}
            </button>
          </>
        )}

        {phase === 'submitting' && (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>Grading...</p>
        )}

        {phase === 'results' && result && (
          <>
            <div style={{ textAlign: 'center', padding: '18px 20px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--accent-rgb), 0.06)', border: '1px solid rgba(var(--accent-rgb), 0.2)', marginBottom: '24px' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}>{result.score}%</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                {result.correctCount} of {result.questionCount} correct &middot; logged as your latest {certLabel} practice score
              </div>
            </div>

            {domainBreakdown.length > 1 && (
              <>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)' }}>By Domain</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {domainBreakdown.map((d) => (
                    <div key={d.domain} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span>{d.domain}</span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>{d.correct}/{d.total}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleRetake}>
                <RotateCcw size={14} /> Retake
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
