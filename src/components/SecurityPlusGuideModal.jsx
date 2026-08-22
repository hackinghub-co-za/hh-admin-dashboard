import { X, GraduationCap, ExternalLink } from 'lucide-react';

// CompTIA Security+ Study Guide - consolidates what used to be 3 separate
// Resources cards (official overview, Professor Messer's video course,
// ExamCompass practice tests) into one in-app guide, same move as the
// LinkedIn Playbook. Catalogued in Resources (supabase/026_resources.sql)
// with just a teaser description; this is the real content, with real
// clickable links, the "Read Guide" button opens.
const SECTIONS = [
  {
    heading: 'Overview',
    body: 'A highly recognized, vendor-neutral certification for starting a career in cybersecurity - covers core security principles, concepts, and best practices without tying you to one specific technology or platform. Price: R5,412. Recommended study duration: 4 to 12 weeks.',
    linkLabel: 'Official CompTIA Security+ Overview',
    href: 'https://www.comptia.org/en-us/certifications/security/#overview',
  },
  {
    heading: 'Video Course',
    body: 'Free, full-length CompTIA Security+ video course covering every exam objective, taught by Professor Messer.',
    linkLabel: 'Professor Messer — Security+ Video Course',
    href: 'https://www.youtube.com/playlist?list=PLG49S3nxzAnl4QDVqK-hOnoqcSKEIDDuv',
  },
  {
    heading: 'Practice Tests',
    body: 'Free Security+ practice tests to check exam readiness before booking the real thing.',
    linkLabel: 'ExamCompass — Security+ Practice Tests',
    href: 'https://www.examcompass.com/comptia/security-plus-certification/free-security-plus-practice-tests',
  },
  {
    heading: 'Practice App',
    body: 'Mobile and web app for studying popular ISC2, CompTIA, and Cisco exams - including Security+.',
    linkLabel: 'PocketPrep',
    href: 'https://study.pocketprep.com/study',
  },
  {
    heading: 'More Practice',
    body: 'Members have also used Open-exam-prep for extra practice questions.',
  },
];

export default function SecurityPlusGuideModal({ onClose }) {
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
          <GraduationCap size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>CompTIA Security+ Study Guide</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Everything members actually use to pass Security+, in one place.
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
