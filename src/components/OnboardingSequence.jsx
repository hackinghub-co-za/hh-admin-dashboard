import { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, VolumeX, SkipForward, MessageCircle, Calendar, Terminal, UserPlus } from 'lucide-react';

// A little personality per email provider - not a real security claim, just flavor.
const DOMAIN_FLAVOR = {
  'gmail.com': 'Standard-issue civilian encryption. Acceptable.',
  'icloud.com': 'Cupertino-grade keys detected. Premium hardware, premium expectations.',
  'outlook.com': 'Legacy protocol handshake accepted.',
  'hotmail.com': 'Legacy protocol handshake accepted. Respectfully vintage.',
  'protonmail.com': 'Encrypted-by-default. Someone here is already security-conscious.',
  'proton.me': 'Encrypted-by-default. Someone here is already security-conscious.',
  'yahoo.com': 'Ancient relay detected. Still standing. Respect.',
};
const DEFAULT_FLAVOR = 'Unclassified domain. Filed under "mysterious."';

function buildLines(user) {
  const email = user?.email || 'unknown@hacker.net';
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const flavor = DOMAIN_FLAVOR[domain] || DEFAULT_FLAVOR;
  const fullName = user?.user_metadata?.full_name || email.split('@')[0];
  const firstName = fullName.split(' ')[0];

  return [
    { text: '> INITIATING SECURE HANDSHAKE...', style: 'system' },
    { text: `> SCANNING CREDENTIALS: ${email}`, style: 'system' },
    { text: `  [${domain || 'unknown'}] ${flavor}`, style: 'data' },
    { text: `> IDENTITY CONFIRMED: ${fullName.toUpperCase()}`, style: 'success' },
    { text: '> ACCESS LEVEL: MEMBER — CLEARANCE GRANTED', style: 'success' },
    { text: `> WELCOME TO HACKING HUB, ${firstName.toUpperCase()}.`, style: 'headline' },
    { text: 'The Hub is yours now. Go break something (legally).', style: 'data' },
  ];
}

// A2 minor-pentatonic bassline for the background loop, in Hz.
const ARP_NOTES = [110.0, 130.81, 146.83, 110.0, 164.81, 146.83, 130.81, 196.0];
const STEP_MS = 117; // 16th notes at 128bpm - upbeat techno tempo

