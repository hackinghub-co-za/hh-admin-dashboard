import { X, GraduationCap, ExternalLink } from 'lucide-react';

// KodeKloud - same move as SecurityPlusGuideModal.jsx/TerraformAssociateGuideModal.jsx:
// one in-app guide with real content and real clickable links. Catalogued in
// Resources (supabase/026_resources.sql) with just a teaser description; this
// is the real content, the "Read Guide" button opens. Unlike the cert-specific
// guides, this one explains the platform itself - it's already the linked
// course provider inside TerraformAssociateGuideModal.jsx, and is directly
// relevant to KCNA/KCSA too (both now sponsor-eligible on the DevSecOps track).
const SECTIONS = [
  {
    heading: 'What KodeKloud Is',
    body: "A hands-on, lab-first learning platform for DevOps, Cloud, and Kubernetes - instead of just watching videos, you run real commands against real infrastructure right in the browser, no local setup needed. It's one of the most widely used platforms for Kubernetes certification prep (CKA/CKAD/CKS, and now KCNA/KCSA too), plus Terraform, Docker, and general cloud/DevOps skills. Plans start around $15/month, and some individual courses are free.",
    linkLabel: 'KodeKloud — Your Dashboard',
    href: 'https://learn.kodekloud.com/user/dashboard',
  },
  {
    heading: 'Terraform Associate Prep',
    body: "KodeKloud's Terraform Associate 004 course - lab-first, mapped directly to the official exam objectives. Paid.",
    linkLabel: 'KodeKloud — Terraform Associate 004',
    href: 'https://learn.kodekloud.com/user/courses/hashicorp-certified-terraform-associate-004',
  },
  {
    heading: 'Kubernetes (KCNA / KCSA) Prep',
    body: "KodeKloud is one of the most recommended platforms for Kubernetes and Cloud Native fundamentals - real, hands-on clusters instead of just slides, directly relevant to both KCNA and KCSA on the DevSecOps track.",
    linkLabel: 'KodeKloud — Browse Courses',
    href: 'https://kodekloud.com',
  },
];

export default function KodeKloudGuideModal({ onClose }) {
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>KodeKloud</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          The hands-on DevOps, Cloud & Kubernetes platform behind several certs on your roadmap.
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
