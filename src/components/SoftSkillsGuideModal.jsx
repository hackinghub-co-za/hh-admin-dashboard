import { X, Handshake, ExternalLink } from 'lucide-react';

// Soft Skills Playlist - same in-app guide pattern as Recommended Podcasts
// (PodcastsGuideModal.jsx), but for the 'Soft Skills' resource category.
// Catalogued in Resources (supabase/026_resources.sql) with just a short
// teaser; this is the real content, the "Read Guide" button opens. Every
// link below was checked live before shipping - real talks/articles, not
// invented ones.
const SECTIONS = [
  {
    heading: '10 Ways to Have a Better Conversation',
    speaker: 'Celeste Headlee · TED',
    body: 'Ten practical rules for actually listening instead of just waiting for your turn to talk - honesty, brevity, and staying curious about the other person.',
    linkLabel: 'Watch on TED',
    href: 'https://www.ted.com/talks/celeste_headlee_10_ways_to_have_a_better_conversation',
  },
  {
    heading: 'How to Speak So That People Want to Listen',
    speaker: 'Julian Treasure · TED',
    body: "A sound expert's take on what makes speech powerful (or not) - the habits that make people tune out, and vocal techniques that make people tune in. Directly useful for interviews and client calls.",
    linkLabel: 'Watch on TED',
    href: 'https://www.ted.com/talks/julian_treasure_how_to_speak_so_that_people_want_to_listen',
  },
  {
    heading: 'Your Body Language May Shape Who You Are',
    speaker: 'Amy Cuddy · TED',
    body: 'How posture and presence affect how confident you feel and how you come across in an interview or a meeting - useful before anything high-stakes.',
    linkLabel: 'Watch on TED',
    href: 'https://www.ted.com/talks/amy_cuddy_your_body_language_may_shape_who_you_are',
  },
  {
    heading: 'The Joy of Getting Feedback',
    speaker: 'Joe Hirsch · TED',
    body: "Reframes feedback (from a coach, a mentor, a code review) as something to seek out rather than dread - directly relevant to how mentoring works in this community.",
    linkLabel: 'Watch on TED',
    href: 'https://www.ted.com/talks/joe_hirsch_the_joy_of_getting_feedback',
  },
  {
    heading: '28 Email Etiquette Guidelines for Workplace Communication',
    speaker: 'Indeed Career Guide',
    body: 'Subject lines, tone, response times, CC/BCC, attachments - the unwritten rules of professional email, spelled out. Read this before your first day at a new job.',
    linkLabel: 'Read on Indeed',
    href: 'https://www.indeed.com/career-advice/career-development/email-etiquette',
  },
  {
    heading: '10 Tips for Communication Etiquette in the Workplace',
    speaker: 'Indeed Career Guide',
    body: 'Choosing the right channel, matching formality to the situation, phone/video-call conduct, and giving feedback constructively - the day-to-day etiquette that email guides alone miss.',
    linkLabel: 'Read on Indeed',
    href: 'https://www.indeed.com/career-advice/career-development/etiquette-in-communication',
  },
];

export default function SoftSkillsGuideModal({ onClose }) {
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
          maxWidth: '620px',
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
          <Handshake size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Soft Skills Playlist</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.6 }}>
          Technical skill gets you the interview - communication, presence, and workplace etiquette are what
          get you hired and promoted. Six short, real watches/reads covering conversation, public speaking,
          presence, feedback, and workplace/email etiquette.
        </p>
        <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '24px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--accent-rgb), 0.08)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
          Pick one a week rather than binging all six at once - these are habits to practice, not facts to memorize.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SECTIONS.map((s) => (
            <div key={s.heading} style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2px' }}>{s.heading}</h4>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{s.speaker}</div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> {s.linkLabel}
              </a>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={onClose}>Got It</button>
        </div>
      </div>
    </div>
  );
}
