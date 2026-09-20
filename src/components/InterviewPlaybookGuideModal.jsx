import { X, Briefcase, ExternalLink, MessageSquare, HelpCircle, Calendar } from 'lucide-react';

// HH Interview Playbook - real content pulled from the Google Doc members
// used to be sent out to (Resources → Interview Playbooks used to just
// link out to it). Same in-app-guide pattern as Recommended Podcasts/Soft
// Skills Playlist: the actual content lives here now, the "Read Guide"
// button opens it, no external doc to keep access-shared with every member.
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
  'Tell me about yourself.',
  'What are your strengths and weaknesses?',
  'Why should we hire you?',
  'How do you handle stress?',
  'How do you stay updated with cyber news?',
  'Why did you apply to this job?',
  'Where do you see yourself in the next 2-3 years?',
  'What are your salary expectations?',
];

const QUESTIONS_TO_ASK_THEM = [
  'What kinds of opportunities are there for progression within the organisation?',
  'What would I have to do to be considered a successful hire within the first 6 months in this role?',
  'What challenges do you foresee me having within this role?',
];

export default function InterviewPlaybookGuideModal({ onClose, onBookInterviewPrep }) {
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
          maxWidth: '640px',
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
          Everything to prepare for your next interview - watch first, then write out real answers to
          every question below and practice saying them out loud before you book a prep session to go
          through them.
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
            <MessageSquare size={14} /> Write Out Real Answers To These
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Don't just think through them - actually write full answers down somewhere, then practice
            saying them out loud. A written answer you've never said aloud always sounds different the
            first time you try it live.
          </p>
          <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {QUESTIONS_TO_PREPARE.map((q) => (
              <li key={q} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{q}</li>
            ))}
          </ol>
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
          <button className="btn btn-primary" onClick={onClose}>Got It</button>
        </div>
      </div>
    </div>
  );
}
