// Hacking Hub - Gemma tools: weekly note, lab hints, lab explanations, quizzes
//
// Deploy with: supabase functions deploy gemma-tools
// Reuses the GEMINI_API_KEY secret. One function, switched on body.action.
//
// Lab help never reads correct answers for a hint: hints are built only
// from material the member can already see (brief, evidence, task), sent
// by the client. Explanations read the answer key only after the member's
// own attempt is submitted, when the debrief is already open to them.

import { corsHeaders, json, authenticate, PERSONA, loadKnowledge, loadSnapshot, callGemini, sastToday, sastWeekStart, ACTION_KEYS } from '../_shared/gemma.ts';

const HINTS_PER_LAB = 3;
const EXPLAINS_PER_LAB = 5;
const QUIZZES_PER_DAY = 5;
const MAX_CONTEXT = 20000;

const NOTE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING', description: 'One short punchy line, under 70 characters.' },
    body: { type: 'STRING', description: 'Two or three sentences: one specific win or observation, one concrete thing to do this week.' },
    action: { type: 'STRING', enum: [...ACTION_KEYS, 'none'] },
  },
  required: ['headline', 'body', 'action'],
};

const QUIZ_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topic: { type: 'STRING' },
    questions: {
      type: 'ARRAY',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', minItems: 4, maxItems: 4, items: { type: 'STRING' } },
          answer_index: { type: 'INTEGER', description: '0-based index of the correct option.' },
          why: { type: 'STRING', description: 'One or two sentences on why that answer is right, in Gemma\'s voice.' },
        },
        required: ['question', 'options', 'answer_index', 'why'],
      },
    },
  },
  required: ['topic', 'questions'],
};

