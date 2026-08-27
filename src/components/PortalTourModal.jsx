import { useState } from 'react';
import { X, LayoutDashboard, Map, CalendarClock, Library, Users, ArrowRight, ArrowLeft } from 'lucide-react';

// Onboarding checklist's "Take the portal tour" step - a short slide-through
// of the sections a new member most needs to find on day one. Deliberately a
// simple modal carousel rather than a real DOM-spotlight tour (no tour
// library in this project, and 5 static slides cover the same ground with a
// fraction of the moving parts).
const SLIDES = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: "Your home base — upcoming events, community wins, your next 1-on-1, and a quick read on where you're at overall.",
  },
  {
    icon: Map,
    title: 'Roadmap',
    body: 'Your cybersecurity learning path, broken into Core Foundations and specializations. Check items off and report progress as you go — an admin approves each stage.',
  },
  {
    icon: CalendarClock,
    title: '1on1 Meetings',
    body: 'Book coaching sessions directly on your mentor\'s live Google Calendar — strategy, career roadmaps, CV review, interview prep.',
  },
  {
    icon: Library,
    title: 'Resources',
    body: 'Guides, cert study material, and tools the community actually uses — LinkedIn strategy, Security+, and more.',
  },
  {
    icon: Users,
    title: 'Members',
    body: "The member directory — browse who else is here, and set up your own card so people recognize you.",
  },
];

export default function PortalTourModal({ onComplete }) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const Icon = slide.icon;

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
      onClick={onComplete}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 30px rgba(94, 227, 122, 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onComplete}
          aria-label="Skip tour"
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

        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'rgba(94, 227, 122, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <Icon size={26} color="var(--accent-cyan)" />
        </div>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>{slide.title}</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '28px', minHeight: '72px' }}>
          {slide.body}
        </p>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
          {SLIDES.map((s, i) => (
            <div
              key={s.title}
              style={{
                height: '4px',
                flex: 1,
                borderRadius: '2px',
                background: i <= index ? 'var(--accent-cyan)' : 'var(--border-color)',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setIndex((i) => i - 1)}
            disabled={index === 0}
            className="btn btn-secondary"
            style={{ opacity: index === 0 ? 0.4 : 1, fontSize: '0.85rem' }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          {isLast ? (
            <button onClick={onComplete} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              Got it, take me in
            </button>
          ) : (
            <button onClick={() => setIndex((i) => i + 1)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
