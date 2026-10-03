import { useState, useEffect } from 'react';
import { MessageCircleHeart, ThumbsDown, UserRound, BookOpen, Plus, Check, Eye, EyeOff } from 'lucide-react';
import {
  fetchGemmaOverview, fetchGemmaRatedDown, fetchOpenGemmaHandoffs, markGemmaHandoffHandled,
  fetchGemmaHandoffConversation, fetchGemmaKnowledge, saveGemmaKnowledge,
} from '../lib/gemmaData';
import { formatDate } from '../lib/dateFormat';
import { friendlyErrorMessage } from '../lib/errorMessages';

// Gemma admin (supabase/100_gemma_upgrade.sql). Privacy model: admins see
// counts, topics, replies a member rated down, and chats a member sent to a
// person. There is no screen for browsing everyone's conversations.
// Community managers only get the "talk to a person" requests.

const TOPIC_LABELS = {
  progress: 'Progress', roadmap: 'Roadmap', certs: 'Certs', labs: 'Labs', hub_score: 'Hub Score', jobs: 'Jobs',
  cv_interview: 'CV and interviews', study_tips: 'Study tips', events: 'Events', mentoring: 'Mentoring',
  billing: 'Billing', wellbeing: 'Wellbeing', platform_help: 'Platform help', small_talk: 'Small talk', other: 'Other',
};

const MOCK_OVERVIEW = {
  messages: 412, members: 38, thumbs_up: 61, thumbs_down: 7, hints: 54, explains: 19, quizzes: 33, weekly_notes: 96, open_handoffs: 1,
  per_day: Array.from({ length: 14 }, (_, i) => ({ day: `2026-09-${String(20 + i).padStart(2, '0')}`, count: [9, 14, 11, 6, 3, 12, 18, 15, 13, 10, 7, 16, 21, 12][i] })),
  topics: [{ topic: 'progress', count: 96 }, { topic: 'certs', count: 71 }, { topic: 'labs', count: 58 }, { topic: 'cv_interview', count: 44 }, { topic: 'roadmap', count: 39 }, { topic: 'wellbeing', count: 8 }],
};
const MOCK_HANDOFFS = [{ id: 1, email: 'naledi@example.com', full_name: 'Naledi Mokoena', note: "Work has been brutal and I've fallen behind on everything.", created_at: '2026-10-02T18:30:00Z' }];
const MOCK_RATED = [{ id: 11, full_name: 'Thabo Nkosi', question: 'is the OSCP worth it?', reply: 'Yoh, depends on your goals...', feedback_note: 'Too vague, I wanted a yes or no.', feedback_at: '2026-10-01T10:00:00Z', topic: 'certs' }];
const MOCK_KNOWLEDGE = [{ id: 1, slug: 'labs', title: 'Labs', body: 'The Labs tab has Hub Labs and curated labs...', sort_order: 40, is_active: true }];

function Stat({ label, value, sub }) {
  return (
    <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <strong style={{ fontSize: '1.5rem', fontFamily: 'var(--font-mono)' }}>{value}</strong>
      {sub && <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{sub}</span>}
    </div>
  );
}

function PerDayBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div role="img" aria-label="Messages per day" style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '90px' }}>
      {rows.map((r) => (
        <div key={r.day} title={`${r.day}: ${r.count}`} style={{ flex: 1, minWidth: 4, height: `${Math.max(4, (r.count / max) * 100)}%`, background: 'var(--accent-cyan)', opacity: 0.85, borderRadius: '3px 3px 0 0' }} />
      ))}
    </div>
  );
}

