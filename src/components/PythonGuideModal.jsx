import { X, GraduationCap, ExternalLink } from 'lucide-react';

// Python Learning Guide - the one in-app guide that replaced three separate
// Python cards in Resources (Exercism, W3Schools, Cisco NetAcad). Same shape
// as AZ900GuideModal.jsx: the Resources card keeps a short checklist for
// progress, and this is the full plan with every link. Facts are from each
// site's own page: Exercism's Python track lists 146 exercises in 17 concepts
// with automatic feedback and optional mentoring; the W3Schools tutorial is
// free with an in-browser editor, chapter exercises and a quiz, and needs no
// account to study; Cisco NetAcad's Python Essentials 1 is a free course for
// people with no programming experience.
const SECTIONS = [
  {
    heading: 'How to use these together',
    body: "Take one structured course so there is a clear order, keep a quick reference open for the moments you get stuck, and practise every concept as you learn it. Learning Python also covers the 'Python (or any programming language)' item on the DevSecOps roadmap.",
  },
  {
    heading: '1. Learn: Cisco NetAcad Python Essentials 1',
    body: "A free Cisco Networking Academy course for people with no programming experience. It covers basic syntax, data types, control flow and collections such as lists, tuples and dictionaries, in short lessons you can take at your own pace. Use it as your main course.",
    items: [{ label: 'Python Essentials 1 (Cisco NetAcad)', href: 'https://www.netacad.com/courses/python-essentials-1' }],
  },
  {
    heading: '2. Look things up: W3Schools Python tutorial',
    body: "A free, beginner-friendly tutorial from syntax and variables through functions, classes, file handling and modules. Edit and run code in the Try it Yourself editor, and check yourself with the chapter exercises and the quiz. No account is needed to study. Keep it open next to the course for a second explanation of anything that is unclear.",
    items: [{ label: 'W3Schools Python tutorial', href: 'https://www.w3schools.com/python/' }],
  },
  {
    heading: '3. Practise: Exercism Python track',
    body: "Free, hands-on practice: 146 exercises grouped into 17 concepts, with automatic feedback on your code and optional personal mentoring. After each topic in the course, do the matching Exercism concept before moving on. Solving real exercises is what makes the syntax stick.",
    items: [{ label: 'Python track on Exercism', href: 'https://exercism.org/tracks/python' }],
  },
  {
    heading: 'A simple weekly rhythm',
    body: 'Two or three lessons from the course, one W3Schools chapter on anything you found hard, and two or three Exercism exercises. Tick the steps off on the Resources card as you start each one.',
  },
];

export default function PythonGuideModal({ onClose }) {
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Python Learning Guide</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Three free resources, used together: a course, a reference and daily practice.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SECTIONS.map((s) => (
            <div key={s.heading} style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>{s.heading}</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
              {s.list && (
                <ul style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {s.list.map((t) => <li key={t}>{t}</li>)}
                </ul>
              )}
              {s.items && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  {s.items.map((it) => (
                    <a
                      key={it.href}
                      href={it.href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      <ExternalLink size={14} style={{ flexShrink: 0, marginTop: '3px' }} /> <span>{it.label}</span>
                    </a>
                  ))}
                </div>
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
