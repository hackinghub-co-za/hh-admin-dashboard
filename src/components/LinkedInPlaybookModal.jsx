import { useState } from 'react';
import { X, IdCard, Clock, Hash, ChevronDown, ChevronUp, Users, Pencil } from 'lucide-react';
import { WEEKLY_THEMES, THEME_DESCRIPTIONS, DOMAIN_CONTENT, DOMAINS, getCurrentWeekIndex, resolveDomain } from '../lib/linkedInPlaybookData';

// The Hacking Hub LinkedIn Playbook - our own written guide, hardcoded here
// rather than a Google Doc link (unlike the HH Interview Playbook resource)
// so it's read in-app instead of sending members off-platform. Catalogued in
// Resources (supabase/026_resources.sql) with just a teaser description;
// this is the real content the "Read Guide" button opens. Part 2's content
// (12-week posting plan, per specialty) lives in ../lib/linkedInPlaybookData
// - shared with the inline "This Week" widget on the roadmap's "Post once a
// week" item (MemberPortal.jsx), so both surfaces always agree.
const SECTIONS = [
  { heading: 'Profile Photo', body: 'A proper headshot, preferably from the shoulders up. Neutral expression, neutral background - no vacation photos, sunglasses, or group crops.' },
  { heading: 'Banner', body: "A descriptive banner image, not the default LinkedIn blue. Use it to say something about what you do or your specialty." },
  { heading: 'About Section', body: "A full, descriptive About section - who you are, what you're working toward, and what you can actually do." },
  { heading: 'Headline', body: 'A targeted headline that says what you actually do or are working toward - not just "Student" or "Open to Work".' },
  { heading: 'Posting Cadence', body: "Once a week, same as the \"Post once a week\" item on your roadmap. Post on a weekday morning (Tuesday-Thursday, 8-10am) - LinkedIn's algorithm rewards posts that pick up engagement early, and that's when people in the industry are actually scrolling before work starts." },
  { heading: 'Projects Section', body: 'Keep a Projects section showing real, specific work - not just a list of skills.' },
  { heading: 'What to Avoid', body: 'No weird or excessive reposts. No meme reposts or generic "LinkedIn is broken" engagement bait. No AI-generated ("AI slop") posts - write in your own voice.' },
];

// Weeks grouped into 3 "months" of 4 for the accordion (indices into
// WEEKLY_THEMES/DOMAIN_CONTENT[*].posts, 0-based).
const MONTHS = [
  { label: 'Month 1', weekIndices: [0, 1, 2, 3] },
  { label: 'Month 2', weekIndices: [4, 5, 6, 7] },
  { label: 'Month 3', weekIndices: [8, 9, 10, 11] },
];

export default function LinkedInPlaybookModal({ onClose, roadmapTrack }) {
  const [selectedDomain, setSelectedDomain] = useState(resolveDomain(roadmapTrack));
  // Which month's accordion is open - starts on whichever month contains
  // the real current week, so a member never has to go hunting for it.
  const [expandedMonth, setExpandedMonth] = useState(() => Math.floor(getCurrentWeekIndex() / 4));
  const domain = DOMAIN_CONTENT[selectedDomain];
  const currentWeekIdx = getCurrentWeekIndex();

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
          <IdCard size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>The Hacking Hub LinkedIn Playbook</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Your LinkedIn is often the first thing a recruiter sees - treat it like part of your CV.
        </p>

        <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Part 1 · Set Up Your Profile
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '32px' }}>
          {SECTIONS.map((s) => (
            <div key={s.heading} style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>{s.heading}</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          Part 2 · Your 12-Week Posting Plan
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '4px' }}>
          A full quarter, tailored to your specialty - once you finish Week 12, start back at Week 1. One post a week is enough to stand out; consistency beats volume.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Clock size={13} /> Post Tuesday-Thursday, 8-10am - that's when the industry is actually scrolling.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--warning)', display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '20px' }}>
          <Pencil size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
          Every example below is a starting point, not a script - write it in your own words. Copy-pasting it, or running it through an AI generator, reads as "AI slop" and costs you credibility fast (see "What to Avoid" above).
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {DOMAINS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDomain(d)}
              className={selectedDomain === d ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontSize: '0.78rem', padding: '6px 14px' }}
            >
              {d}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {MONTHS.map((month, monthIdx) => {
            const isExpanded = expandedMonth === monthIdx;
            const containsCurrentWeek = month.weekIndices.includes(currentWeekIdx);
            return (
              <div key={month.label} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setExpandedMonth(isExpanded ? -1 : monthIdx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(var(--overlay-rgb), 0.02)',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700 }}>
                    {month.label} · Weeks {month.weekIndices[0] + 1}-{month.weekIndices[3] + 1}
                    {containsCurrentWeek && (
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>This Week's Month</span>
                    )}
                  </span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 16px' }}>
                    {month.weekIndices.map((idx) => {
                      const { week, theme, isNetworkingWeek } = WEEKLY_THEMES[idx];
                      const isCurrentWeek = idx === currentWeekIdx;
                      return (
                        <div
                          key={week}
                          style={{
                            padding: '14px 16px',
                            border: `1px solid ${isNetworkingWeek ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                            borderRadius: 'var(--border-radius-sm)',
                            background: isCurrentWeek ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-cyan)' }}>Week {week}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{theme}</span>
                            {isNetworkingWeek && <Users size={13} color="var(--accent-cyan)" />}
                            {isCurrentWeek && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>This Week</span>}
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{THEME_DESCRIPTIONS[theme]}</p>
                          <p
                            style={{
                              fontSize: '0.86rem',
                              color: 'var(--text-secondary)',
                              lineHeight: 1.55,
                              margin: 0,
                              padding: '10px 12px',
                              background: 'rgba(var(--overlay-rgb), 0.02)',
                              borderRadius: 'var(--border-radius-sm)',
                              borderLeft: '3px solid var(--accent-cyan)',
                            }}
                          >
                            {domain.posts[idx]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <Hash size={13} style={{ flexShrink: 0, marginTop: '2px' }} /> Suggested tags for {selectedDomain}: {domain.hashtags}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn btn-primary" onClick={onClose}>Got It</button>
        </div>
      </div>
    </div>
  );
}
