import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { isSafeUrl } from '../lib/safeUrl';
import { playCheer } from '../lib/cheerSound';
import EmojiRain from './EmojiRain';
import WinComments from './WinComments';
import { makeEmojiDrops } from '../lib/emojiDrops';

// New Recent Wins popup - opens on the Dashboard the first time a member
// comes in after a new win was posted (which wins count: lib/newWinsData.js),
// after Cyber Question of the Day has been answered, same backdrop and card
// as DailyQuestionModal. Several new wins show one at a time: arrows, a
// swipe, the keyboard arrows, or the 5-second auto-advance move on, and
// auto-advance stops on the last one. Unlike the question it can always be
// closed. Celebrate showers emojis over the whole screen with a cheer
// (EmojiRain, lib/cheerSound.js), and holds the auto-advance while it plays.
// Each win has its comment thread underneath (WinComments); auto-advance
// also holds while someone is writing. The Dashboard's Recent Wins card
// reuses this for a single win, with its own title.
//
// The parent resolves each win's display bits (dateLabel, headshotUrl,
// isYou) and owns the comments, so this stays a dumb view.
const AUTO_ADVANCE_MS = 5000;
const SWIPE_PX = 40;

export default function NewWinsModal({ wins, onClose, title, commentsByWin = {}, headshotFor, onAddComment, onDeleteComment }) {
  const [index, setIndex] = useState(0);
  const [drops, setDrops] = useState(null);
  const [typing, setTyping] = useState(false);
  const touchStartX = useRef(null);
  const endRain = useCallback(() => setDrops(null), []);
  const celebrate = () => {
    setDrops(makeEmojiDrops());
    playCheer();
  };
  const count = wins.length;
  const isLast = index === count - 1;

  // Restarts on every move, so a manual click gets a full 5s before the
  // next automatic one.
  useEffect(() => {
    if (isLast || drops || typing) return;
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, count - 1)), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [index, isLast, count, drops, typing]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, count - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onClose]);

  if (count === 0) return null;
  const win = wins[index];

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx <= -SWIPE_PX) setIndex((i) => Math.min(i + 1, count - 1));
    else if (dx >= SWIPE_PX) setIndex((i) => Math.max(i - 1, 0));
  };

  const arrow = (dir) => {
    const disabled = dir < 0 ? index === 0 : isLast;
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        onClick={() => setIndex((i) => Math.min(Math.max(i + dir, 0), count - 1))}
        disabled={disabled}
        aria-label={dir < 0 ? 'Previous win' : 'Next win'}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.3 : 1,
          flexShrink: 0,
        }}
      >
        <Icon size={20} />
      </button>
    );
  };

  return (
    <div
      onClick={onClose}
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
    >
      <style>{`
        @keyframes new-win-in { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        .new-win-slide { animation: new-win-in 0.4s ease; }
      `}</style>
      <div
        className="glass-card"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-purple)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Award size={22} color="var(--accent-purple)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{title || (count === 1 ? 'New Recent Win' : `${count} New Recent Wins`)}</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {count > 1 && arrow(-1)}
          <div
            key={win.id}
            className="new-win-slide"
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', padding: '8px 0' }}
          >
            {win.headshotUrl ? (
              <img
                src={win.headshotUrl}
                alt=""
                className="duo-pop"
                style={{ width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-purple)' }}
              />
            ) : (
              <div className="duo-pop" style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'rgba(var(--accent-rgb), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', lineHeight: 1 }}>
                🎉
              </div>
            )}
            {win.isYou && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>That’s you!</span>}
            {isSafeUrl(win.linkedinUrl) ? (
              <a href={win.linkedinUrl} target="_blank" rel="noreferrer" title="View on LinkedIn" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'none' }}>
                {win.member}
              </a>
            ) : (
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{win.member}</span>
            )}
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{win.achievement}</p>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{win.dateLabel}</span>
          </div>
          {count > 1 && arrow(1)}
        </div>

        {count > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
            {wins.map((w, i) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show win ${i + 1}`}
                style={{
                  width: i === index ? '18px' : '7px',
                  height: '7px',
                  borderRadius: '999px',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'width 0.2s ease',
                  background: i === index ? 'var(--accent-purple)' : 'rgba(var(--overlay-rgb), 0.15)',
                }}
              />
            ))}
          </div>
        )}

        {onAddComment && (
          <WinComments
            key={win.id}
            comments={commentsByWin[win.id] || []}
            headshotFor={headshotFor}
            onAdd={(body) => onAddComment(win.id, body)}
            onDelete={(id) => onDeleteComment(win.id, id)}
            onTypingChange={setTyping}
          />
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={celebrate}
            className="btn btn-secondary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Celebrate 🎉
          </button>
          <button
            type="button"
            onClick={isLast ? onClose : () => setIndex((i) => i + 1)}
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {isLast ? 'Continue' : 'Next win'}
          </button>
        </div>
      </div>
      {drops && <EmojiRain drops={drops} onDone={endRain} />}
    </div>
  );
}
