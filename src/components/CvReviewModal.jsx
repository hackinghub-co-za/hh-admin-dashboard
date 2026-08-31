import { useState, useEffect } from 'react';
import { X, Sparkles, FileText, Briefcase, History, ChevronRight } from 'lucide-react';
import { submitForReview, fetchMyReviews } from '../lib/cvReviewData';

// Gemma-powered CV/LinkedIn review - paste text, get structured, scored
// feedback (supabase/055_cv_reviews.sql + supabase/functions/gemma-review).
// Text-paste only, no file upload and no LinkedIn URL fetching (LinkedIn
// blocks scraping and it would violate their ToS) - same overlay/glass-card
// chrome as every other portal modal. Assumes a real (non-mock) session,
// same as ExamReadinessModal/QuizModal - MemberPortal.jsx only renders the
// trigger for a real session.

const WEEKLY_REVIEW_CAP = 3; // must match gemma-review's own WEEKLY_REVIEW_CAP - client-side hint only, the edge function is the real enforcer

export default function CvReviewModal({ onClose }) {
  const [phase, setPhase] = useState('input'); // input | submitting | result
  const [cvText, setCvText] = useState('');
  const [linkedinText, setLinkedinText] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState([]);
  // Captured once on mount (lazy initializer), not read fresh on every
  // render - Date.now() directly in the render body would be an impure
  // call React's purity rules flag, since its value silently drifts across
  // re-renders instead of staying stable for this component's lifetime.
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    fetchMyReviews()
      .then(setHistory)
      .catch(() => {});
  }, []);

  const usedThisWeek = history.filter((r) => {
    const days = (mountedAt - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }).length;
  const remaining = Math.max(0, WEEKLY_REVIEW_CAP - usedThisWeek);

  const handleSubmit = async () => {
    if (!cvText.trim() && !linkedinText.trim()) {
      setErrorMsg('Paste your CV text, your LinkedIn profile text, or both.');
      return;
    }
    setPhase('submitting');
    setErrorMsg(null);
    try {
      const res = await submitForReview(cvText.trim(), linkedinText.trim());
      setResult(res);
      setPhase('result');
      setHistory((prev) => [{ id: `temp-${Date.now()}`, reviewType: res.reviewType, overallScore: res.overallScore, categories: res.categories, createdAt: new Date().toISOString() }, ...prev]);
    } catch (err) {
      setErrorMsg(err.message || 'Could not get a review - try again.');
      setPhase('input');
    }
  };

  const handleReviewAgain = () => {
    setResult(null);
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
          <Sparkles size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>AI CV &amp; LinkedIn Review</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Gemma reviews it like a hiring manager would - specific, honest, and tailored to your track.
        </p>

        {phase === 'input' && (
          <>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Paste text, not a file - copy your CV text directly, and your LinkedIn "About" plus experience section from
              your own profile page. {remaining > 0 ? `${remaining} of ${WEEKLY_REVIEW_CAP} reviews left this week.` : 'You\'ve used all your reviews for this week - come back soon.'}
            </p>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} /> CV Text
            </h4>
            <textarea
              className="form-input"
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste your CV text here..."
              rows={6}
              style={{ width: '100%', resize: 'vertical', marginBottom: '18px', fontFamily: 'inherit' }}
            />

            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={14} /> LinkedIn Profile Text
            </h4>
            <textarea
              className="form-input"
              value={linkedinText}
              onChange={(e) => setLinkedinText(e.target.value)}
              placeholder="Paste your LinkedIn headline, About, and experience section here..."
              rows={6}
              style={{ width: '100%', resize: 'vertical', marginBottom: '20px', fontFamily: 'inherit' }}
            />

            {errorMsg && <p style={{ fontSize: '0.82rem', color: 'var(--danger)', marginBottom: '14px' }}>{errorMsg}</p>}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleSubmit}
              disabled={remaining <= 0}
            >
              <Sparkles size={15} /> Get My Review
            </button>

            {history.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '28px 0 10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={14} /> Past Reviews
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {history.slice(0, 5).map((r) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{r.reviewType} &middot; {new Date(r.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.overallScore}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {phase === 'submitting' && (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Gemma is reviewing your submission...</p>
        )}

        {phase === 'result' && result && (
          <>
            <div style={{ textAlign: 'center', padding: '18px 20px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--accent-rgb), 0.06)', border: '1px solid rgba(var(--accent-rgb), 0.2)', marginBottom: '24px' }}>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}>{result.overallScore}%</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', textTransform: 'capitalize' }}>{result.reviewType} review</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              {result.categories.map((cat, idx) => (
                <div key={idx} style={{ padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                  <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>{cat.name}</h5>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>{cat.feedback}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <ChevronRight size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {cat.suggestion}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleReviewAgain} disabled={remaining <= 0}>
                Review Again
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