const clip = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value ?? '')).slice(0, MAX_CONTEXT);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const caller = await authenticate(req);
    if (caller instanceof Response) return caller;
    const { email, admin, geminiKey } = caller;
    const body = await req.json().catch(() => ({}));

    // ------------------------------------------------------------ weekly note
    if (body.action === 'weekly_note') {
      const weekStart = sastWeekStart();
      const existing = await admin.from('gemma_weekly_notes').select('*').eq('email', email).eq('week_start', weekStart).maybeSingle();
      if (existing.data) return json({ note: existing.data });

      const snapshot = await loadSnapshot(admin, email);
      if (!snapshot || !(snapshot as { profile?: unknown }).profile) return json({ note: null });

      const result = await callGemini(geminiKey, `${PERSONA}

Write this member's weekly note for the week starting ${weekStart}. It appears as a card on their Dashboard. Use ONLY the snapshot. Pick the single most useful thing: a real win to celebrate and the one next step that matters most this week. If they're on a break, keep it gentle and don't push. "action" is the one button that helps most, or "none".

MEMBER SNAPSHOT:
${JSON.stringify(snapshot)}`, [{ role: 'user', parts: [{ text: 'Write my weekly note.' }] }], NOTE_SCHEMA);

      const action = ACTION_KEYS.includes(result.action) ? result.action : null;
      await admin.from('gemma_weekly_notes').upsert({
        email, week_start: weekStart,
        headline: String(result.headline || '').slice(0, 120),
        body: String(result.body || '').slice(0, 600),
        action,
      }, { onConflict: 'email,week_start', ignoreDuplicates: true });
      const saved = await admin.from('gemma_weekly_notes').select('*').eq('email', email).eq('week_start', weekStart).maybeSingle();
      return json({ note: saved.data });
    }

    // --------------------------------------------------- lab hint / explain
    if (body.action === 'lab_hint' || body.action === 'lab_explain') {
      const isHint = body.action === 'lab_hint';
      const labSlug = typeof body.labSlug === 'string' ? body.labSlug : '';
      const taskKey = typeof body.taskKey === 'string' ? body.taskKey : '';
      const context = body.context || {};

      const { data: lab } = await admin.from('labs').select('id, title').eq('slug', labSlug).eq('kind', 'hub').eq('is_published', true).maybeSingle();
      if (!lab) return json({ error: 'That lab is not available.' }, 400);

      const { data: key } = await admin.from('lab_answer_keys').select('grading, answer, model_answer').eq('lab_id', lab.id).eq('task_key', taskKey).maybeSingle();
      if (!key || key.grading === 'rubric') return json({ error: 'Gemma can only help with the marked tasks.' }, 400);

      const { data: attempt } = await admin.from('lab_attempts').select('status, answers, task_results').eq('lab_id', lab.id).eq('member_email', email).maybeSingle();
      const submitted = !!attempt && ['Submitted', 'Approved', 'Needs Changes'].includes(attempt.status) && !!attempt.task_results;
      if (isHint && submitted) return json({ error: 'Hints close once a lab is submitted. Ask me to explain instead.' }, 400);
      if (!isHint && !submitted) return json({ error: 'Submit the lab first, then I can explain the answers.' }, 400);

      const { count: used } = await admin.from('gemma_lab_help').select('id', { count: 'exact', head: true })
        .eq('email', email).eq('lab_slug', labSlug).eq('kind', isHint ? 'hint' : 'explain');
      const cap = isHint ? HINTS_PER_LAB : EXPLAINS_PER_LAB;
      if ((used || 0) >= cap) return json({ error: isHint ? "That's all three hints for this lab, babe. You've got this." : 'That is all the explanations for this lab.' }, 400);

      let system: string;
      let previousHints = '';
      if (isHint) {
        const { data: prior } = await admin.from('gemma_lab_help').select('content').eq('email', email).eq('lab_slug', labSlug).eq('task_key', taskKey).eq('kind', 'hint');
        previousHints = (prior || []).map((p) => `- ${p.content}`).join('\n');
        system = `${PERSONA}

You are giving ONE hint for a task in a Hacking Hub lab ("${lab.title}"). You do NOT know the correct answer and must not guess it out loud.
- Point the member to the evidence document and the detail worth re-reading, or the concept to think about.
- Never state, rank or eliminate specific options, and never say which option is right or wrong.
- Two or three sentences. A little sass is fine; this is a game, not a crisis.
- If previous hints exist, go one step further than them without giving the answer.

LAB MATERIAL (from the member's screen):
Brief: ${clip(context.brief)}
Evidence: ${clip(context.evidence)}
Task: ${clip(context.task)}

PREVIOUS HINTS FOR THIS TASK:
${previousHints || '(none)'}`;
      } else {
        system = `${PERSONA}

The member has submitted a Hacking Hub lab ("${lab.title}") and wants to understand one marked task. They can already see the correct answer and model explanation in their debrief.
- Explain why the correct answer is right and, if they got it wrong, what in the evidence should have pointed them there. Be specific to their answer.
- Three to five sentences. Encouraging; light sass only if they got it right.

Task: ${clip(context.task)}
Evidence: ${clip(context.evidence)}
Correct answer (ids refer to the task's options): ${JSON.stringify(key.answer)}
Official explanation: ${key.model_answer || ''}
Member's answer: ${JSON.stringify(attempt?.answers?.[taskKey] ?? null)}
Points earned: ${JSON.stringify(attempt?.task_results?.[taskKey] ?? null)}`;
      }

      const text = await callGemini(geminiKey, system, [{ role: 'user', parts: [{ text: isHint ? 'Give me a hint.' : 'Explain this one to me.' }] }]);
      const content = String(text || '').slice(0, 2000);
      await admin.from('gemma_lab_help').insert({ email, lab_slug: labSlug, task_key: taskKey, kind: isHint ? 'hint' : 'explain', content });
      return json({ content, remaining: cap - (used || 0) - 1 });
    }

    // ------------------------------------------------------------------ quiz
    if (body.action === 'quiz') {
      const today = sastToday();
      const { count: quizzesToday } = await admin.from('portal_events').select('id', { count: 'exact', head: true })
        .eq('email', email).eq('event_type', 'gemma_quiz_generated').gte('created_at', `${today}T00:00:00+02:00`);
      if ((quizzesToday || 0) >= QUIZZES_PER_DAY) return json({ error: "Five quizzes today? Yoh, I'm impressed. That's the daily max though. Rest that brain." }, 429);

      const snapshot = await loadSnapshot(admin, email);
      const requested = typeof body.topic === 'string' ? body.topic.trim().slice(0, 120) : '';
      const knowledge = requested ? '' : await loadKnowledge(admin);
      const result = await callGemini(geminiKey, `${PERSONA}

Write a 5-question multiple-choice practice quiz. Each question has exactly 4 options and one correct answer. Make them accurate, exam-style and genuinely useful; vary which option position is correct.
Topic: ${requested || 'pick the most useful topic for this member from their snapshot: their next roadmap item or upcoming exam. If nothing fits, use their track.'}
${knowledge ? `KNOWLEDGE BASE (only for Hacking Hub facts): ${knowledge}` : ''}
MEMBER SNAPSHOT: ${JSON.stringify(snapshot ?? {})}`, [{ role: 'user', parts: [{ text: 'Quiz me.' }] }], QUIZ_SCHEMA);

      const questions = (Array.isArray(result.questions) ? result.questions : [])
        .filter((q: any) => typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer_index) && q.answer_index >= 0 && q.answer_index < 4)
        .slice(0, 5);
      if (questions.length === 0) return json({ error: 'That quiz came out wonky. Try again?' }, 502);

      await admin.from('portal_events').insert({ email, event_type: 'gemma_quiz_generated', metadata: { topic: String(result.topic || requested).slice(0, 120) } });
      return json({ topic: String(result.topic || requested || 'Practice quiz').slice(0, 120), questions });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    console.error('gemma-tools error:', err);
    return json({ error: 'Gemma had trouble with that. Try again in a moment.' }, 500);
  }
});
