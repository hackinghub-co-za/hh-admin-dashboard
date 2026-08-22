import { X, IdCard } from 'lucide-react';

// The Hacking Hub LinkedIn Playbook - our own written guide, hardcoded here
// rather than a Google Doc link (unlike the HH Interview Playbook resource)
// so it's read in-app instead of sending members off-platform. Catalogued in
// Resources (supabase/026_resources.sql) with just a teaser description;
// this is the real content the "Read Guide" button opens.
const SECTIONS = [
  { heading: 'Profile Photo', body: 'A proper headshot, preferably from the shoulders up. Neutral expression, neutral background - no vacation photos, sunglasses, or group crops.' },
  { heading: 'Banner', body: "A descriptive banner image, not the default LinkedIn blue. Use it to say something about what you do or your specialty." },
  { heading: 'About Section', body: "A full, descriptive About section - who you are, what you're working toward, and what you can actually do." },
  { heading: 'Headline', body: 'A targeted headline that says what you actually do or are working toward - not just "Student" or "Open to Work".' },
  { heading: 'Posting Cadence', body: "Post at least once every 2 weeks. Share your certifications as you pass them." },
  { heading: 'Projects Section', body: 'Keep a Projects section showing real, specific work - not just a list of skills.' },
  { heading: 'What to Avoid', body: 'No weird or excessive reposts. No meme reposts or generic "LinkedIn is broken" engagement bait. No AI-generated ("AI slop") posts - write in your own voice.' },
];

export default function LinkedInPlaybookModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
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
          boxShadow: '0 0 30px rgba(94, 227, 122, 0.2)',
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
          <IdCard size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>The Hacking Hub LinkedIn Playbook</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Your LinkedIn is often the first thing a recruiter sees - treat it like part of your CV.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SECTIONS.map((s) => (
            <div key={s.heading} style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>{s.heading}</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
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
