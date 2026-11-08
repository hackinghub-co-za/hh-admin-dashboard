// Hacking Hub Admin Dashboard - Daily Portal Report email
//
// Deploy with: supabase functions deploy daily-report-email --no-verify-jwt
// Uses the secrets already set for the other email functions (RESEND_API_KEY,
// CRON_SECRET) - no new ones needed.
//
// Triggered by pg_cron every day at 06:00 SAST (108_weekly_report.sql), which
// sends the x-cron-secret header. Sends one email to the founder only, about
// the previous South African day: what needs the founder, what members did,
// then the business and staff side. Every figure comes from
// get_daily_report() (108_weekly_report.sql), which only the service role can
// call. A body of { "day": "YYYY-MM-DD" } rebuilds an earlier day, and
// { "preview": true } returns the email without sending it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Hacking Hub <siya@hackinghub.co.za>';
const TO_ADDRESS = 'siya@hackinghub.co.za';
const PORTAL_URL = 'https://portal.hackinghub.co.za';

// deno-lint-ignore no-explicit-any
type Report = Record<string, any>;
type Row = Report;

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const rand = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString('en-ZA').replace(/\s| /g, ',')}`;
const dayFmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-ZA', { timeZone: 'UTC', ...opts });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const hours = (minutes: number) => `${(Number(minutes) / 60).toFixed(1)} h`;

const C = { navy: '#17183c', ink: '#1b1d3a', ink2: '#4d5275', ink3: '#6b7096', line: '#e3e5f1', soft: '#f4f5fb', amber: '#8a5a00', amberBg: '#fbecd0', red: '#b3261e', redBg: '#fbe4e1', green: '#17803f', blueBg: '#e0e8fb', blue: '#1d4ed8' };

function section(title: string, inner: string): string {
  return `<p style="margin:26px 0 10px;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.ink3};">${esc(title)}</p>${inner}`;
}
function band(text: string): string {
  return `<div style="margin:30px -26px 0;padding:9px 26px;background:${C.navy};color:#ffffff;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${esc(text)}</div>`;
}
function chip(text: string, tone: 'red' | 'amber' | 'blue'): string {
  const [bg, fg] = tone === 'red' ? [C.redBg, C.red] : tone === 'amber' ? [C.amberBg, C.amber] : [C.blueBg, C.blue];
  return `<span style="display:inline-block;background:${bg};color:${fg};font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap;">${esc(text)}</span>`;
}
function rows(items: { main: string; sub?: string; tag?: string }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;color:${C.ink};">${items.map((i) => `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid ${C.line};font-size:14px;vertical-align:top;">${i.main}${i.sub ? `<div style="font-size:12px;color:${C.ink3};margin-top:1px;">${i.sub}</div>` : ''}</td>
      <td style="padding:7px 0 7px 10px;border-bottom:1px solid ${C.line};text-align:right;vertical-align:top;white-space:nowrap;">${i.tag || ''}</td>
    </tr>`).join('')}</table>`;
}
function tiles(items: { big: string; label: string; delta?: string }[]): string {
  const cells = items.map((k) => `
    <td width="33%" style="padding:4px;vertical-align:top;">
      <div style="background:${C.soft};border:1px solid ${C.line};border-radius:8px;padding:10px 12px;">
        <div style="font-family:Menlo,Consolas,monospace;font-size:20px;font-weight:700;color:${C.navy};">${k.big}</div>
        <div style="font-size:12px;color:${C.ink2};margin-top:2px;">${esc(k.label)}${k.delta ? ` ${k.delta}` : ''}</div>
      </div>
    </td>`);
  const out: string[] = [];
  for (let i = 0; i < cells.length; i += 3) out.push(`<tr>${cells.slice(i, i + 3).join('')}</tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${out.join('')}</table>`;
}
function delta(now: number, before: number, fmt: (n: number) => string = (n) => String(n)): string {
  const d = Number(now) - Number(before);
  if (!d) return '';
  return `<span style="color:${d > 0 ? C.green : C.red};font-weight:700;">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</span>`;
}

// Bars drawn as table cells so they render in every email client.
function activeBars(series: { d: string; n: number }[], total: number): string {
  const max = Math.max(1, ...series.map((s) => Number(s.n)));
  const cells = series.map((s, i) => {
    const h = Math.max(2, Math.round((Number(s.n) / max) * 70));
    const last = i === series.length - 1;
    return `<td align="center" valign="bottom" style="padding:0 3px;">
      <div style="font-size:11px;color:${C.ink};font-weight:${last ? 700 : 400};height:14px;">${s.n}</div>
      <div style="height:${h}px;background:${last ? '#1d6fb8' : '#b9d3ea'};border-radius:3px 3px 0 0;"></div>
      <div style="font-size:11px;color:${C.ink3};margin-top:3px;">${esc(dayFmt(s.d, { weekday: 'short' }).slice(0, 3))}</div>
    </td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;"><tr>${cells}</tr></table>
    <p style="font-size:11px;color:${C.ink3};margin:6px 0 0;">Members who signed in each day, of ${total} active members.</p>`;
}

// Monday only: the Weekly Updates for the week that ended on the report's
// day (Sunday), from weekly_updates_digest() (112_weekly_updates.sql).
function weeklySection(w: Row | null): string {
  if (!w) return '';
  const blockers: Row[] = w.blockers || [];
  const achievements: Row[] = w.achievements || [];
  const rate = Number(w.eligible) ? Math.round((Number(w.submitted) / Number(w.eligible)) * 100) : 0;
  const list = (items: Row[], tone: 'amber' | 'blue', label: string) => rows(items.map((i) => ({ main: esc(i.name), sub: esc(i.text), tag: chip(label, tone) })));
  return section(`Weekly updates · week ending ${dayFmt(w.week_ending, { day: 'numeric', month: 'short' })}`,
    `<p style="margin:0 0 8px;font-size:14px;">${Number(w.submitted)} of ${Number(w.eligible)} active members answered (${rate}%). Members can still answer until Saturday.</p>`
    + (blockers.length ? list(blockers, 'amber', 'Blocker') : `<p style="font-size:13px;color:${C.ink3};margin:0 0 6px;">No blockers reported.</p>`)
    + (achievements.length ? list(achievements, 'blue', 'Achievement') : ''));
}

function buildEmail(r: Report, weekly: Row | null = null, followUps: Row[] = []): { subject: string; html: string; needs: number } {
  const day: string = r.day;
  const longDay = dayFmt(day, { weekday: 'long', day: 'numeric', month: 'long' });
  const money = r.money;

  // ---- Needs you ----
  const needs: { main: string; sub?: string; tag: string }[] = [];
  const elite: Report[] = r.elite_waiting || [];
  if (elite.length) {
    const oldest = Math.max(...elite.map((e) => Number(e.days)));
    needs.push({ main: `${plural(elite.length, 'Elite application')} waiting`, sub: esc(elite.map((e) => e.name).join(', ')) + `. Oldest: ${plural(oldest, 'day')}`, tag: chip('Decide', 'red') });
  }
  if (Number(r.pending_rooms)) needs.push({ main: `${plural(r.pending_rooms, 'room log')} to approve`, tag: chip('Approve', 'amber') });
  if (Number(r.pending_score_reviews)) needs.push({ main: `${plural(r.pending_score_reviews, 'Hub Score review request')}`, tag: chip('Review', 'amber') });
  if (Number(r.exams_unmarked)) needs.push({ main: `${plural(r.exams_unmarked, 'exam')} on Cert Calendar with no result entered`, tag: chip('Enter result', 'amber') });
  if (Number(r.welcome_unsent)) needs.push({ main: `${plural(r.welcome_unsent, 'new member')} without a welcome email`, sub: 'Use "Send welcome email" on their profile', tag: chip('Send', 'red') });
  // Sales Pipeline reach-out dates due today or earlier (pipeline_followups_due()).
  if (followUps.length) {
    const who = followUps.map((f) => {
      const late = Number(f.days_overdue);
      return `${esc(f.name)} (${esc(f.phase)}${late > 0 ? `, ${plural(late, 'day')} overdue` : ', today'})`;
    }).join('; ');
    needs.push({ main: `${plural(followUps.length, 'person', 'people')} to reach out to`, sub: who, tag: chip('Reach out', followUps.some((f) => Number(f.days_overdue) > 0) ? 'red' : 'blue') });
  }
  if (Number(r.pipeline_ready)) needs.push({ main: `${r.pipeline_ready} in the pipeline are ready to join`, tag: chip('Follow up', 'blue') });
  const overdueTasks: Report[] = r.tasks_overdue || [];
  if (overdueTasks.length) {
    needs.push({ main: `${plural(overdueTasks.length, 'staff task')} overdue`, sub: esc(overdueTasks.slice(0, 3).map((t) => `${t.title} (${t.days}d)`).join('; ')), tag: chip('Overdue', 'amber') });
  }
  if (Number(r.one_on_ones_overdue)) needs.push({ main: `${plural(r.one_on_ones_overdue, 'member')} overdue for a one-on-one (30+ days)`, tag: chip('Overdue', 'amber') });
  if (Number(r.merch_to_fulfil)) needs.push({ main: `${plural(r.merch_to_fulfil, 'merch order')} to fulfil`, tag: chip('Fulfil', 'blue') });

  // ---- Members ----
  const memberTiles = tiles([
    { big: `${r.active} / ${r.members_total}`, label: 'Members active', delta: delta(r.active, r.active_before) },
    { big: hours(r.study_minutes), label: 'Study hours', delta: delta(r.study_minutes, r.study_minutes_before, hours) },
    { big: String(r.rooms), label: 'Rooms logged', delta: delta(r.rooms, r.rooms_before) },
    { big: String(r.checkins), label: 'Check-ins' },
    { big: String(r.applications), label: 'Job applications', delta: delta(r.applications, r.applications_before) },
    { big: String(r.roadmap_ticks), label: 'Roadmap items ticked' },
  ]);

  const wins: { main: string; sub?: string; tag: string }[] = [];
  (r.exam_results || []).forEach((x: Report) => wins.push(x.result === 'Passed'
    ? { main: `${esc(x.member)} passed ${esc(x.cert)}`, tag: chip('Post it', 'blue') }
    : { main: `${esc(x.member)} did not pass ${esc(x.cert)}`, tag: chip('Check in', 'amber') }));
  (r.placements || []).forEach((x: Report) => wins.push({ main: `${esc(x.name || 'A member')} was placed${x.title ? `: ${esc(x.title)}` : ''}`, tag: chip('Placement', 'blue') }));
  (r.streak_milestones || []).forEach((x: Report) => wins.push({ main: `${esc(x.name || 'A member')} hit a ${x.days}-day login streak`, tag: '' }));
  (r.wins || []).forEach((x: Report) => wins.push({ main: `${esc(x.member)} ${esc(x.achievement)}`, sub: 'Added to Recent Wins', tag: '' }));

  const quiet: { main: string; sub?: string; tag: string }[] = [];
  if (Number(r.quiet_count)) {
    const top: Report[] = r.quiet_top || [];
    quiet.push({ main: `${plural(r.quiet_count, 'member')} with no sign-in for 7+ days`, sub: top.length ? esc(`Longest: ${top.map((q) => `${q.name} (${q.days}d)`).slice(0, 3).join(', ')}`) : undefined, tag: chip('Check in', 'amber') });
  }
  if (Number(r.quiet_never)) quiet.push({ main: `${plural(r.quiet_never, 'member')} have never signed in`, tag: chip('Nudge', 'amber') });
  const onBreak: Report[] = r.on_break || [];
  if (onBreak.length) quiet.push({ main: `${plural(onBreak.length, 'member')} on a Take a Break`, sub: esc(onBreak.map((b) => `${b.name} until ${dayFmt(b.until, { day: 'numeric', month: 'short' })}`).join('; ')), tag: chip('On break', 'blue') });

  // ---- Business and staff ----
  const payments: Report[] = money.payments || [];
  const payTable = payments.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;color:${C.ink};margin-top:10px;">${payments.map((p) => `
        <tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};font-size:14px;">${esc(p.who)}<div style="font-size:12px;color:${C.ink3};">${esc(p.plan)} · ${esc(p.method)}</div></td>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;font-family:Menlo,Consolas,monospace;font-size:14px;">${rand(p.amount)}</td></tr>`).join('')}</table>`
    : `<p style="font-size:13px;color:${C.ink3};margin:10px 0 0;">No payments recorded that day.</p>`;

  const moves: Report[] = r.pipeline_moves || [];
  const done: Report[] = r.tasks_done || [];
  const staffLines: { main: string; tag: string }[] = [];
  if (Number(r.one_on_ones_held)) staffLines.push({ main: `${plural(r.one_on_ones_held, 'one-on-one session')} held`, tag: '' });
  if (done.length) staffLines.push({ main: `${plural(done.length, 'staff task')} completed: ${esc(done.slice(0, 4).map((t) => t.title).join('; '))}`, tag: '' });
  if (Number(r.tasks_created)) staffLines.push({ main: `${plural(r.tasks_created, 'staff task')} created`, tag: '' });

  const subject = `Daily Portal Report: ${r.active} of ${r.members_total} members active, ${rand(money.day_total)} received${needs.length ? `, ${plural(needs.length, 'thing')} need${needs.length === 1 ? 's' : ''} you` : ''}`;

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:${C.ink};line-height:1.5;padding:26px;">
    <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.ink3};">Daily report · ${esc(longDay)}</p>
    <h1 style="font-size:22px;line-height:1.25;margin:6px 0 6px;color:${C.navy};">${r.active} of ${r.members_total} members active, ${rand(money.day_total)} received${needs.length ? `, ${plural(needs.length, 'thing')} need${needs.length === 1 ? 's' : ''} you` : ''}</h1>
    <p style="margin:0;font-size:14px;color:${C.ink2};">${Number(r.active) >= Number(r.active_before) ? 'Up' : 'Down'} ${Math.abs(Number(r.active) - Number(r.active_before))} member${Math.abs(Number(r.active) - Number(r.active_before)) === 1 ? '' : 's'} on the day before. ${hours(r.study_minutes)} of study logged.</p>

    ${section('Needs you', needs.length ? rows(needs) : `<p style="font-size:13px;color:${C.ink3};margin:0;">Nothing waiting on you.</p>`)}

    ${band('Members')}
    ${section('The day in numbers', memberTiles)}
    ${section('Active members, last 7 days', activeBars(r.active_series || [], Number(r.members_total)))}
    ${section('Wins', wins.length ? rows(wins) : `<p style="font-size:13px;color:${C.ink3};margin:0;">No wins recorded that day.</p>`)}
    ${section('Gone quiet', quiet.length ? rows(quiet) : `<p style="font-size:13px;color:${C.ink3};margin:0;">Nobody has gone quiet.</p>`)}
    ${weeklySection(weekly)}

    ${band('Business and staff')}
    ${section('Money', tiles([
      { big: rand(money.day_total), label: 'Received' },
      { big: rand(money.month_total), label: `Received in ${dayFmt(day, { month: 'long' })}` },
      { big: rand(money.owed_total), label: `Owed by ${money.owed_members}` },
    ]) + payTable)}
    ${section('Sales pipeline', moves.length ? rows(moves.map((m) => ({ main: esc(m.name), sub: m.new ? 'New lead' : 'Moved', tag: esc(m.phase) }))) : `<p style="font-size:13px;color:${C.ink3};margin:0;">No pipeline changes.</p>`)}
    ${section('What staff did', staffLines.length ? rows(staffLines) : `<p style="font-size:13px;color:${C.ink3};margin:0;">No staff activity recorded.</p>`)}

    <p style="margin:26px 0 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:${C.navy};color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Open the admin dashboard</a>
    </p>
    <p style="font-size:12px;color:${C.ink3};margin-top:22px;border-top:1px solid ${C.line};padding-top:12px;">
      Sent automatically every morning at 06:00. Counts cover 00:00 to 23:59 South African time. Free Azure exam requests and requests outside the sponsored list arrive as separate emails and are not counted here. Sent to ${TO_ADDRESS} only.
    </p>
  </div>`;

  return { subject, html, needs: needs.length };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!resendKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Not configured.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* the cron sends no body */ }
    const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : null;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.rpc('get_daily_report', { p_day: day });
    if (error) throw new Error(`get_daily_report failed: ${error.message}`);

    // The report covers one day; when that day is a Sunday, add the Weekly
    // Updates for the week it ends. A failure here never stops the report.
    let weekly: Row | null = null;
    if (new Date(`${data.day}T12:00:00Z`).getUTCDay() === 0) {
      const { data: w, error: wErr } = await admin.rpc('weekly_updates_digest', { p_week_ending: data.day });
      if (wErr) console.error('weekly_updates_digest failed:', wErr.message);
      else weekly = w;
    }

    // Reach-outs are about today (the morning the email lands), not the
    // reported day. A failure here never stops the report.
    let followUps: Row[] = [];
    const { data: f, error: fErr } = await admin.rpc('pipeline_followups_due', { p_day: data.today });
    if (fErr) console.error('pipeline_followups_due failed:', fErr.message);
    else followUps = f || [];

    const { subject, html, needs } = buildEmail(data as Report, weekly, followUps);
    if (body.preview) {
      return new Response(JSON.stringify({ preview: true, subject, needs, html }), { headers: { 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [TO_ADDRESS], subject, html }),
    });
    if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);

    return new Response(JSON.stringify({ sent: true, subject }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('daily-report-email error:', err);
    return new Response(JSON.stringify({ error: 'Could not send the daily report.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
