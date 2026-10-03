// Client-side interface to Gemma (supabase/functions/gemma-chat, gemma-tools,
// supabase/100_gemma_upgrade.sql). Only called for real sessions - Mock
// Member gets local demo behaviour inside the Gemma components instead.

import { supabase } from './supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1`;

// ---- Conversations -------------------------------------------------------

export async function fetchGemmaConversations() {
  const { data, error } = await supabase
    .from('gemma_conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
}

export async function fetchGemmaMessages(conversationId) {
  const { data, error } = await supabase
    .from('gemma_messages')
    .select('id, role, content, created_at, feedback, actions, sources, wellbeing')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map((m) => ({
    id: m.id, role: m.role, content: m.content, createdAt: m.created_at,
    feedback: m.feedback || 0, actions: m.actions || [], sources: m.sources || [], wellbeing: !!m.wellbeing,
  }));
}

export async function archiveGemmaConversation(conversationId) {
  const { error } = await supabase.rpc('archive_my_gemma_conversation', { p_conversation_id: conversationId });
  if (error) throw error;
}

/**
 * Sends a message and streams Gemma's reply. Calls onMeta({conversationId,
 * remaining}) first, onDelta(text) for each chunk, and resolves with the
 * final {messageId, reply, actions, sources, topic, wellbeing, remaining}.
 */
export async function streamGemmaMessage({ message, conversationId, tab, onMeta, onDelta }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Your session has expired. Sign in again.');
  const res = await fetch(`${FUNCTIONS_URL}/gemma-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify({ message, conversationId: conversationId || null, tab: tab || null, stream: true }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Gemma is unavailable right now.');
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let done = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += value;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const evt = JSON.parse(line);
      if (evt.t === 'meta') onMeta?.(evt);
      else if (evt.t === 'delta') onDelta?.(evt.text);
      else if (evt.t === 'done') done = evt;
      else if (evt.t === 'error') throw new Error(evt.error);
    }
  }
  if (!done) throw new Error('Gemma stopped mid-sentence. Try again.');
  return done;
}

export async function setGemmaFeedback(messageId, value, note) {
  const { error } = await supabase.rpc('set_my_gemma_feedback', { p_message_id: messageId, p_value: value, p_note: note || null });
  if (error) throw error;
}

export async function requestGemmaHandoff(conversationId, note) {
  const { error } = await supabase.rpc('request_gemma_handoff', { p_conversation_id: conversationId || null, p_note: note || null });
  if (error) throw error;
}

// ---- Tools ---------------------------------------------------------------

async function invokeTools(body) {
  const { data, error } = await supabase.functions.invoke('gemma-tools', { body });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

let weeklyNotePromise = null;
/** This week's note (generated on first request each week). Shared between
 * the Dashboard card and the launcher badge so it's only fetched once. */
export function fetchWeeklyNote() {
  if (!weeklyNotePromise) {
    weeklyNotePromise = invokeTools({ action: 'weekly_note' })
      .then((d) => (d.note ? {
        weekStart: d.note.week_start, headline: d.note.headline, body: d.note.body,
        action: d.note.action, dismissed: !!d.note.dismissed_at,
      } : null))
      .catch((err) => { weeklyNotePromise = null; throw err; });
  }
  return weeklyNotePromise;
}

export async function dismissWeeklyNote(weekStart) {
  const { error } = await supabase.rpc('dismiss_my_gemma_note', { p_week_start: weekStart });
  if (error) throw error;
  weeklyNotePromise = weeklyNotePromise?.then((n) => (n ? { ...n, dismissed: true } : n)) || null;
}

export async function fetchMyLabHelp(labSlug) {
  const { data, error } = await supabase
    .from('gemma_lab_help')
    .select('task_key, kind, content, created_at')
    .eq('lab_slug', labSlug)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((h) => ({ taskKey: h.task_key, kind: h.kind, content: h.content }));
}

export function requestLabHint(labSlug, taskKey, context) {
  return invokeTools({ action: 'lab_hint', labSlug, taskKey, context });
}

export function requestLabExplain(labSlug, taskKey, context) {
  return invokeTools({ action: 'lab_explain', labSlug, taskKey, context });
}

export function generateGemmaQuiz(topic) {
  return invokeTools({ action: 'quiz', topic: topic || null });
}

export async function recordGemmaQuiz(topic, score, total) {
  const { error } = await supabase.rpc('record_my_gemma_quiz', { p_topic: topic, p_score: score, p_total: total });
  if (error) throw error;
}

// ---- Staff ---------------------------------------------------------------

export async function fetchGemmaOverview(days = 30) {
  const { data, error } = await supabase.rpc('get_gemma_admin_overview', { p_days: days });
  if (error) throw error;
  return data;
}

export async function fetchGemmaRatedDown() {
  const { data, error } = await supabase.rpc('get_gemma_rated_down', { p_limit: 50 });
  if (error) throw error;
  return data || [];
}

export async function fetchOpenGemmaHandoffs() {
  const { data, error } = await supabase.rpc('get_open_gemma_handoffs');
  if (error) throw error;
  return data || [];
}

export async function markGemmaHandoffHandled(id) {
  const { error } = await supabase.rpc('mark_gemma_handoff_handled', { p_handoff_id: id });
  if (error) throw error;
}

export async function fetchGemmaHandoffConversation(id) {
  const { data, error } = await supabase.rpc('get_gemma_handoff_conversation', { p_handoff_id: id });
  if (error) throw error;
  return data || [];
}

export async function fetchGemmaKnowledge() {
  const { data, error } = await supabase.from('gemma_knowledge').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveGemmaKnowledge(row, editorEmail) {
  const payload = {
    title: row.title.trim(),
    body: row.body.trim(),
    is_active: row.is_active,
    sort_order: Number(row.sort_order) || 0,
    updated_by: editorEmail || null,
    updated_at: new Date().toISOString(),
  };
  if (row.id) {
    const { error } = await supabase.from('gemma_knowledge').update(payload).eq('id', row.id);
    if (error) throw error;
    return;
  }
  const slug = `${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36)}`;
  const { error } = await supabase.from('gemma_knowledge').insert({ ...payload, slug });
  if (error) throw error;
}