// Lightweight synthesized sound via Web Audio API - no embedded audio files exist to
// use, and this shouldn't fabricate/source licensed music, so the background loop is
// a small procedural techno step-sequencer (kick + hats + bass arp) built from raw
// oscillators/noise instead. Defaults on; browsers block autoplay-with-sound until a
// user gesture, so this also attaches a one-time unlock on the first click/keypress
// in case the page itself didn't count as one (e.g. arriving via an OAuth redirect).
function useTerminalSound(enabled) {
  const ctxRef = useRef(null);
  const noiseBufferRef = useRef(null);
  const loopRef = useRef(null);
  const stepRef = useRef(0);

  const getCtx = () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctxRef.current = new AudioCtx();
    }
    return ctxRef.current;
  };

  const getNoiseBuffer = (ctx) => {
    if (!noiseBufferRef.current) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noiseBufferRef.current = buffer;
    }
    return noiseBufferRef.current;
  };

  const playClick = () => {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 600 + Math.random() * 300;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  };

  const playConfirm = () => {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  };

  const playKick = (ctx, time) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.16);
  };

  const playHat = (ctx, time, accent) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(accent ? 0.05 : 0.025, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.08 : 0.03));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.1);
  };

  const playBassNote = (ctx, time, freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + STEP_MS / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + STEP_MS / 1000);
  };

  // Background techno loop: 4-on-the-floor kick, off-beat hats, arpeggiated bassline.
  useEffect(() => {
    if (!enabled) {
      if (loopRef.current) {
        clearInterval(loopRef.current);
        loopRef.current = null;
      }
      return undefined;
    }

    const ctx = getCtx();
    if (!ctx) return undefined;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const unlock = () => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    stepRef.current = 0;
    loopRef.current = setInterval(() => {
      const step = stepRef.current % 16;
      const time = ctx.currentTime;
      if (step % 4 === 0) playKick(ctx, time);
      if (step % 2 === 1) playHat(ctx, time, step === 15);
      if (step % 2 === 0) playBassNote(ctx, time, ARP_NOTES[(step / 2) % ARP_NOTES.length]);
      stepRef.current += 1;
    }, STEP_MS);

    return () => {
      clearInterval(loopRef.current);
      loopRef.current = null;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { playClick, playConfirm };
}

export default function OnboardingSequence({ user, onComplete }) {
  const lines = useMemo(() => buildLines(user), [user]);
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const { playClick, playConfirm } = useTerminalSound(soundOn);
  const done = lineIndex >= lines.length;

  useEffect(() => {
    if (done) return;
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
    }, 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIndex, lineIndex, done]);

  useEffect(() => {
    if (done) playConfirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const skipToEnd = () => {
    setLineIndex(lines.length);
    setCharIndex(0);
  };

  const styleFor = (style) => {
    switch (style) {
      case 'success': return { color: '#5ee37a' };
      case 'headline': return { color: '#5ee37a', fontWeight: 700, fontSize: '1.15em' };
      case 'data': return { color: '#7f879b' };
      default: return { color: '#e5e7eb' };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#050607',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace',
      }}
    >
      <style>{`
        @keyframes onboarding-blink { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes onboarding-scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes onboarding-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .onboarding-cursor { animation: onboarding-blink 1s step-end infinite; }
        .onboarding-cta { animation: onboarding-fade-in 0.4s ease; }
      `}</style>

      {/* Scanline flicker overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, rgba(94,227,122,0.025) 0px, rgba(94,227,122,0.025) 1px, transparent 1px, transparent 3px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '120px',
          pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(94,227,122,0.06), transparent)',
          animation: 'onboarding-scanline 6s linear infinite',
        }}
      />

      {/* Top controls */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '20px 24px' }}>
        <button
          onClick={() => setSoundOn((s) => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '9999px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(94,227,122,0.25)', color: '#5ee37a',
            fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          {soundOn ? 'Sound On' : 'Sound Off'}
        </button>
        <button
          onClick={skipToEnd}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '9999px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#7f879b',
            fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <SkipForward size={14} /> Skip Intro
        </button>
      </div>

      {/* Terminal body */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '640px' }}>
          {lines.slice(0, lineIndex).map((l, i) => (
            <div key={i} style={{ ...styleFor(l.style), fontSize: '0.95rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {l.text}
            </div>
          ))}
          {!done && lines[lineIndex] && (
            <div style={{ ...styleFor(lines[lineIndex].style), fontSize: '0.95rem', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {lines[lineIndex].text.slice(0, charIndex)}
              <span className="onboarding-cursor" style={{ color: '#5ee37a' }}>█</span>
            </div>
          )}

          {done && (
            <div className="onboarding-cta" style={{ marginTop: '32px', textAlign: 'center' }}>
              <p style={{ color: '#7f879b', fontSize: '0.85rem', marginBottom: '12px' }}>
                A few quick things before you dive in - have you got these covered?
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                {[
                  { href: 'https://chat.whatsapp.com/JjJxnaHruvu8EYdgcUOyz1', icon: MessageCircle, label: 'Join the WhatsApp Community' },
                  { href: 'https://workspace.google.com/products/calendar/', icon: Calendar, label: 'Get Google Calendar' },
                  { href: 'https://tryhackme.com/signup', icon: Terminal, label: 'Create a TryHackMe Account' },
                  { href: 'https://tryhackme.com/p/SiyaCybersecurity', icon: UserPlus, label: 'Follow SiyaCybersecurity on TryHackMe' },
                ].map(({ href, icon: Icon, label }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9999px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(94,227,122,0.25)', color: '#5ee37a',
                      fontSize: '0.8rem', fontFamily: 'inherit', textDecoration: 'none',
                    }}
                  >
                    <Icon size={14} /> {label}
                  </a>
                ))}
              </div>
              <p style={{ color: '#7f879b', fontSize: '0.85rem', marginBottom: '18px' }}>
                One last thing: add a headshot so your fellow members can actually recognize you in the directory.
              </p>
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onComplete(true)}
                  style={{
                    padding: '14px 32px',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: '#050607',
                    background: 'linear-gradient(135deg, #5ee37a, #17a856)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 0 30px rgba(94,227,122,0.35)',
                  }}
                >
                  [ SET UP MY PROFILE ]
                </button>
                <button
                  onClick={() => onComplete(false)}
                  style={{
                    padding: '14px 24px',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
                    color: '#7f879b',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Enter the Hub, I'll do it later
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
