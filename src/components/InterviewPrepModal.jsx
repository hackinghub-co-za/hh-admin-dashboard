import { useState, useEffect } from 'react';
import { X, MessageSquare, Briefcase, FileText, History, Lightbulb } from 'lucide-react';
import { generateInterviewQuestions, fetchMyInterviewPrepSessions } from '../lib/interviewPrepData';

// Gemma-powered interview question generator - paste a job description +
// CV text, get back tailored questions (supabase/056_interview_prep.sql +
// supabase/functions/gemma-interview-prep). Same overlay/glass-card chrome
// as every other portal modal. Assumes a real (non-mock) session, same as
// CvReviewModal/QuizModal - MemberPortal.jsx only renders the trigger for
// a real session.

const WEEKLY_SESSION_CAP = 3; // must match gemma-interview-prep's own WEEKLY_SESSION_CAP - client-side hint only

const CATEGORY_COLOR = {
  Technical: 'var(--accent-cyan)',
  Behavioral: 'var(--accent-purple, #a855f7)',
  'Scenario-Based': 'var(--accent-lime, #ccff00)',
};

export default function InterviewPrepModal({ onClose }) {
  const [phase, setPhase] = useState('input'); // input | generating | result
  const [jobDescription, setJobDescription] = useState('');
  const [cvText, setCvText] = useState('');
  const [questions, setQuestions] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState([]);
  // Captured once on mount, not re-read during render - same reasoning as
  // CvReviewModal's mountedAt (avoids an impure Date.now() call in the
  // render body).
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    fetchMyInterviewPrepSessions()
      .then(setHistory)
      .catch(() => {});
  }, []);

  const usedThisWeek = history.filter((s) => (mountedAt - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 7).length;
  const remaining = Math.max(0, WEEKLY_SESSION_CAP - usedThisWeek);

  const handleGenerate = async () => {
    if (!jobDescription.trim() || !cvText.trim()) {
      setErrorMsg('Paste both the job description and your CV text.');
      return;
    }
    setPhase('generating');
    setErrorMsg(null);
    try {
      const qs = await generateInterviewQuestions(jobDescription.trim(), cvText.trim());
      setQuestions(qs);
      setPhase('result');
      setHistory((prev) => [{ id: `temp-${Date.now()}`, jobDescription: jobDescription.trim(), questions: qs, createdAt: new Date().toISOString() }, ...prev]);
    } catch (err) {
      setErrorMsg(err.message || 'Could not generate questions - try again.');
      setPhase('input');
    }
  };

  const handleGenerateAgain = () => {
    setQuestions([]);
    setPhase('input');
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)',
        zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%', maxWidth: '640px', maxHeight: '88vh', overflowY: 'auto', padding: '32px',
          border: '1px solid var(--accent-cyan)', boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)', position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
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

        <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MessageSquare size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>AI Interview Prep</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Paste a job description and your CV - Gemma generates questions tailored to both.
        </p>

        {phase === 'input' && (
          <>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              {remaining > 0 ? `${remaining} of ${WEEKLY_SESSION_CAP} sessions left this week.` : "You've used all your sessions for this week - come back soon."}
            </p>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={14} /> Job Description
            </h4>
            <textarea
              className="form-input"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description you're preparing for..."
              rows={6}
              style={{ width: '100%', resize: 'vertical', marginBottom: '18px', fontFamily: 'inherit' }}
            />

            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} /> Your CV Text
            </h4>
            <textarea
              className="form-input"
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste your CV text here..."
              rows={6}
              style={{ width: '100%', resize: 'vertical', marginBottom: '20px', fontFamily: 'inherit' }}
            />

            {errorMsg && <p style={{ fontSize: '0.82rem', color: 'var(--danger)', marginBottom: '14px' }}>{errorMsg}</p>}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleGenerate}
              disabled={remaining <= 0}
            >
              <MessageSquare size={15} /> Generate Questions
            </button>

            {history.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '28px 0 10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={14} /> Past Sessions
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {history.slice(0, 5).map((s) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>{new Date(s.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>{s.questions.length} questions</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {phase === 'generating' && (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Gemma is generating your questions...</p>
        )}

        {phase === 'result' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              {questions.map((q, idx) => (
                <div key={idx} style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                    <h5 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{q.question}</h5>
                    <span style={{ flexShrink: 0, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 8px', borderRadius: '4px', color: CATEGORY_COLOR[q.category] || 'var(--accent-cyan)', background: 'rgba(255,255,255,0.04)' }}>
                      {q.category}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: 1.5 }}>
                    <Lightbulb size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-cyan)' }} /> {q.tip}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleGenerateAgain} disabled={remaining <= 0}>
                Generate Another Set
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
