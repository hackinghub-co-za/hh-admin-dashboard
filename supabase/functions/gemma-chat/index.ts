// Hacking Hub - Gemma chat (streaming)
//
// Deploy with: supabase functions deploy gemma-chat
// Needs the GEMINI_API_KEY secret (already set for the other Gemma functions).
//
// The Gemini key never reaches the browser: this function checks the
// caller's JWT, builds Gemma's context server-side (persona, editable
// knowledge base, a progress snapshot from real data), streams the reply
// back as NDJSON, and stores both messages.
//
// Response: application/x-ndjson, one JSON object per line:
//   {"t":"meta","conversationId":1,"remaining":38}
//   {"t":"delta","text":"..."}            (repeated)
//   {"t":"done","messageId":2,"reply":"...","actions":[],"sources":[],"topic":"...","wellbeing":false,"remaining":38}
//   {"t":"error","error":"..."}           (instead of done, if Gemini fails)

import { corsHeaders, json, authenticate, PERSONA, loadKnowledge, loadSnapshot, streamGemini, ACTION_KEYS, SOURCE_KEYS, TOPIC_KEYS } from '../_shared/gemma.ts';

const MAX_MESSAGE_LENGTH = 4000;
const DAILY_MESSAGE_CAP = 40;
const HISTORY_WINDOW = 12;
const META_MARKER = '<<meta';
const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', roadmap: 'My Roadmap', matchmaker: 'Matchmaker', members: 'Members', meetings: '1on1 Meetings',
  events: 'Events', jobs: 'Job Board', resources: 'Resources', labs: 'Labs', breakdowns: 'Breakdowns', certs: 'Cert Calendar',
  competitions: 'Competitions', reviews: 'Reviews', billing: 'My Subscription', gemma: 'Gemma (full page)',
};

function systemPrompt(knowledge: string, snapshot: unknown, tab: string | null) {
  return `${PERSONA}

Buttons and tags: end EVERY reply with one final line in exactly this format, and nothing after it:
<<meta {"actions":[...],"sources":[...],"topic":"...","wellbeing":false}>>
- actions: up to 2 places that would genuinely help next, from: ${ACTION_KEYS.join(', ')}. Use [] if none fits. "quiz" opens a practice quiz; "log_rooms" opens the TryHackMe room log; "take_a_break" opens Take a Break.
- sources: which snapshot parts or the knowledge base you actually used, from: ${SOURCE_KEYS.join(', ')}.
- topic: one of ${TOPIC_KEYS.join(', ')}.
- wellbeing: true only if the member sounds stressed, overwhelmed, burnt out or like they want to give up. When true, mention gently that Take a Break exists and that you can get someone from the team to check in; the app shows those buttons.

KNOWLEDGE BASE:
${knowledge || '(empty)'}

MEMBER SNAPSHOT (live data, JSON; "today" is in South African time):
${JSON.stringify(snapshot ?? { note: 'No profile data yet.' })}

${tab && TAB_LABELS[tab] ? `The member is currently looking at the ${TAB_LABELS[tab]} tab.` : ''}`;
}

