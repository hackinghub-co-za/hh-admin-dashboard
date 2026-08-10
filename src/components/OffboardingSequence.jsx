import { useState, useEffect, useRef, useMemo } from 'react';
import { LogOut } from 'lucide-react';

function buildLines(user) {
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'operative';
  const firstName = fullName.split(' ')[0];

  return [
    { text: '> CONNECTION TERMINATION SEQUENCE INITIATED...', style: 'system' },
    { text: `> DEREGISTERING OPERATIVE: ${fullName.toUpperCase()}`, style: 'system' },
    { text: `It's been a privilege having you in the Hub, ${firstName}.`, style: 'data' },
    { text: 'Whatever comes next - go build something good.', style: 'data' },
  ];
}

// Quieter cousin of OnboardingSequence's sound hook - a farewell isn't a party, so
// no background loop, just soft key-click blips as the lines type out. Same
// Web-Audio-synthesized approach (no real audio files to embed).
function useTypingSound(enabled) {
  const ctxRef = useRef(null);

  const getCtx = () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctxRef.current = new AudioCtx();
    }
    return ctxRef.current;
  };

  const playClick = () => {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 320 + Math.random() * 120;
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  };

  return { playClick };
}

const RATINGS = [1, 2, 3, 4, 5];

export default function OffboardingSequence({ user, onDone }) {
  const lines = useMemo(() => buildLines(user), [user]);
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const { playClick } = useTypingSound(true);
  const linesDone = lineIndex >= lines.length;

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (linesDone) return;
    const current = lines[lineIndex];
    if (charIndex < current.text.length) {
      const t = setTimeout(() => {
        setCharIndex((c) => c + 1);
        if (current.text[charIndex] !== ' ') playClick();
      }, 18);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLineIndex((i) => i + 1);
      setCharIndex(0);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIndex, lineIndex, linesDone]);

  const finish = async (withFeedback) => {
    setSubmitting(true);
    setError(null);
    try {
      await onDone(withFeedback ? { rating: rating || null, feedback: feedback.trim() } : { rating: null, feedback: '' });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const styleFor = (style) => (style === 'system' ? { color: '#e5e7eb' } : { color: '#f19a9a' });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0505',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace',
      }}
    >
      <style>{`
        @keyframes offboarding-blink { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes offboarding-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .offboarding-cursor { animation: offboarding-blink 1s step-end infinite; }
        .offboarding-panel { animation: offboarding-fade-in 0.4s ease; }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, rgba(241,154,154,0.02) 0px, rgba(241,154,154,0.02) 1px, transparent 1px, transparent 3px)',
        }}
      />

      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          {lines.slice(0, lineIndex).map((l, i) => (
            <div key={i} style={{ ...styleFor(l.style), fontSize: '0.95rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {l.text}
            </div>
          ))}
          {!linesDone && lines[lineIndex] && (
            <div style={{ ...styleFor(lines[lineIndex].style), fontSize: '0.95rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {lines[lineIndex].text.slice(0, charIndex)}
              <span className="offboarding-cursor" style={{ color: '#f19a9a' }}>█</span>
            </div>
          )}

          {linesDone && (
            <div className="offboarding-panel" style={{ marginTop: '28px' }}>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '14px' }}>
                Anything you'd like us to know on your way out? Totally optional.
              </p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {RATINGS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      border: `1px solid ${rating >= r ? '#f19a9a' : 'rgba(255,255,255,0.12)'}`,
                      background: rating >= r ? 'rgba(241,154,154,0.12)' : 'transparent',
                      color: rating >= r ? '#f19a9a' : '#6b7280',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.85rem',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Any last thoughts, feedback, or reasons for leaving..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#e5e7eb',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                  marginBottom: '16px',
                }}
              />

              {error && <p style={{ color: '#f19a9a', fontSize: '0.8rem', marginBottom: '12px' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => finish(false)}
                  style={{
                    padding: '12px 20px',
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                    color: '#9ca3af',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    cursor: submitting ? 'default' : 'pointer',
                  }}
                >
                  Just Disconnect
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => finish(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: '#1a0a0a',
                    background: 'linear-gradient(135deg, #f19a9a, #dc5c5c)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: submitting ? 'default' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  <LogOut size={16} />
                  {submitting ? 'Disconnecting...' : 'Submit & Disconnect'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
