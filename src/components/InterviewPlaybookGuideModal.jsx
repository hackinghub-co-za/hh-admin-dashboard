import { useState, useEffect, useRef } from 'react';
import { X, Briefcase, ExternalLink, MessageSquare, HelpCircle, Calendar, Check } from 'lucide-react';
import { fetchMyInterviewPlaybookAnswers, saveMyInterviewPlaybookAnswer } from '../lib/interviewPlaybookAnswersData';

// HH Interview Playbook - real content pulled from the Google Doc members
// used to be sent out to (Resources → Interview Playbooks used to just
// link out to it). Same in-app-guide pattern as Recommended Podcasts/Soft
// Skills Playlist: the actual content lives here now, the "Read Guide"
// button opens it, no external doc to keep access-shared with every member.
//
// The 8 questions below come up in almost every interview regardless of
// domain, so - per the founder's own instruction (2026-09-20) - each one
// gets a real textarea instead of just being a list to think about. A
// written answer a member has actually typed out (and can come back to
// edit before a real interview) is the whole point; a bullet list alone
// doesn't get anyone to "practice saying them out loud" the way the
// playbook's own advice asks for.
const PLAYLISTS = [
  {
    label: 'Pass Job Interview Questions',
    body: 'A binge-watch playlist walking through how to actually answer the classic interview questions below, not just what to say but how to structure it.',
    href: 'https://youtube.com/playlist?list=PLO4kDC0EWkeCsp6CG0gzfUp0mQXpb1i27',
  },
  {
    label: 'Another curated interview prep playlist',
    body: "A second playlist worth working through alongside the first - more real examples of how strong answers actually sound.",
    href: 'https://youtube.com/playlist?list=PLZCHR_fccEf8L535Dwhk6hEMjeBHqw9xS',
  },
];

const QUESTIONS_TO_PREPARE = [
  { key: 'tell_me_about_yourself', text: 'Tell me about yourself.' },
  { key: 'strengths_and_weaknesses', text: 'What are your strengths and weaknesses?' },
  { key: 'why_should_we_hire_you', text: 'Why should we hire you?' },
  { key: 'how_do_you_handle_stress', text: 'How do you handle stress?' },
  { key: 'staying_updated', text: 'How do you stay updated with cyber news?' },
  { key: 'why_this_job', text: 'Why did you apply to this job?' },
  { key: 'next_2_3_years', text: 'Where do you see yourself in the next 2-3 years?' },
  { key: 'salary_expectations', text: 'What are your salary expectations?' },
];

const QUESTIONS_TO_ASK_THEM = [
  'What kinds of opportunities are there for progression within the organisation?',
  'What would I have to do to be considered a successful hire within the first 6 months in this role?',
  'What challenges do you foresee me having within this role?',
];

const SAVE_DEBOUNCE_MS = 800;

export default function InterviewPlaybookGuideModal({ onClose, onBookInterviewPrep, isMockSession }) {
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(!isMockSession);
  const [loadError, setLoadError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [justSavedKey, setJustSavedKey] = useState(null);
  const saveTimers = useRef({});

  useEffect(() => {
    // loading already starts false for Mock Member (useState(!isMockSession)
    // above) - nothing to fetch, so nothing to flip here.
    if (isMockSession) return;
    let cancelled = false;
    fetchMyInterviewPlaybookAnswers()
      .then((data) => !cancelled && setAnswers(data))
      .catch((err) => !cancelled && setLoadError(err?.message || 'Could not load your saved answers.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  // Clear any pending debounced saves on unmount so a save never fires
  // against an already-closed modal's stale closure.
  useEffect(() => () => {
    Object.values(saveTimers.current).forEach(clearTimeout);
  }, []);

  const handleAnswerChange = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (isMockSession) return; // local-only under Mock Member, nothing to persist

    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      setSavingKey(key);
      try {
        await saveMyInterviewPlaybookAnswer(key, value);
        setJustSavedKey(key);
        setTimeout(() => setJustSavedKey((k) => (k === key ? null : k)), 1500);
      } catch {
        // Best-effort - a failed autosave isn't worth interrupting someone
        // mid-sentence with an error banner; the text stays in the field
        // either way, so nothing is actually lost until the tab closes.
      } finally {
        setSavingKey((k) => (k === key ? null : k));
      }
    }, SAVE_DEBOUNCE_MS);
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
          maxWidth: '680px',
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

        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Briefcase size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>HH Interview Playbook</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
          These 8 questions come up in almost every interview, regardless of what role you're going
          for. Watch first, then write a real answer to each one below - it saves as you type - and
          practice saying it out loud before you book a prep session to go through them.
        </p>

        <div style={{ marginBottom: '22px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-cyan)', marginBottom: '12px' }}>
            Watch First
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {PLAYLISTS.map((p) => (
              <div key={p.href}>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px' }}>{p.body}</p>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
                >
                  <ExternalLink size={14} /> {p.label}
                </a>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '22px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-cyan)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageSquare size={14} /> Write Your Answers
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>
            Don't just think through them - a written answer you've never said aloud always sounds
            different the first time you try it live.
          </p>
          {isMockSession && (
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 12px', fontStyle: 'italic' }}>
              Not saved under Mock Member - sign in with Google to keep your answers between visits.
            </p>
          )}
          {loadError && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', margin: '8px 0' }}>{loadError}</p>}
          {loading ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading your saved answers...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              {QUESTIONS_TO_PREPARE.map((q, i) => (
                <div key={q.key}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>
                    <span>{i + 1}. {q.text}</span>
                    {savingKey === q.key && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>Saving...</span>}
                    {justSavedKey === q.key && savingKey !== q.key && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Check size={12} /> Saved
                      </span>
                    )}
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    style={{ resize: 'vertical', fontSize: '0.85rem' }}
                    placeholder="Type your answer here..."
                    value={answers[q.key] || ''}
                    onChange={(e) => handleAnswerChange(q.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-cyan)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={14} /> Questions To Ask Them
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Every interview ends with "do you have any questions for us?" - always say yes.
          </p>
          <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {QUESTIONS_TO_ASK_THEM.map((q) => (
              <li key={q} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{q}</li>
            ))}
          </ol>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '24px', padding: '14px 16px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--accent-rgb), 0.08)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
          Once you've written your answers, use Interview Prep to generate practice questions tailored to
          a real job description, or book a 1-on-1 to go through your answers with your coach.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {onBookInterviewPrep && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                onBookInterviewPrep();
                onClose();
              }}
            >
              <Calendar size={14} /> Open Interview Prep
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
