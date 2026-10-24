// Hacking Hub Admin Dashboard - Monday Weekly Report email
//
// Deploy with: supabase functions deploy weekly-report-email --no-verify-jwt
// Uses the secrets already set for the other email functions (RESEND_API_KEY,
// CRON_SECRET) - no new ones needed.
//
// Triggered by pg_cron every Monday at 06:00 SAST (108_weekly_report.sql),
// which sends the x-cron-secret header. Sends one email to the founder only:
// members, money this month against last month, the month's revenue,
// expense and net profit forecast, new joiners, this week's events and
// exams, the competition, the sales pipeline, and a short to-do list. Every
// figure comes from get_weekly_report() (108_weekly_report.sql), which only
// the service role can call.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Hacking Hub <siya@hackinghub.co.za>';
const TO_ADDRESS = 'siya@hackinghub.co.za';
const PORTAL_URL = 'https://portal.hackinghub.co.za';

type Expense = { id: number; category: string; description: string; amount: number; date: string; isOneOff: boolean };
// deno-lint-ignore no-explicit-any
type Report = Record<string, any>;

// ---- recurring costs: mirrors src/lib/financeForecast.js ----
const monthOf = (date: string) => String(date || '').slice(0, 7);
function words(description: string): string[] {
  return String(description || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}
function sameCost(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return false;
  return wb.includes(wa[0]) || wa.includes(wb[0]);
}
function expectedRecurringCosts(expenses: Expense[], month: string, lastMonth: string): Expense[] {
  const thisMonth = expenses.filter((x) => monthOf(x.date) === month);
  return expenses
    .filter((x) => monthOf(x.date) === lastMonth && !x.isOneOff)
    .filter((x) => !thisMonth.some((t) => t.category === x.category && sameCost(x.description, t.description)));
}

// ---- formatting ----
function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const rand = (n: number) => {
  const rounded = Math.round(Number(n) || 0);
  const s = `R${Math.abs(rounded).toLocaleString('en-ZA').replace(/ |\s/g, ',')}`;
  return rounded < 0 ? `−${s}` : s;
};
const dayFmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-ZA', { timeZone: 'UTC', ...opts });
const shortDay = (iso: string) => dayFmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
const dayOfMonth = (iso: string) => Number(String(iso).slice(8, 10));
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const monthName = (iso: string) => dayFmt(iso, { month: 'long' });

const C = { navy: '#17183c', ink: '#1b1d3a', ink2: '#4d5275', ink3: '#6b7096', line: '#e3e5f1', soft: '#f4f5fb', amber: '#8a5a00', green: '#17803f' };

function heading(text: string): string {
  return `<p style="margin:28px 0 10px;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.ink3};">${esc(text)}</p>`;
}
function kpiRow(items: { big: string; label: string; small?: string }[]): string {
  const cells = items.map((k) => `
    <td width="${Math.floor(100 / items.length)}%" style="padding:4px;vertical-align:top;">
      <div style="background:${C.soft};border:1px solid ${C.line};border-radius:10px;padding:12px;">
        <div style="font-family:Menlo,Consolas,monospace;font-size:20px;font-weight:700;color:${C.navy};">${k.big}</div>
        <div style="font-size:13px;color:${C.ink2};margin-top:2px;">${esc(k.label)}</div>
        ${k.small ? `<div style="font-size:11px;color:${C.ink3};margin-top:4px;">${esc(k.small)}</div>` : ''}
      </div>
    </td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>${cells}</tr></table>`;
}
function table(head: string[] | null, rows: string[][], numericCols: number[] = []): string {
  const th = head ? `<tr>${head.map((h, i) => `<th style="text-align:${numericCols.includes(i) ? 'right' : 'left'};font-size:11px;color:${C.ink3};text-transform:uppercase;letter-spacing:.5px;padding:7px 6px;border-bottom:1px solid ${C.line};">${h}</th>`).join('')}</tr>` : '';
  const tr = rows.map((r) => `<tr>${r.map((c, i) => `<td style="padding:8px 6px;border-bottom:1px solid ${C.line};font-size:14px;vertical-align:top;${numericCols.includes(i) ? 'text-align:right;font-family:Menlo,Consolas,monospace;' : ''}">${c}</td>`).join('')}</tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;color:${C.ink};">${th}${tr}</table>`;
}
const note = (t: string) => `<p style="font-size:12px;color:${C.ink3};margin:8px 0 0;line-height:1.5;">${t}</p>`;
const flag = (t: string) => `<span style="color:${C.amber};font-weight:600;">${esc(t)}</span>`;

function buildEmail(r: Report): { subject: string; html: string } {
  const m = r.members;
  const money = r.money;
  const f = r.forecast;
  const today: string = r.today;
  const thisMonth = monthOf(today);
  const lastMonth = monthOf(r.last_month_start);
  const thisName = monthName(today);
  const lastName = monthName(r.last_month_start);
  const dayN = ordinal(dayOfMonth(today));

  // Forecast
  const rate = Number(f.rate_den) > 0 ? Number(f.rate_num) / Number(f.rate_den) : 1;
  const ratePct = Math.round(rate * 100);
  const dueAmount = Number(f.due_amount);
  const likelyExpected = dueAmount * rate;
  const revLikely = Number(money.rev_this) + likelyExpected;
  const revBest = Number(money.rev_this) + dueAmount;
  const expenses: Expense[] = (r.expenses || []).map((x: Expense) => ({ ...x, amount: Number(x.amount) }));
  const recurring = expectedRecurringCosts(expenses, thisMonth, lastMonth);
  const recurringTotal = recurring.reduce((s, x) => s + x.amount, 0);
  const expForecast = Number(money.exp_this) + recurringTotal;
  const netLikely = revLikely - expForecast;
  const netBest = revBest - expForecast;

  const subject = `Hacking Hub weekly: ${m.active} active members, ${thisName} on track for about ${rand(revLikely)}`;

  // Sections
  const newRows = (m.new_7d || []).map((n: Report) => [
    n.name ? esc(n.name) : flag('(no name on profile)'),
    esc(shortDay(n.start)),
    n.track ? esc(n.track) : flag('Not assigned'),
  ]);
  const missingTrack = (m.new_7d || []).filter((n: Report) => !n.track).length;
  const missingName = (m.new_7d || []).filter((n: Report) => !n.name).length;

  const sundays: Report[] = r.sunday_catchups || [];
  const weekRows: string[][] = [];
  if (sundays.length === 0) {
    weekRows.push(['Sunday', `<b>Sunday Catchup:</b> ${flag('not on the calendar yet, so no presenter')}`]);
  } else {
    sundays.forEach((s) => weekRows.push([esc(shortDay(s.date)), `<b>${esc(s.title)}</b>${s.time ? `, ${esc(s.time)}` : ''} · ${s.presenter ? `Presenting: ${esc(s.presenter)}` : flag('no presenter set yet')}`]));
  }
  (r.events || []).filter((e: Report) => e.type !== 'Sunday Catchup').forEach((e: Report) =>
    weekRows.push([esc(shortDay(e.date)), `${esc(e.title)}${e.location ? `, ${esc(e.location)}` : ''}${e.time ? `, ${esc(e.time)}` : ''}`]));

  const exams: Report[] = r.exams_this_week || [];
  const examRows = exams.map((x) => [esc(shortDay(x.date)), esc(x.member), esc(x.cert)]);
  const nextExams: Report[] = r.exams_next_week || [];
  const results: Report[] = r.results_last_week || [];

  const comp = r.competition;
  const top5: Report[] = r.competition_top5 || [];

  const counts = r.pipeline_counts || {};
  const hot: Report[] = r.pipeline_hot || [];
  const ready = hot.filter((p) => p.phase === 'Ready to Join');
  const interested = hot.filter((p) => p.phase === 'Interested');

  const todo: string[] = [];
  if (missingTrack) todo.push(`<b>Assign a track</b> to ${missingTrack} of the ${m.new_7d.length} new member${m.new_7d.length === 1 ? '' : 's'}`);
  if (missingName) todo.push(`<b>Add a name</b> to ${missingName} new member profile${missingName === 1 ? '' : 's'} with none`);
  if (sundays.length === 0) todo.push(`<b>Add Sunday's catchup</b> and its presenter to the calendar`);
  else if (sundays.some((s) => !s.presenter)) todo.push(`<b>Pick a presenter</b> for Sunday's catchup`);
  if (ready.length) todo.push(`<b>Contact before month end:</b> ${ready.map((p) => esc(p.name)).join(', ')} (ready to join)`);
  if (interested.length) todo.push(`<b>Follow up</b> ${interested.map((p) => esc(p.name)).join(', ')} (interested)`);
  if (Number(r.merch_to_fulfil) > 0) todo.push(`<b>Fulfil</b> ${r.merch_to_fulfil} paid merch order${Number(r.merch_to_fulfil) === 1 ? '' : 's'}`);
  if (comp && comp.ended) todo.push(`<b>Start the next competition season</b> (${esc(comp.title)} ended ${esc(shortDay(comp.end_date))})`);

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${C.ink};max-width:640px;margin:0 auto;line-height:1.5;">
    <p style="font-size:13px;color:${C.ink3};margin:0 0 4px;">Weekly report · ${esc(dayFmt(r.week_start, { day: 'numeric', month: 'short' }))} to ${esc(dayFmt(r.week_end, { day: 'numeric', month: 'short', year: 'numeric' }))}</p>
    <h1 style="font-size:22px;margin:0 0 6px;color:${C.navy};">Good morning, Siya</h1>

    ${heading('The week in numbers')}
    ${kpiRow([
      { big: String(m.active), label: 'active members', small: `${m.monthly} monthly, ${m.permanent} permanent` },
      { big: String((m.new_7d || []).length), label: 'new this week', small: `${m.left_7d} left this week${Number(m.leaving) ? `, ${m.leaving} leaving` : ''}` },
      { big: rand(m.owed_total), label: 'still owed on instalments', small: `across ${m.owed_members} members` },
    ])}

    ${heading(`Money: ${thisName} against ${lastName}`)}
    ${table(['', `${thisName} to the ${dayN}`, `${lastName} to the ${ordinal(dayOfMonth(r.last_same_day))}`, `All of ${lastName}`], [
      ['Revenue', rand(money.rev_this), rand(money.rev_last_same), rand(money.rev_last_full)],
      ['Expenses', rand(money.exp_this), rand(money.exp_last_same), rand(money.exp_last_full)],
      ['<b>Net</b>', `<b>${rand(money.rev_this - money.exp_this)}</b>`, `<b>${rand(money.rev_last_same - money.exp_last_same)}</b>`, `<b>${rand(money.rev_last_full - money.exp_last_full)}</b>`],
    ], [1, 2, 3])}
    ${note(`${rand(money.rev_7d)} came in over the last 7 days (${money.payments_7d} payment${Number(money.payments_7d) === 1 ? '' : 's'}).`)}

    ${heading(`${thisName} forecast`)}
    ${table(null, [
      ['Already in', rand(money.rev_this)],
      [`Still expected from ${f.due_members} member${Number(f.due_members) === 1 ? '' : 's'} who paid in ${lastName} but not yet this month<br><span style="font-size:12px;color:${C.ink3};">likely: ${ratePct}% of them usually pay again</span>`, `+${rand(likelyExpected)}`],
      [`<b>Forecast revenue</b> <span style="font-size:12px;color:${C.ink3};">(${rand(revBest)} if all pay)</span>`, `<b>${rand(revLikely)}</b>`],
      ['Expenses logged so far', rand(money.exp_this)],
      [`Recurring costs from ${lastName} not logged yet${recurring.length ? `<br><span style="font-size:12px;color:${C.ink3};">${recurring.map((x) => esc(x.description)).join(', ')}</span>` : ''}`, `+${rand(recurringTotal)}`],
      ['<b>Forecast expenses</b>', `<b>${rand(expForecast)}</b>`],
      [`<b>Forecast net profit</b> <span style="font-size:12px;color:${C.ink3};">(${rand(netBest)} if all pay)</span>`, `<b>${rand(netLikely)}</b>`],
    ], [1])}
    ${note(`New joiners are in: ${f.first_payers} first-time payment${Number(f.first_payers) === 1 ? '' : 's'} this month brought in ${rand(f.first_payers_amount)}. Leavers are out: ${f.leavers} member${Number(f.leavers) === 1 ? '' : 's'} who paid ${rand(f.leavers_amount)} last month ${Number(f.leavers) === 1 ? 'is' : 'are'} now marked Left or Leaving. One-off costs are not expected again. Revenue is gross; PayFast fees so far this month: ${rand(money.payfast_fees_this)}.`)}

    ${heading('New joiners')}
    ${newRows.length ? table(['Member', 'Started', 'Track'], newRows) : note('Nobody new this week.')}

    ${heading('This week')}
    ${table(['When', 'What'], weekRows)}

    ${heading('Writing this week')}
    ${examRows.length ? table(['Day', 'Member', 'Exam'], examRows) : note('No exams booked this week.')}
    ${nextExams.length ? note(`Next week: ${nextExams.map((x) => `${esc(x.member)}, ${esc(x.cert)} (${esc(shortDay(x.date))})`).join('; ')}.`) : ''}
    ${results.length ? note(`Last week's results: ${results.map((x) => `${esc(x.member)} ${esc(x.cert)}: ${x.result === 'Pending' ? flag('result not entered') : esc(x.result)}`).join('; ')}.`) : ''}

    ${heading('TryHackMe competition')}
    ${comp ? note(comp.ended ? `${esc(comp.title)} ended on ${esc(shortDay(comp.end_date))}. Final top 5:` : `${esc(comp.title)}, ends ${esc(shortDay(comp.end_date))}. Top 5:`) : note('No competition running.')}
    ${top5.length ? table(null, top5.map((p, i) => [`${i + 1}. ${esc(p.name)}`, `${p.rooms} rooms`]), [1]) : ''}

    ${heading('Sales pipeline')}
    <p style="font-size:14px;margin:0 0 8px;"><b>${counts['Ready to Join'] || 0}</b> ready to join · <b>${counts['Interested'] || 0}</b> interested · <b>${counts['Contacted'] || 0}</b> contacted · <b>${counts['Joined'] || 0}</b> joined</p>
    ${hot.length ? table(['Name', 'Stage', 'Next step'], hot.map((p) => [
      esc(p.name),
      p.phase === 'Ready to Join' ? 'Ready to join' : 'Interested',
      p.note ? esc(p.note) : flag('No next step noted'),
    ])) : ''}

    ${heading('Needs you this week')}
    ${todo.length ? `<ul style="margin:0;padding-left:18px;font-size:14px;">${todo.map((t) => `<li style="margin-bottom:6px;">${t}</li>`).join('')}</ul>` : note('Nothing outstanding.')}

    <p style="margin:28px 0 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:#5ee37a;color:#10122b;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Open the admin dashboard</a>
    </p>
    <p style="font-size:12px;color:${C.ink3};margin-top:22px;border-top:1px solid ${C.line};padding-top:12px;">
      Sent automatically every Monday at 06:00. Wins posted this week: ${r.wins_7d}. Figures come from the portal: revenue is PayFast plus recorded EFT payments.
    </p>
  </div>`;

  return { subject, html };
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
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await admin.rpc('get_weekly_report');
    if (error) throw new Error(`get_weekly_report failed: ${error.message}`);

    const { subject, html } = buildEmail(data as Report);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [TO_ADDRESS], subject, html }),
    });
    if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);

    return new Response(JSON.stringify({ sent: true, subject }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('weekly-report-email error:', err);
    return new Response(JSON.stringify({ error: 'Could not send the weekly report.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
