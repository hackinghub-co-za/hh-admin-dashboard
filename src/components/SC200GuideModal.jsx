import { X, GraduationCap, ExternalLink } from 'lucide-react';

// Microsoft SC-200 (Security Operations Analyst) Study Guide - same move as
// SecurityPlusGuideModal.jsx/CySAPlusGuideModal.jsx/TerraformAssociateGuideModal.jsx:
// one in-app guide with real content and real clickable links. Catalogued in
// Resources (supabase/026_resources.sql) with just a teaser description;
// this is the real content, the "Read Guide" button opens.
const SECTIONS = [
  {
    heading: 'Overview',
    body: "Teaches how to investigate, respond to, and hunt for threats using Microsoft Sentinel, Microsoft Defender XDR, and Microsoft Defender for Cloud - mitigating cyberthreats by configuring Sentinel and using Kusto Query Language (KQL) for detection, analysis, and reporting. Price: around R950. Recommended study duration: 4 to 12 weeks.",
    linkLabel: 'Official SC-200 Certification',
    href: 'https://learn.microsoft.com/en-us/credentials/certifications/security-operations-analyst/?practice-assessment-type=certification',
  },
  {
    heading: 'Practice Questions',
    body: 'Free SC-200 practice questions covering Defender XDR, Microsoft Sentinel, KQL hunting, and incident response.',
    linkLabel: 'OpenExamPrep — SC-200 Practice Exam',
    href: 'https://open-exam-prep.com/practice/azure-sc-200',
  },
  {
    heading: 'Microsoft Learn',
    body: "Microsoft's own official training course and study guide - honestly the best resource for this one.",
    linkLabel: 'Microsoft Learn — SC-200 Training',
    href: 'https://learn.microsoft.com/en-us/training/courses/sc-200t00#course-syllabus',
  },
  {
    heading: 'KQL Practice',
    body: 'KC7 - a free cyber detective game that teaches KQL by having you investigate realistic breaches using real log data in Azure Data Explorer.',
    linkLabel: 'KC7 — KQL Practice',
    href: 'https://kc7cyber.com/',
  },
];

export default function SC200GuideModal({ onClose }) {
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>SC-200 Study Guide</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Everything members actually use to pass SC-200, in one place.
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
