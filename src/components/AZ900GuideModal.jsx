import { X, GraduationCap, ExternalLink } from 'lucide-react';

// Microsoft AZ-900 (Azure Fundamentals) Study Guide - same move as
// AZ900GuideModal.jsx/SecurityPlusGuideModal.jsx: one in-app guide with real
// content and real clickable links. Catalogued in Resources
// (supabase/026_resources.sql) with just a teaser description; this is the
// real content the "Read Guide" button opens.
const SECTIONS = [
  {
    heading: 'Overview',
    body: "An entry-level credential that validates core knowledge of cloud computing and Azure services, including security principles - a stepping stone for careers in cybersecurity and cloud infrastructure. Price: around R700. Recommended study duration: 1 to 4 weeks.",
    linkLabel: 'Official AZ-900 Certification',
    href: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/',
  },
  {
    heading: 'Video Playlist',
    body: 'A recommended AZ-900 video playlist to watch alongside your reading.',
    linkLabel: 'AZ-900 Playlist on YouTube',
    href: 'https://www.youtube.com/playlist?list=PLZCHR_fccEf8zN6UB8JOK2Y6l5DVqAcyc',
  },
  {
    heading: 'Practice Questions',
    body: "Microsoft's free Practice Assessment - the closest thing to the real exam, and it shows you which domains to revisit.",
    linkLabel: 'Free AZ-900 Practice Assessment',
    href: 'https://learn.microsoft.com/en-us/credentials/certifications/exams/az-900/practice/assessment?assessment-type=practice&assessmentId=23',
  },
  {
    heading: 'Microsoft Learn',
    body: "Microsoft's own free training and study guide - honestly the best resource for this one.",
    linkLabel: 'Microsoft Learn - AZ-900 Study Guide',
    href: 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-900',
  },
];

export default function AZ900GuideModal({ onClose }) {
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
          <GraduationCap size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>AZ-900 Study Guide</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Everything members actually use to pass AZ-900, in one place.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SECTIONS.map((s) => (
            <div key={s.heading} style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>{s.heading}</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
              {s.href && (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
                >
                  <ExternalLink size={14} /> {s.linkLabel}
                </a>
              )}
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
