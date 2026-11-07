import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { MAX_COMMENT_LENGTH } from '../lib/winCommentsData';

// The comment thread under a win in NewWinsModal. The parent owns the
// comments and the add/delete calls; this shows them, newest at the bottom,
// with a box to add one. onTypingChange tells the modal to hold its
// auto-advance while someone is writing.
function timeLabel(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export default function WinComments({ comments, headshotFor, onAdd, onDelete, onTypingChange }) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    onTypingChange?.(focused || draft.trim().length > 0);
  }, [focused, draft, onTypingChange]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments.length]);

  const submit = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onAdd(body);
      setDraft('');
    } catch (err) {
      setError(err?.message || 'Could not post your comment. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
        <MessageCircle size={14} /> {comments.length ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Be the first to comment'}
      </div>

      {comments.length > 0 && (
        <div ref={listRef} style={{ maxHeight: '170px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', paddingRight: '4px' }}>
          {comments.map((c) => {
            const headshot = headshotFor?.(c.authorEmail);
            return (
              <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                {headshot ? (
                  <img src={headshot} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(var(--accent-rgb), 0.15)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                    {(c.authorName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0, background: 'rgba(var(--overlay-rgb), 0.04)', borderRadius: 'var(--border-radius-sm)', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.authorName}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{timeLabel(c.createdAt)}</span>
                    {c.isMine && (
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        aria-label="Delete your comment"
                        title="Delete your comment"
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '2px 0 0', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Say congrats…"
          aria-label="Write a comment"
          maxLength={MAX_COMMENT_LENGTH}
          className="form-input"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim() || sending} aria-label="Post comment" style={{ padding: '0 14px', justifyContent: 'center' }}>
          <Send size={16} />
        </button>
      </form>
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '6px' }}>{error}</p>}
    </div>
  );
}
