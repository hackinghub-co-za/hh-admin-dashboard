// Random layout for EmojiRain (the New Recent Wins "Celebrate" shower):
// which emoji, where it starts, how big, how fast and how much it spins.
// Kept out of render so each click gets a fresh shower. Fewer drops and no
// spin for people who ask their device to reduce motion.
const EMOJIS = ['🎉', '🥳', '🎊', '👏', '🙌', '🔥', '⭐', '💚', '🏆'];

export function makeEmojiDrops() {
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const burst = Date.now();
  const count = reduceMotion ? 18 : 70;
  return Array.from({ length: count }, (_, i) => ({
    id: `${burst}-${i}`,
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    left: Math.random() * 100,
    size: 22 + Math.random() * 26,
    delay: Math.random() * 1.2,
    duration: 2.4 + Math.random() * 2,
    spin: reduceMotion ? 0 : (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
    drift: (Math.random() - 0.5) * 120,
  }));
}
