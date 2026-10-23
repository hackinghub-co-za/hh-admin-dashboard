import { useMemo, useState } from 'react';
import { X, Copy, Check, MessageCircle } from 'lucide-react';
import { INTRO_GOALS, INTRO_BACKGROUNDS, INTRO_FOCUS_AREAS, buildIntroMessage } from '../lib/introMessage';

// Builds the introduction a new member posts in the community group, from
// the structure in the onboarding guide. Name, LinkedIn link and focus area
// start from the member's own profile, so most people only pick a goal.
// Lesedi ticks "Intro approved" for the member separately; copying here
// does not unlock anything.
export default function IntroBuilderModal({ initialName, initialLinkedin, initialAreas, introApproved, onClose }) {
  const [name, setName] = useState(initialName || '');
  const [goal, setGoal] = useState(INTRO_GOALS[0]);
  const [background, setBackground] = useState(INTRO_BACKGROUNDS[0]);
  const [areas, setAreas] = useState(initialAreas || []);
  const [linkedin, setLinkedin] = useState(initialLinkedin || '');
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => buildIntroMessage({ name, goal, background, areas, linkedin }), [name, goal, background, areas, linkedin]);

  const toggleArea = (area) => {
    setCopied(false);
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      // Clipboard can be refused (older browsers, some embedded views): the
      // text is on screen to select by hand, so just leave the button as is.
      setCopied(false);
    }
  };

  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' };
  const fieldStyle = { width: '100%', padding: '10px 12px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'inherit', fontSize: '0.9rem' };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        role="dialog"
        aria-label="Build your intro message"
        style={{ width: '100%', maxWidth: '620px', maxHeight: '88vh', overflowY: 'auto', padding: '28px', border: '1px solid var(--accent-cyan)', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: '18px', right: '18px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <MessageCircle size={20} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Build your intro message</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Change anything you like, then copy it. Lesedi will check it with you before you post it in the group.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="intro-name" style={labelStyle}>Your first name</label>
            <input id="intro-name" type="text" value={name} onChange={(e) => { setName(e.target.value); setCopied(false); }} style={fieldStyle} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="intro-goal" style={labelStyle}>Your goal</label>
            <select id="intro-goal" value={goal} onChange={(e) => { setGoal(e.target.value); setCopied(false); }} style={fieldStyle}>
              {INTRO_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="intro-background" style={labelStyle}>Your background</label>
            <select id="intro-background" value={background} onChange={(e) => { setBackground(e.target.value); setCopied(false); }} style={fieldStyle}>
              {INTRO_BACKGROUNDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <span style={labelStyle} id="intro-focus-label">What you want to focus on</span>
            <div role="group" aria-labelledby="intro-focus-label" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {INTRO_FOCUS_AREAS.map((area) => {
                const on = areas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleArea(area)}
                    className={on ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="intro-linkedin" style={labelStyle}>Your LinkedIn link</label>
            <input id="intro-linkedin" type="text" value={linkedin} onChange={(e) => { setLinkedin(e.target.value); setCopied(false); }} style={fieldStyle} autoComplete="off" placeholder="linkedin.com/in/your-name" />
          </div>
          <div>
            <span style={labelStyle}>Your message</span>
            <div aria-live="polite" style={{ whiteSpace: 'pre-wrap', padding: '14px 16px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-tertiary)', border: '1px dashed var(--border-color)', fontSize: '0.92rem', userSelect: 'text' }}>
              {message}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={handleCopy} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy message'}
          </button>
          <span style={{ fontSize: '0.8rem', color: introApproved ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
            {introApproved ? 'Lesedi has approved your intro. You can post it in the group.' : "Don't post it in the group until Lesedi approves it."}
          </span>
        </div>
      </div>
    </div>
  );
}
