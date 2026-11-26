// Hacking Hub Admin Dashboard - Sales Pipeline "results are ready" emails
//
// Deploy with: supabase functions deploy pipeline-followup-email --no-verify-jwt
// Requires: RESEND_API_KEY (shared with every other Resend-based function)
// and CRON_SECRET (already set for the scheduled emails).
//
// Emails Free CV Review and Role Quiz leads from siya@hackinghub.co.za,
// asking them to book a 15-minute call to go through their results (the
// templates live in _shared/leadResultsEmail.ts). Each card that gets its
// email moves from Lead to Contacted, at the bottom of that column, with a
// progress note saying what was sent. Cards that aren't in Lead, or aren't
// from one of those two sources, are skipped, so sending twice is harmless.
//
// Two ways in:
// - The "Email results" panel on the Sales Pipeline: { prospect_ids: number[] }
//   (at most 50 at a time), from a signed-in admin (checked with get_my_role).
// - The daily pipeline-results-email-daily cron (083_pipeline_prospects.sql),
//   which sends the x-cron-secret header and no ids. It picks every eligible
//   card itself: Role Quiz leads on the next run, Free CV Review leads once
//   they are 2 days old (time to actually review the CV first).
// Either way a card is emailed at most once: results_email_sent_at is set on
// send, and cards with it set, cards not in Lead, cards taken off the board
// and current members are skipped.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BOOKING_URL, FROM_ADDRESS, buildLeadResultsEmail } from '../_shared/leadResultsEmail.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };
const MAX_IDS = 50;
const CV_REVIEW_WAIT_MS = 2 * 24 * 60 * 60 * 1000;

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!resendKey) return respond({ error: 'Not configured - missing RESEND_API_KEY secret.' }, 500);

    let sentBy = 'system';
    const viaCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
    if (!viaCron) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
      });
      const { data: userData, error: authError } = await callerClient.auth.getUser();
      if (authError || !userData?.user?.email) return respond({ error: 'Admins only.' }, 403);
      const { data: callerRole, error: roleError } = await callerClient.rpc('get_my_role');
      if (roleError || callerRole !== 'admin') return respond({ error: 'Admins only.' }, 403);
      sentBy = userData.user.email.toLowerCase();
    }

    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* the cron may send no body */ }
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const columns = 'id, full_name, email, phase, source, notes, created_at, archived_at, results_email_sent_at';

    let ids: number[];
    // deno-lint-ignore no-explicit-any
    let cards: any[] | null;
    if (Array.isArray(body.prospect_ids)) {
      ids = [...new Set(body.prospect_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))] as number[];
      if (ids.length === 0) return respond({ error: 'Missing prospect_ids.' }, 400);
      if (ids.length > MAX_IDS) return respond({ error: `At most ${MAX_IDS} at a time.` }, 400);
      const { data, error } = await admin.from('pipeline_prospects').select(columns).in('id', ids);
      if (error) return respond({ error: 'Could not load those cards.' }, 500);
      cards = data;
    } else if (viaCron) {
      const { data, error } = await admin
        .from('pipeline_prospects')
        .select(columns)
        .eq('phase', 'Lead')
        .in('source', ['Free CV review', 'Role quiz'])
        .not('email', 'is', null)
        .is('archived_at', null)
        .is('results_email_sent_at', null)
        .order('created_at', { ascending: true })
        .limit(MAX_IDS);
      if (error) return respond({ error: 'Could not load the leads.' }, 500);
      const cutoff = Date.now() - CV_REVIEW_WAIT_MS;
      cards = (data || []).filter((c) => c.source !== 'Free CV review' || new Date(c.created_at).getTime() <= cutoff);
      ids = cards.map((c) => c.id);
      if (body.dryRun) return respond({ dryRun: true, would_email: cards.map((c) => ({ id: c.id, name: c.full_name, source: c.source })) });
    } else {
      return respond({ error: 'Missing prospect_ids.' }, 400);
    }

    // Anyone who has since become a member doesn't need a sales email.
    const emails = (cards || []).map((c) => String(c.email || '').toLowerCase()).filter(Boolean);
    const { data: memberRows } = emails.length
      ? await admin.from('member_profiles').select('email').in('email', emails).neq('status', 'Left')
      : { data: [] };
    const memberEmails = new Set((memberRows || []).map((m: { email: string }) => m.email.toLowerCase()));

    const { data: lastContacted } = await admin
      .from('pipeline_prospects')
      .select('sort_order')
      .eq('phase', 'Contacted')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextSort = (lastContacted?.sort_order ?? -1) + 1;

    const results: Record<string, unknown>[] = [];
    for (const card of cards || []) {
      const email = buildLeadResultsEmail(card);
      const skip = card.phase !== 'Lead' ? `In ${card.phase}, not Lead`
        : !email || !card.email ? 'Not a CV review or role quiz lead'
        : card.results_email_sent_at ? 'Already emailed'
        : card.archived_at ? 'Taken off the board'
        : memberEmails.has(String(card.email).toLowerCase()) ? 'Already a member'
        : null;
      if (skip) {
        results.push({ id: card.id, sent: false, reason: skip });
        continue;
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_ADDRESS, to: [card.email], subject: email.subject, html: email.html }),
      });
      if (!res.ok) {
        console.error(`pipeline-followup-email: Resend failed for ${card.id}`, res.status, await res.text());
        results.push({ id: card.id, sent: false, reason: 'Email failed to send' });
        await sleep(600);
        continue;
      }

      const what = email.kind === 'cv_review' ? 'CV review results email' : `role quiz results email (${email.role || 'no role'})`;
      const { error: moveError } = await admin
        .from('pipeline_prospects')
        .update({ phase: 'Contacted', sort_order: nextSort++, updated_at: new Date().toISOString(), results_email_sent_at: new Date().toISOString() })
        .eq('id', card.id);
      await admin.from('pipeline_notes').insert({
        prospect_id: card.id,
        body: `Sent the ${what} from siya@hackinghub.co.za, with the booking link (${BOOKING_URL}).`,
        author_email: sentBy,
      });
      results.push({ id: card.id, sent: true, moved: !moveError, subject: email.subject });
      await sleep(600); // Resend allows about 2 requests a second.
    }

    for (const id of ids) {
      if (!(cards || []).some((c) => c.id === id)) results.push({ id, sent: false, reason: 'Card not found' });
    }
    return respond({ sent: results.filter((r) => r.sent).length, results });
  } catch (err) {
    console.error('pipeline-followup-email error:', err);
    return respond({ error: 'Could not send the emails.' }, 500);
  }
});