function KnowledgeEditor({ rows, isMockSession, user, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!editing.title.trim() || !editing.body.trim()) { setError('Add a title and some text.'); return; }
    setSaving(true);
    setError(null);
    try {
      if (!isMockSession) await saveGemmaKnowledge(editing, user?.email);
      onChanged(editing);
      setEditing(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row) => {
    const next = { ...row, is_active: !row.is_active };
    onChanged(next);
    if (!isMockSession) saveGemmaKnowledge(next, user?.email).catch((err) => setError(friendlyErrorMessage(err)));
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={18} /> What Gemma knows about Hacking Hub</h3>
        {!editing && <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => setEditing({ title: '', body: '', sort_order: (rows.length + 1) * 10, is_active: true })}><Plus size={14} /> Add entry</button>}
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>Gemma reads every active entry before each reply. When a feature ships or something changes, edit it here. No code change needed. Never put prices, balances or personal details in here.</p>
      {error && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '8px' }}>{error}</p>}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', marginBottom: '14px' }}>
          <input className="form-input" aria-label="Title" placeholder="Title, e.g. Events" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          <textarea className="form-input" aria-label="What Gemma should know" rows={5} maxLength={2000} placeholder="Plain facts only." value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={saving} onClick={save} style={{ fontSize: '0.8rem' }}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn btn-secondary" onClick={() => { setEditing(null); setError(null); }} style={{ fontSize: '0.8rem' }}>Cancel</button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{editing.body.length}/2000</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((row) => (
          <div key={row.id} style={{ padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', opacity: row.is_active ? 1 : 0.55, display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{row.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{row.body}</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button className="btn btn-secondary" style={{ fontSize: '0.74rem', padding: '5px 10px' }} onClick={() => setEditing(row)}>Edit</button>
              <button className="btn btn-secondary" style={{ fontSize: '0.74rem', padding: '5px 10px' }} onClick={() => toggle(row)} aria-label={row.is_active ? 'Hide from Gemma' : 'Show to Gemma'}>{row.is_active ? <EyeOff size={13} /> : <Eye size={13} />}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GemmaAdmin({ isMockSession, user, isAdmin }) {
  const [overview, setOverview] = useState(isMockSession ? MOCK_OVERVIEW : null);
  const [handoffs, setHandoffs] = useState(isMockSession ? MOCK_HANDOFFS : []);
  const [rated, setRated] = useState(isMockSession ? MOCK_RATED : []);
  const [knowledge, setKnowledge] = useState(isMockSession ? MOCK_KNOWLEDGE : []);
  const [openChat, setOpenChat] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    const loads = [fetchOpenGemmaHandoffs().then(setHandoffs)];
    if (isAdmin) loads.push(fetchGemmaOverview(30).then(setOverview), fetchGemmaRatedDown().then(setRated), fetchGemmaKnowledge().then(setKnowledge));
    Promise.all(loads).catch((err) => setError(friendlyErrorMessage(err)));
  }, [isMockSession, isAdmin]);

  const handle = async (id) => {
    setHandoffs((prev) => prev.filter((h) => h.id !== id));
    if (isMockSession) return;
    try { await markGemmaHandoffHandled(id); } catch (err) { setError(friendlyErrorMessage(err)); }
  };

  const viewChat = async (h) => {
    if (openChat?.id === h.id) { setOpenChat(null); return; }
    if (isMockSession) {
      setOpenChat({ id: h.id, messages: [{ role: 'user', content: "I'm just so tired. Work, studying, everything." }, { role: 'assistant', content: 'That sounds like a lot, and it makes sense. Want me to get someone from the team to check in on you?' }] });
      return;
    }
    try { setOpenChat({ id: h.id, messages: await fetchGemmaHandoffConversation(h.id) }); } catch (err) { setError(friendlyErrorMessage(err)); }
  };

  const changeKnowledge = (row) => {
    if (!isMockSession) {
      fetchGemmaKnowledge().then(setKnowledge).catch(() => {});
      return;
    }
    setKnowledge((prev) => (row.id ? prev.map((k) => (k.id === row.id ? { ...k, ...row } : k)) : [...prev, { ...row, id: prev.length + 100 }]));
  };

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}><MessageCircleHeart size={28} color="var(--accent-cyan)" /> Gemma</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{isAdmin
          ? "How members are using Gemma. Chats are private: you see counts and topics, replies a member rated down, and conversations a member chose to send to a person."
          : 'Members who asked Gemma to get a real person to check in.'}</p>
      </div>
      {isMockSession && <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>Mock session: example data, nothing is saved.</div>}
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

      <div className="glass-card" style={{ marginBottom: '24px', border: handoffs.length ? '1px solid var(--warning)' : undefined }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><UserRound size={18} /> Asked for a person ({handoffs.length})</h3>
        {handoffs.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nobody waiting. These members were added to Accountability Check-ins when they asked.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {handoffs.map((h) => (
              <div key={h.id} style={{ padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{h.full_name || h.email}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>asked {formatDate(h.created_at)}</div>
                    {h.note && <p style={{ fontSize: '0.84rem', marginTop: '6px', overflowWrap: 'anywhere' }}>"{h.note}"</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    {isAdmin && <button className="btn btn-secondary" style={{ fontSize: '0.76rem', padding: '6px 12px' }} onClick={() => viewChat(h)}>{openChat?.id === h.id ? 'Hide chat' : 'Read chat'}</button>}
                    <button className="btn btn-primary" style={{ fontSize: '0.76rem', padding: '6px 12px' }} onClick={() => handle(h.id)}><Check size={13} /> Handled</button>
                  </div>
                </div>
                {openChat?.id === h.id && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                    {openChat.messages.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No conversation attached.</span>}
                    {openChat.messages.map((m, i) => (
                      <div key={i} style={{ padding: '7px 10px', borderRadius: 8, background: m.role === 'user' ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--bg-tertiary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>{m.role === 'user' ? 'Member' : 'Gemma'}:</strong> {m.content}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          {overview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <Stat label="Messages · 30d" value={overview.messages} sub={`${overview.members} members`} />
                <Stat label="Liked" value={overview.thumbs_up} />
                <Stat label="Rated down" value={overview.thumbs_down} />
                <Stat label="Lab hints" value={overview.hints} sub={`${overview.explains} explanations`} />
                <Stat label="Quizzes" value={overview.quizzes} />
                <Stat label="Weekly notes" value={overview.weekly_notes} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div className="glass-card"><h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Messages per day</h3>{overview.per_day.length ? <PerDayBars rows={overview.per_day} /> : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing yet.</p>}</div>
                <div className="glass-card">
                  <h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>What members ask about</h3>
                  {overview.topics.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing yet.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {overview.topics.map((t) => (
                        <div key={t.topic} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 36px', gap: '8px', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span>{TOPIC_LABELS[t.topic] || t.topic}</span>
                          <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${(t.count / overview.topics[0].count) * 100}%`, height: '100%', background: t.topic === 'wellbeing' ? 'var(--warning)' : 'var(--accent-cyan)' }} /></div>
                          <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{t.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="glass-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><ThumbsDown size={18} /> Replies members rated down ({rated.length})</h3>
            {rated.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None yet. When one comes in, fix the knowledge entry or tell me what to change in her prompt.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rated.map((r) => (
                  <div key={r.id} style={{ padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.84rem' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.full_name || r.email} · {formatDate(r.feedback_at)}{r.topic ? ` · ${TOPIC_LABELS[r.topic] || r.topic}` : ''}</div>
                    {r.question && <div><strong>Asked:</strong> {r.question}</div>}
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>Gemma:</strong> {r.reply}</div>
                    {r.feedback_note && <div style={{ color: 'var(--warning)' }}><strong>Member said:</strong> {r.feedback_note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <KnowledgeEditor rows={knowledge} isMockSession={isMockSession} user={user} onChanged={changeKnowledge} />
        </>
      )}
    </div>
  );
}
