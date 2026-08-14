import { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, AlertCircle, Sparkles } from 'lucide-react';
import { fetchGemmaHistory } from '../lib/gemmaData';
import { friendlyErrorMessage } from '../lib/errorMessages';

export default function GemmaWidget({ user, isMockSession }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const loadingHistory = open && !isMockSession && !historyLoaded && !error;

  useEffect(() => {
    if (!open || isMockSession || historyLoaded) return;
    let cancelled = false;
    fetchGemmaHistory(user.email)
      .then((rows) => {
        if (cancelled) return;
        setMessages(rows);
        setHistoryLoaded(true);
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => { cancelled = true; };
    // Only needs to run once per open, not on every keystroke/message send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMockSession, historyLoaded]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Gemma chat' : 'Open Gemma chat'}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: open ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #5ee37a, #17a856)',
          border: open ? '1px solid var(--border-color)' : 'none',
          color: open ? 'var(--text-secondary)' : '#06120a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open ? 'none' : '0 4px 20px rgba(94, 227, 122, 0.4)',
          zIndex: 900,
        }}
      >
        {open ? <X size={22} /> : <Bot size={24} />}
      </button>

      {open && (
        <div
          className="glass-card"
          style={{
            position: 'fixed',
            bottom: '92px',
            right: '24px',
            width: '360px',
            maxWidth: 'calc(100vw - 48px)',
            height: '480px',
            maxHeight: 'calc(100vh - 140px)',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            zIndex: 900,
          }}
        >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #5ee37a, #17a856)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={18} color="#06120a" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Gemma</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hacking Hub Assistant</div>
            </div>
          </div>

          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} aria-hidden="true">
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 && !loadingHistory && (
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', background: 'rgba(94, 227, 122, 0.06)', border: '1px solid rgba(94, 227, 122, 0.15)' }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
                      <Sparkles size={14} style={{ flexShrink: 0, marginTop: '2px' }} color="var(--accent-cyan)" />
                      Hey, I'm Gemma. Ask me anything about Hacking Hub, or try "how am I doing?"
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Chats are saved and visible to admins for quality &amp; safety - don't share passwords or sensitive info.
                    </p>
                  </div>
                )}

                {loadingHistory && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading conversation...</div>}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius-md)',
                      background: m.role === 'user' ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                      color: m.role === 'user' ? '#06120a' : 'var(--text-primary)',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                ))}

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontSize: '0.8rem' }}>
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
              </div>

              <form style={{ display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                <input
                  type="text"
                  value=""
                  placeholder="Message Gemma..."
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.85rem' }}
                  readOnly
                />
                <button type="button" className="btn btn-primary" disabled style={{ padding: '10px 14px' }}>
                  <Send size={16} />
                </button>
              </form>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '6px 14px' }}>Under Construction</span>
            </div>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </>
  );
}
