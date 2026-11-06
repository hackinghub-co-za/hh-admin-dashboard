import { useEffect } from 'react';

// Full-screen shower of celebration emojis for the New Recent Wins
// "Celebrate" button (NewWinsModal). Purely decorative: it sits above
// everything, ignores clicks, and calls onDone once the last emoji has
// fallen so the parent can unmount it. The random layout comes from
// makeEmojiDrops() (lib/emojiDrops.js), called in the click handler (not
// during render), so each press gets a fresh shower.
export default function EmojiRain({ drops, onDone }) {
  useEffect(() => {
    const longest = Math.max(...drops.map((d) => d.delay + d.duration));
    const t = setTimeout(onDone, longest * 1000 + 100);
    return () => clearTimeout(t);
  }, [drops, onDone]);

  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 2000 }}>
      <style>{`
        @keyframes emoji-fall {
          from { transform: translate(0, -12vh) rotate(0deg); opacity: 1; }
          85% { opacity: 1; }
          to { transform: translate(var(--drift), 110vh) rotate(var(--spin)); opacity: 0; }
        }
      `}</style>
      {drops.map((d) => (
        <span
          key={d.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${d.left}%`,
            fontSize: `${d.size}px`,
            lineHeight: 1,
            '--spin': `${d.spin}deg`,
            '--drift': `${d.drift}px`,
            animation: `emoji-fall ${d.duration}s ${d.delay}s cubic-bezier(0.3, 0.1, 0.7, 1) both`,
          }}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  );
}
