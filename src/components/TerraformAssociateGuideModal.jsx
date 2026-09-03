import { X, GraduationCap, ExternalLink } from 'lucide-react';

// HashiCorp Certified: Terraform Associate 004 Study Guide - same move as
// SecurityPlusGuideModal.jsx/CySAPlusGuideModal.jsx: one in-app guide with
// real content and real clickable links. Catalogued in Resources
// (supabase/026_resources.sql) with just a teaser description; this is the
// real content, the "Read Guide" button opens.
const SECTIONS = [
  {
    heading: 'Overview',
    body: "Validates an engineer's foundational knowledge of Infrastructure as Code (IaC) concepts and hands-on cloud provisioning automation - the ability to write, plan, apply, and manage infrastructure configurations using Terraform across multi-cloud environments (AWS, Azure, GCP). Vendor-neutral. Price: R1,200 ($70). Recommended study duration: 4 to 8 weeks.",
    linkLabel: 'Official HashiCorp Terraform Associate — Buy / Sign In',
    href: 'https://developer.hashicorp.com/certifications/signin',
  },
  {
    heading: 'Video Course',
    body: "KodeKloud's Terraform Associate 004 course - lab-first, mapped directly to the official TA-004 exam objectives. Paid.",
    linkLabel: 'KodeKloud — Terraform Associate 004',
    href: 'https://learn.kodekloud.com/user/courses/hashicorp-certified-terraform-associate-004',
  },
  {
    heading: 'Free Documentation Learning Path',
    body: "HashiCorp's own official study guide - every exam objective mapped directly to documentation pages and hands-on tutorials, free.",
    linkLabel: 'HashiCorp Developer — Associate Prep (004)',
    href: 'https://developer.hashicorp.com/terraform/tutorials/certification-004',
  },
];

export default function TerraformAssociateGuideModal({ onClose }) {
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Terraform Associate Study Guide</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Everything members actually use to pass Terraform Associate 004, in one place.
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
