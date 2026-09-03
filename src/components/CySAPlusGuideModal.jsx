import { X, GraduationCap, ExternalLink } from 'lucide-react';

// CompTIA CySA+ Study Guide - same move as SecurityPlusGuideModal.jsx: one
// in-app guide with real content and real clickable links, instead of a
// handful of separate Resources cards. Catalogued in Resources
// (supabase/026_resources.sql) with just a teaser description; this is the
// real content, the "Read Guide" button opens.
const SECTIONS = [
  {
    heading: 'Overview',
    body: "An intermediate-level, vendor-neutral certification for professionals ready to move from security theory into proactive defensive operations. Where Security+ teaches you how to lock the doors, CySA+ is for the person monitoring the cameras, analyzing the footprints, and hunting down the intruder - threat intelligence, log analysis, and incident response. Price: R5,575. Recommended study duration: 4 to 12 weeks.",
    linkLabel: 'Official CompTIA CySA+ Overview',
    href: 'https://www.comptia.org/en-za/certifications/cybersecurity-analyst/#buy-now',
  },
  {
    heading: 'Video Course',
    body: "Jason Dion's full CySA+ course on Udemy - study guide, quizzes, and a full-length practice exam, aligned to the official CompTIA study guide.",
    linkLabel: 'Jason Dion — CySA+ Complete Course (Udemy)',
    href: 'https://www.udemy.com/course/comptia-cysa-003/',
  },
  {
    heading: 'Free Video Course',
    body: 'A free, full-length CySA+ course on YouTube covering every exam domain, if you\'d rather not pay for the Udemy course.',
    linkLabel: 'CySA+ Full Course — YouTube',
    href: 'https://youtube.com/playlist?list=PLXOxHuSTtqSD3yRXgqZCtC_IFx8D6MDob&si=8ZiuUEvsBy-0ZBOo',
  },
  {
    heading: 'Practice Tests',
    body: 'Free CySA+ practice questions with explanations to check exam readiness before booking the real thing.',
    linkLabel: 'OpenExamPrep — CySA+ Practice Tests',
    href: 'https://open-exam-prep.com/practice/comptia-cysa-plus',
  },
  {
    heading: 'Practice App',
    body: 'Mobile and web app for studying popular ISC2, CompTIA, and Cisco exams - including CySA+.',
    linkLabel: 'PocketPrep',
    href: 'https://www.pocketprep.com/exams/comptia-cysa/',
  },
];

export default function CySAPlusGuideModal({ onClose }) {
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>CompTIA CySA+ Study Guide</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Everything members actually use to pass CySA+, in one place.
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