function parseMeta(full: string) {
  const idx = full.indexOf(META_MARKER);
  const reply = (idx >= 0 ? full.slice(0, idx) : full).trim();
  let actions: string[] = [];
  let sources: string[] = [];
  let topic = 'other';
  let wellbeing = false;
  if (idx >= 0) {
    const match = full.slice(idx).match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const meta = JSON.parse(match[0]);
        actions = Array.isArray(meta.actions) ? [...new Set(meta.actions.filter((a: string) => ACTION_KEYS.includes(a)))].slice(0, 2) as string[] : [];
        sources = Array.isArray(meta.sources) ? [...new Set(meta.sources.filter((s: string) => SOURCE_KEYS.includes(s)))] as string[] : [];
        topic = TOPIC_KEYS.includes(meta.topic) ? meta.topic : 'other';
        wellbeing = meta.wellbeing === true;
      } catch {
        // malformed meta - keep defaults
      }
    }
  }
  return { reply, actions, sources, topic, wellbeing };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const caller = await authenticate(req);
    if (caller instanceof Response) return caller;
    const { email, admin, geminiKey } = caller;

    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const tab = typeof body.tab === 'string' ? body.tab : null;
    let conversationId = Number.isInteger(body.conversationId) ? body.conversationId : null;
    if (!message || message.length > MAX_MESSAGE_LENGTH) return json({ error: 'Message is empty or too long.' }, 400);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await admin
      .from('gemma_messages')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('role', 'user')
      .gte('created_at', startOfDay.toISOString());
    const usedToday = todayCount || 0;

    const encoder = new TextEncoder();
    const send = (controller: ReadableStreamDefaultController, obj: unknown) =>
      controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
    const ndjsonHeaders = { ...corsHeaders, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' };

    if (usedToday >= DAILY_MESSAGE_CAP) {
      const reply = "Eish, we've hit our 40 messages for today, babe. My brain needs a rest too. Come back tomorrow and I'm all yours.";
      if (body.stream !== true) return json({ reply });
      return new Response(new ReadableStream({
        start(controller) {
          send(controller, { t: 'meta', conversationId, remaining: 0 });
          send(controller, { t: 'done', messageId: null, reply, actions: [], sources: [], topic: 'other', wellbeing: false, remaining: 0 });
          controller.close();
        },
      }), { headers: ndjsonHeaders });
    }

    if (conversationId) {
      const { data: conv } = await admin.from('gemma_conversations').select('id').eq('id', conversationId).eq('email', email).maybeSingle();
      if (!conv) conversationId = null;
    }
    if (!conversationId) {
      const title = message.replace(/\s+/g, ' ').slice(0, 60) + (message.length > 60 ? '...' : '');
      const { data: created, error: convError } = await admin.from('gemma_conversations').insert({ email, title }).select('id').single();
      if (convError) throw convError;
      conversationId = created.id;
    }

    const [knowledge, snapshot, historyRes] = await Promise.all([
      loadKnowledge(admin),
      loadSnapshot(admin, email),
      admin.from('gemma_messages').select('role, content').eq('conversation_id', conversationId)
        .order('created_at', { ascending: false }).limit(HISTORY_WINDOW),
    ]);
    const history = (historyRes.data || []).reverse();

    await admin.from('gemma_messages').insert({ email, role: 'user', content: message, conversation_id: conversationId });
    const remaining = DAILY_MESSAGE_CAP - usedToday - 1;

    const contents = [
      ...history.map((m) => ({ role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user', parts: [{ text: m.content }] })),
      { role: 'user' as const, parts: [{ text: message }] },
    ];

    const stream = new ReadableStream({
      async start(controller) {
        send(controller, { t: 'meta', conversationId, remaining });
        let full = '';
        let sent = 0;
        try {
          for await (const chunk of streamGemini(geminiKey, systemPrompt(knowledge, snapshot, tab), contents)) {
            full += chunk;
            // Never forward the trailing meta line: hold back anything from
            // the marker on, plus a few chars that could be its start.
            const markerAt = full.indexOf(META_MARKER);
            const safeEnd = markerAt >= 0 ? markerAt : Math.max(sent, full.length - META_MARKER.length);
            if (safeEnd > sent) {
              send(controller, { t: 'delta', text: full.slice(sent, safeEnd) });
              sent = safeEnd;
            }
          }
          const parsed = parseMeta(full);
          const reply = parsed.reply || "Hmm, I lost my train of thought there. Try asking me again?";
          const { data: saved } = await admin.from('gemma_messages').insert({
            email, role: 'assistant', content: reply, conversation_id: conversationId,
            topic: parsed.topic, actions: parsed.actions, sources: parsed.sources, wellbeing: parsed.wellbeing,
          }).select('id').single();
          await admin.from('gemma_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
          send(controller, { t: 'done', messageId: saved?.id ?? null, reply, actions: parsed.actions, sources: parsed.sources, topic: parsed.topic, wellbeing: parsed.wellbeing, remaining });
        } catch (err) {
          console.error('gemma-chat stream error', err);
          send(controller, { t: 'error', error: 'Gemma had trouble thinking that through. Try again in a moment.' });
        } finally {
          controller.close();
        }
      },
    });

    if (body.stream === true) return new Response(stream, { headers: ndjsonHeaders });

    // Older clients expect a single { reply } JSON body.
    const lines = (await new Response(stream).text()).trim().split('\n').map((l) => JSON.parse(l));
    const done = lines.find((l) => l.t === 'done');
    return done ? json({ reply: done.reply }) : json({ error: lines.find((l) => l.t === 'error')?.error || 'Something went wrong.' }, 502);
  } catch (err) {
    console.error('gemma-chat error:', err);
    return json({ error: 'Something went wrong.' }, 500);
  }
});
