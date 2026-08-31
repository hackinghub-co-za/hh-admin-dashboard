import { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, AlertCircle, Sparkles } from 'lucide-react';
import { fetchGemmaHistory, sendGemmaMessage } from '../lib/gemmaData';
import { friendlyMemberErrorMessage } from '../lib/errorMessages';
import { logPortalEvent } from '../lib/portalEventsData';

// Mock Member has no real Supabase session to call gemma-chat with, so a
// send in mock mode is answered locally instead of hitting the network -
// same "canned local demo" treatment mock sessions get everywhere else in
// this app (reviews, memberProfiles, etc. in MemberPortal.jsx).
const MOCK_REPLY = "This is a demo reply - Mock Member sessions don't call the real Gemini API. In a live session I'd answer using your actual profile and conversation history.";

export default function GemmaWidget({ user, isMockSession }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
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
      .catch((err) => !cancelled && setError(friendlyMemberErrorMessage(err)));
    return () => { cancelled = true; };
    // Only needs to run once per open, not on every keystroke/message send.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMockSession, historyLoaded]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setSending(true);

    if (isMockSession) {
      // No real backend to call in mock mode - a short delay just keeps the
      // "Gemma's thinking..." indicator from flashing instantly.
      setTimeout(() => {
        setMessages((prev) => [...prev, { role: 'assistant', content: MOCK_REPLY }]);
        setSending(false);
      }, 500);
      return;
    }

    try {
      const reply = await sendGemmaMessage(trimmed);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next && !isMockSession) logPortalEvent('gemma_opened').catch(() => {});
            return next;
          });
        }}
        aria-label={open ? 'Close Gemma chat' : 'Open Gemma chat'}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: open ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
          border: open ? '1px solid var(--border-color)' : 'none',
          color: open ? 'var(--text-secondary)' : 'var(--accent-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open ? 'none' : '0 4px 20px rgba(var(--accent-rgb), 0.4)',
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
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={18} color="var(--accent-ink)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Gemma</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hacking Hub Assistant</div>
            </div>
          </div>

          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 && !loadingHistory && (
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--accent-rgb), 0.06)', border: '1px solid rgba(var(--accent-rgb), 0.15)' }}>
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
                      color: m.role === 'user' ? 'var(--accent-ink)' : 'var(--text-primary)',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                ))}

                {sending && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      fontStyle: 'italic',
                    }}
                  >
                    Gemma's thinking...
                  </div>
                )}

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontSize: '0.8rem' }}>
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message Gemma..."
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.85rem' }}
                  disabled={sending}
                  maxLength={2000}
                />
                <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()} style={{ padding: '10px 14px' }}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </>
  );
}
