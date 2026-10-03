import { useState, useEffect, useRef } from 'react';
import { Send, X, Plus, History, Maximize2, Copy, ThumbsUp, ThumbsDown, AlertCircle, Eye, Trash2, Coffee, UserRound, Check, Sparkles, ArrowRight } from 'lucide-react';
import GemmaAvatar from './GemmaAvatar';
import GemmaQuiz from './GemmaQuiz';
import { GEMMA_ACTIONS, SOURCE_LABELS, TAB_LABELS, promptsForTab, runGemmaAction } from './gemmaActions';
import { mockGemmaReply } from './gemmaMock';
import {
  fetchGemmaConversations, fetchGemmaMessages, streamGemmaMessage, setGemmaFeedback,
  archiveGemmaConversation, requestGemmaHandoff, dismissWeeklyNote,
} from '../../lib/gemmaData';
import { renderMarkdown } from '../../lib/renderMarkdown';
import { friendlyMemberErrorMessage } from '../../lib/errorMessages';
import { logPortalEvent } from '../../lib/portalEventsData';

const LOW_MESSAGES_WARNING = 10;
let localIdCounter = 0;
const nextLocalId = (prefix) => `${prefix}-${++localIdCounter}`;

function Markdown({ text }) {
  return <div className="gemma-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}

function WellbeingCard({ conversationId, isMockSession, setActiveTab }) {
  const [state, setState] = useState('idle');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  const send = async () => {
    setError(null);
    setState('sending');
    try {
      if (!isMockSession) await requestGemmaHandoff(conversationId, note.trim());
      setState('done');
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
      setState('asking');
    }
  };

  return (
    <div className="gemma-care">
      {state === 'done' ? (
        <p><Check size={14} /> Done. Someone from the team will reach out soon. You're not on your own with this.</p>
      ) : state === 'idle' ? (
        <div className="gemma-actions">
          <button className="gemma-action" onClick={() => runGemmaAction('take_a_break', setActiveTab)}><Coffee size={13} /> Take a Break</button>
          <button className="gemma-action" onClick={() => setState('asking')}><UserRound size={13} /> Talk to a person</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '0.8rem' }}>A community manager will check in with you. They'll be able to read this chat so you don't have to explain it all again.</p>
          <textarea className="form-input" rows={2} placeholder="Anything you'd like them to know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          {error && <p style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</p>}
          <div className="gemma-actions">
            <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} disabled={state === 'sending'} onClick={send}>{state === 'sending' ? 'Sending...' : 'Ask for a check-in'}</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setState('idle')}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ message, conversationId, isMockSession, setActiveTab, onQuiz, onFeedback }) {
  const [copied, setCopied] = useState(false);
  const [askingWhy, setAskingWhy] = useState(false);
  const [why, setWhy] = useState('');
  const canRate = !isMockSession ? Number.isInteger(message.id) : true;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable - nothing to do
    }
  };

  return (
    <div className="gemma-row">
      <GemmaAvatar size={26} ring={false} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
        <div className="gemma-bubble">
          {message.content ? <Markdown text={message.content} /> : <div className="gemma-typing" aria-label="Gemma is typing"><i /><i /><i /></div>}
          {message.actions?.some((a) => GEMMA_ACTIONS[a] && !(message.wellbeing && a === 'take_a_break')) && (
            <div className="gemma-actions">
              {message.actions.filter((a) => GEMMA_ACTIONS[a] && !(message.wellbeing && a === 'take_a_break')).map((a) => (
                <button key={a} className="gemma-action" onClick={() => (GEMMA_ACTIONS[a].quiz ? onQuiz() : runGemmaAction(a, setActiveTab))}>
                  <ArrowRight size={13} /> {GEMMA_ACTIONS[a].label}
                </button>
              ))}
            </div>
          )}
          {message.wellbeing && <WellbeingCard conversationId={conversationId} isMockSession={isMockSession} setActiveTab={setActiveTab} />}
        </div>
        {message.done && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div className="gemma-sources">
              {message.sources?.length > 0 && <>Based on {message.sources.map((s) => <i key={s}>{SOURCE_LABELS[s] || s}</i>)}</>}
            </div>
            {canRate && (
              <div className="gemma-tools">
                <button onClick={copy} aria-label="Copy reply" title="Copy">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
                <button onClick={() => onFeedback(message, message.feedback === 1 ? 0 : 1)} aria-label="Good reply" aria-pressed={message.feedback === 1} data-on={message.feedback === 1}><ThumbsUp size={13} /></button>
                <button onClick={() => (message.feedback === -1 ? onFeedback(message, 0) : setAskingWhy(true))} aria-label="Bad reply" aria-pressed={message.feedback === -1} data-on={message.feedback === -1}><ThumbsDown size={13} /></button>
              </div>
            )}
          </div>
        )}
        {askingWhy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <textarea className="form-input" rows={2} placeholder="What was off? The team will see this reply and your note. (optional)" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={1000} style={{ fontSize: '0.8rem' }} />
            <div className="gemma-actions">
              <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => { onFeedback(message, -1, why); setAskingWhy(false); }}>Send</button>
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => setAskingWhy(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GemmaChat({ user, isMockSession, activeTab, setActiveTab, variant = 'panel', onClose, weeklyNote, onWeeklyNoteDismissed }) {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(!isMockSession);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');
  const [remaining, setRemaining] = useState(null);
  const [view, setView] = useState('chat');
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const isPage = variant === 'page';
  const firstName = (user?.user_metadata?.full_name || '').trim().split(' ')[0];

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchGemmaConversations()
      .then(async (rows) => {
        if (cancelled) return;
        setConversations(rows);
        const recent = rows[0];
        if (recent && Date.now() - new Date(recent.updatedAt).getTime() < 24 * 3600 * 1000) {
          setConversationId(recent.id);
          const msgs = await fetchGemmaMessages(recent.id);
          if (!cancelled) setMessages(msgs.map((m) => ({ ...m, done: true })));
        }
      })
      .catch((err) => !cancelled && setError(friendlyMemberErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const openConversation = async (id) => {
    setShowHistory(false);
    setView('chat');
    setError(null);
    if (id === null) {
      setConversationId(null);
      setMessages([]);
      inputRef.current?.focus();
      return;
    }
    setConversationId(id);
    setLoading(true);
    try {
      const msgs = await fetchGemmaMessages(id);
      setMessages(msgs.map((m) => ({ ...m, done: true })));
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const archive = async (id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) openConversation(null);
    archiveGemmaConversation(id).catch((err) => setError(friendlyMemberErrorMessage(err)));
  };

  const patchLast = (patch) => setMessages((prev) => {
    const next = [...prev];
    const last = next[next.length - 1];
    next[next.length - 1] = { ...last, ...(typeof patch === 'function' ? patch(last) : patch) };
    return next;
  });

  const send = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    setInput('');
    setError(null);
    setView('chat');
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${prev.length}`, role: 'user', content: trimmed, done: true },
      { id: 'pending', role: 'assistant', content: '', actions: [], sources: [], done: false },
    ]);

    if (isMockSession) {
      const mock = mockGemmaReply(trimmed);
      const words = mock.reply.split(/(\s+)/);
      let i = 0;
      const timer = setInterval(() => {
        i += 3;
        patchLast({ content: words.slice(0, i).join('') });
        if (i >= words.length) {
          clearInterval(timer);
          patchLast({ id: nextLocalId('mock'), content: mock.reply, actions: mock.actions, sources: mock.sources, wellbeing: mock.wellbeing, feedback: 0, done: true });
          setSending(false);
        }
      }, 40);
      return;
    }

    try {
      const done = await streamGemmaMessage({
        message: trimmed,
        conversationId,
        tab: isPage ? 'gemma' : activeTab,
        onMeta: (meta) => {
          setRemaining(meta.remaining);
          if (meta.conversationId && meta.conversationId !== conversationId) {
            setConversationId(meta.conversationId);
            setConversations((prev) => (prev.some((c) => c.id === meta.conversationId)
              ? prev
              : [{ id: meta.conversationId, title: trimmed.slice(0, 60), updatedAt: new Date().toISOString() }, ...prev]));
          }
        },
        onDelta: (chunk) => patchLast((last) => ({ content: last.content + chunk })),
      });
      patchLast({ id: done.messageId ?? nextLocalId('local'), content: done.reply, actions: done.actions || [], sources: done.sources || [], wellbeing: !!done.wellbeing, feedback: 0, done: true });
      setRemaining(done.remaining);
      logPortalEvent('gemma_message_sent', { tab: activeTab || null }).catch(() => {});
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== 'pending'));
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleFeedback = async (message, value, note) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, feedback: value } : m)));
    if (isMockSession || !Number.isInteger(message.id)) return;
    try {
      await setGemmaFeedback(message.id, value, note);
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    }
  };

  const handleDismissNote = () => {
    onWeeklyNoteDismissed?.();
    if (!isMockSession && weeklyNote) dismissWeeklyNote(weeklyNote.weekStart).catch(() => {});
  };

  const showNote = weeklyNote && !weeklyNote.dismissed && messages.length === 0;
  const contextTab = isPage ? null : TAB_LABELS[activeTab];

  const historyList = (
    <div className="gemma-history">
      <button className="gemma-history-item" data-active={conversationId === null} onClick={() => openConversation(null)}><Plus size={14} /> New chat</button>
      {conversations.map((c) => (
        <div key={c.id} className="gemma-history-item" data-active={c.id === conversationId}>
          <button onClick={() => openConversation(c.id)} title={c.title}>{c.title}</button>
          <button onClick={() => archive(c.id)} aria-label={`Delete chat: ${c.title}`} className="gemma-history-del"><Trash2 size={12} /></button>
        </div>
      ))}
      {conversations.length === 0 && !isMockSession && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '6px 10px' }}>No earlier chats yet.</p>}
    </div>
  );

  return (
    <div className={`gemma-shell gemma-shell-${variant}`}>
      {isPage && <aside className="gemma-side">{historyList}</aside>}

      <div className="gemma-main">
        <div className="gemma-head">
          <GemmaAvatar size={38} online />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Gemma</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Your cyber bestie</div>
          </div>
          {!isPage && (
            <>
              <button className="gemma-icon-btn" onClick={() => openConversation(null)} aria-label="New chat" title="New chat"><Plus size={16} /></button>
              <button className="gemma-icon-btn" onClick={() => setShowHistory((s) => !s)} aria-label="Earlier chats" title="Earlier chats" data-on={showHistory}><History size={16} /></button>
              <button className="gemma-icon-btn" onClick={() => { setActiveTab?.('gemma'); onClose?.(); }} aria-label="Open full page" title="Open full page"><Maximize2 size={15} /></button>
              <button className="gemma-icon-btn" onClick={onClose} aria-label="Close Gemma" title="Close"><X size={16} /></button>
            </>
          )}
        </div>

        {!isPage && showHistory && <div className="gemma-history-pop">{historyList}</div>}

        {view === 'quiz' ? (
          <GemmaQuiz isMockSession={isMockSession} onExit={() => setView('chat')} />
        ) : (
          <div ref={scrollRef} className="gemma-scroll">
            {loading && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading your chats...</p>}

            {!loading && messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>Heyy{firstName ? ` ${firstName}` : ''}.</div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>I can see your roadmap, Hub Score, streak and exams. Ask me anything, or start here:</div>
                </div>

                {showNote && (
                  <div className="gemma-note">
                    <div className="gemma-note-when">Gemma's note this week</div>
                    <strong>{weeklyNote.headline}</strong>
                    <span>{weeklyNote.body}</span>
                    <div className="gemma-actions">
                      {weeklyNote.action && GEMMA_ACTIONS[weeklyNote.action] && (
                        <button className="gemma-action" onClick={() => (GEMMA_ACTIONS[weeklyNote.action].quiz ? setView('quiz') : runGemmaAction(weeklyNote.action, setActiveTab))}>
                          <ArrowRight size={13} /> {GEMMA_ACTIONS[weeklyNote.action].label}
                        </button>
                      )}
                      <button className="gemma-action gemma-action-quiet" onClick={handleDismissNote}>Got it</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gap: '6px' }}>
                  {promptsForTab(isPage ? 'dashboard' : activeTab).map((p) => (
                    <button key={p} className="gemma-prompt" onClick={() => send(p)}><Sparkles size={14} /> {p}</button>
                  ))}
                  <button className="gemma-prompt" onClick={() => setView('quiz')}><Sparkles size={14} /> Quiz me</button>
                  {isPage && (
                    <>
                      <button className="gemma-prompt" onClick={() => runGemmaAction('cv_review', setActiveTab)}><Sparkles size={14} /> Review my CV</button>
                      <button className="gemma-prompt" onClick={() => runGemmaAction('interview_prep', setActiveTab)}><Sparkles size={14} /> Practice an interview</button>
                    </>
                  )}
                </div>
                {contextTab && <div className="gemma-context"><Eye size={12} /> Looking at: {contextTab}</div>}
              </div>
            )}

            {messages.map((m) => (m.role === 'user' ? (
              <div key={m.id} className="gemma-user">{m.content}</div>
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                conversationId={conversationId}
                isMockSession={isMockSession}
                setActiveTab={setActiveTab}
                onQuiz={() => setView('quiz')}
                onFeedback={handleFeedback}
              />
            )))}

            {error && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontSize: '0.8rem' }}><AlertCircle size={14} /> {error}</div>}
          </div>
        )}

        {view === 'chat' && (
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="gemma-input">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message Gemma..."
              className="form-input"
              disabled={sending}
              maxLength={4000}
              aria-label="Message Gemma"
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()} aria-label="Send"><Send size={16} /></button>
          </form>
        )}
        <div className="gemma-foot">
          {remaining !== null && remaining <= LOW_MESSAGES_WARNING && <strong>{remaining} messages left today · </strong>}
          Gemma can get things wrong. Your chats stay private: the team only sees replies you rate down or chats you send to a person.
        </div>
      </div>
    </div>
  );
}
