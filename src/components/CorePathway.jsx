import { useState, useEffect, useRef } from 'react';
import { Route, CalendarCheck, CheckSquare, Square, ChevronLeft, ChevronRight, RotateCcw, Info, Lock } from 'lucide-react';
import { CORE_FOUNDATIONS_CATALOG, CORE_FOUNDATION_SUBTASKS, CORE_FOUNDATION_PRICING, CORE_FOUNDATIONS_MIN_REQUIRED, SPECIALIZATION_UNLOCK_MIN } from '../lib/memberOptions';
import {
  buildPathway, checkCertMove, pathwayAdvice, pathwayWeek, itemFraction, activeCheckpoint, checkpointReachedDates,
  WEEKLY_HOURS_OPTIONS, DEFAULT_WEEKLY_HOURS, LAB_ITEMS,
} from '../lib/pathway';
import { fetchMyPathway, saveMyPathway, bookMyPathwayCheckpoint } from '../lib/pathwayData';
import { friendlyMemberErrorMessage } from '../lib/errorMessages';

const BLUE = '59, 130, 246';
// Lane colours: labs use the portal's own accent (it differs by theme), certificates a fixed blue.
const TONE = { labs: { rgb: 'var(--accent-rgb)', fg: 'var(--accent-cyan)' }, cert: { rgb: BLUE, fg: `rgb(${BLUE})` } };
const todaySast = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
const shortName = (t) => t.replace('TryHackMe ', '').replace('CISCO ', 'Cisco ');
const span = (a, b) => (a === b ? `week ${a}` : `weeks ${a}–${b}`);

// Mock Member starts two weeks in, so the view opens on a realistic week 3.
// Like get_my_pathway(), checkpoints already passed count as cleared.
function mockPathway(today, doneCount) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 14);
  const checkpoints = Object.fromEntries([2, 4, 5].filter((n) => n <= doneCount).map((n) => [n, { how: 'prior', on: today }]));
  return { startedOn: d.toISOString().slice(0, 10), weeklyHours: DEFAULT_WEEKLY_HOURS, labOrder: [], certStarts: {}, checkpoints, meetingDates: [] };
}

function PriceTag({ title }) {
  const p = CORE_FOUNDATION_PRICING[title];
  if (!p) return null;
  return p.free
    ? <span className="badge badge-success" style={{ fontSize: '0.64rem' }}>Free</span>
    : <span style={{ fontSize: '0.68rem', fontWeight: 600, color: TONE.cert.fg, background: `rgba(${BLUE}, 0.12)`, border: `1px solid rgba(${BLUE}, 0.28)`, borderRadius: '999px', padding: '1px 8px', whiteSpace: 'nowrap' }}>{p.price}</span>;
}

function Checklist({ item, doneKeys, locked, busyKey, onToggle }) {
  if (!item) return null;
  const catalog = CORE_FOUNDATION_SUBTASKS[item.title] || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {catalog.map((st) => {
        const done = doneKeys?.has(st.key);
        const busy = busyKey === `${item.title}::${st.key}`;
        const blocked = locked && !done;
        return (
          <button
            key={st.key}
            type="button"
            disabled={busy || blocked}
            onClick={() => onToggle(item, st.key)}
            title={blocked ? 'Book your checkpoint 1-on-1 to keep ticking things off' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', background: 'none', border: 'none', padding: '5px 4px', font: 'inherit', textAlign: 'left', cursor: busy || blocked ? 'default' : 'pointer', opacity: blocked ? 0.55 : 1 }}
          >
            {done ? <CheckSquare size={16} color="var(--success)" style={{ flexShrink: 0 }} /> : <Square size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
            <span style={{ fontSize: '0.82rem', textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{st.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const laneBox = (rgb) => ({ background: 'var(--bg-tertiary)', border: `1px solid rgba(${rgb}, 0.25)`, borderRadius: 'var(--border-radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 });
const smallLabel = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' };

/**
 * The Core Foundations pathway on My Roadmap: this week's work in two lanes,
 * a rearrangeable 2-lane plan, the checkpoint 1-on-1 gate, and everything
 * already done. Completion itself still flows through the parent's subtask
 * toggle, so Hub Score, the unlock and staff views keep working unchanged.
 */
export default function CorePathway({ catalogItems, subtasks, passedCertTitles, isMockSession, busyKey, onToggleSubtask, onCompleteItem, onOpenInfo, onBookMeeting }) {
  const [today] = useState(todaySast);
  const [pathway, setPathway] = useState(() => (isMockSession ? mockPathway(today, catalogItems.filter((i) => i.completed).length) : null));
  const [loadError, setLoadError] = useState(null);
  const [msg, setMsg] = useState({ text: '', warn: false });
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState(false);
  const gridRef = useRef(null);
  const dragRef = useRef(null);
  const [dragDx, setDragDx] = useState({ title: null, dx: 0 });

  useEffect(() => {
    if (isMockSession) return undefined;
    let cancelled = false;
    fetchMyPathway()
      .then((p) => { if (!cancelled) setPathway(p); })
      .catch((err) => { if (!cancelled) setLoadError(friendlyMemberErrorMessage(err)); });
    return () => { cancelled = true; };
  }, [isMockSession]);

  if (loadError) return <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{loadError}</p>;
  if (!pathway) return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading your pathway...</p>;

  const byTitle = Object.fromEntries(catalogItems.map((i) => [i.title, i]));
  // Only items actually on this member's roadmap get scheduled.
  const status = Object.fromEntries(CORE_FOUNDATIONS_CATALOG.filter(({ title }) => byTitle[title]).map(({ title }) => {
    const item = byTitle[title];
    return [title, { completed: !!item.completed, fraction: itemFraction(title, !!item.completed, subtasks[title]) }];
  }));
  const prefs = { labOrder: pathway.labOrder, certStarts: pathway.certStarts, weeklyHours: pathway.weeklyHours };
  const now = pathwayWeek(pathway.startedOn, today);
  const plan = buildPathway(status, prefs, now);
  const advice = pathwayAdvice(plan);
  const gate = activeCheckpoint({ doneCount: plan.doneCount, cleared: pathway.checkpoints, reachedDates: checkpointReachedDates(catalogItems), meetingDates: pathway.meetingDates });
  const unclaimedPasses = (passedCertTitles || []).filter((t) => byTitle[t] && !byTitle[t].completed);

  // Persist a rearrangement. The screen updates first; a failed save puts it back.
  const applyPrefs = async (next, note) => {
    const previous = pathway;
    setPathway({ ...pathway, ...next });
    setMsg({ text: note, warn: false });
    if (isMockSession) return;
    setSaving(true);
    try {
      await saveMyPathway({ labOrder: next.labOrder ?? pathway.labOrder, certStarts: next.certStarts ?? pathway.certStarts, weeklyHours: next.weeklyHours ?? pathway.weeklyHours });
    } catch (err) {
      setPathway(previous);
      setMsg({ text: friendlyMemberErrorMessage(err), warn: true });
    } finally {
      setSaving(false);
    }
  };

  const currentCertStarts = () => Object.fromEntries(plan.certs.map((c) => [c.title, c.start]));
  const moveCert = (title, start) => {
    const err = checkCertMove(plan, title, start);
    if (err) { setMsg({ text: err, warn: true }); return; }
    const len = plan.certs.find((c) => c.title === title).len;
    applyPrefs({ certStarts: { ...currentCertStarts(), [title]: start } }, `Moved ${title} to ${span(start, start + len - 1)}.`);
  };
  const moveLab = (title, index) => {
    const order = plan.labs.map((b) => b.title);
    const from = order.indexOf(title);
    if (index < 0 || index >= order.length || index === from) return;
    order.splice(from, 1);
    order.splice(index, 0, title);
    applyPrefs({ labOrder: order, certStarts: currentCertStarts() }, `${shortName(title)} is now lab item ${index + 1} of ${order.length}.`);
  };
  const resetPlan = () => applyPrefs({ labOrder: [], certStarts: {} }, 'Back to the recommended order.');

  const handleBooked = async () => {
    if (!gate) return;
    setBooking(true);
    try {
      const cleared = isMockSession
        ? { ...pathway.checkpoints, [gate.at]: { how: 'booked', on: today } }
        : await bookMyPathwayCheckpoint(gate.at);
      setPathway((p) => ({ ...p, checkpoints: cleared }));
      setMsg({ text: 'Checkpoint booked. You can carry on.', warn: false });
    } catch (err) {
      setMsg({ text: friendlyMemberErrorMessage(err), warn: true });
    } finally {
      setBooking(false);
    }
  };

  // Grid range: a couple of weeks of context behind "now", at least 20 wide.
  const from = Math.max(1, now - 2);
  const to = Math.max(from + 19, plan.lastWeek);
  const cols = to - from + 1;
  const col = (w) => w - from + 2;

  const onPointerDown = (e, title, lane) => {
    if (e.button !== undefined && e.button > 0) return;
    dragRef.current = { title, lane, x0: e.clientX, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 4) d.moved = true;
    setDragDx({ title: d.title, dx });
  };
  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragDx({ title: null, dx: 0 });
    if (!d) return;
    if (!d.moved) { onOpenInfo(d.title); return; }
    const dx = e.clientX - d.x0;
    const head = gridRef.current?.querySelector('[data-week]');
    const colW = (head?.getBoundingClientRect().width || 30) + 4;
    if (d.lane === 'cert') {
      const shift = Math.round(dx / colW);
      if (shift) moveCert(d.title, plan.certs.find((c) => c.title === d.title).start + shift);
      return;
    }
    const blocks = [...(gridRef.current?.querySelectorAll('[data-lab]') || [])];
    const me = blocks.find((b) => b.getAttribute('data-lab') === d.title);
    if (!me) return;
    const r = me.getBoundingClientRect();
    const center = r.left + r.width / 2;   // already includes the drag offset
    const index = blocks.filter((b) => b !== me && (() => { const o = b.getBoundingClientRect(); return o.left + o.width / 2 < center; })()).length;
    moveLab(d.title, index);
  };
  const blockStyle = (title, tone, row, start, end) => ({
    gridRow: row, gridColumn: `${col(start)} / span ${end - start + 1}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.2, padding: '10px 4px', borderRadius: '6px', minWidth: 0,
    background: `rgba(${tone.rgb}, 0.18)`, color: tone.fg, border: `1px solid ${dragDx.title === title ? tone.fg : 'transparent'}`,
    cursor: dragDx.title === title ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none',
    transform: dragDx.title === title ? `translateX(${dragDx.dx}px)` : 'none', zIndex: dragDx.title === title ? 3 : 1,
    boxShadow: dragDx.title === title ? 'var(--glass-shadow)' : 'none',
  });

  const lab = plan.thisWeekLab;
  const cert = plan.thisWeekCert;
  const nextCert = plan.certs.find((c) => c.start > now);
  const split = plan.split;
  const fmtH = (h) => (Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`);
  const delta = (week) => (week === null ? 'Done' : `Week ${week}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...smallLabel, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}><Route size={13} /> Your pathway</div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '4px 0 0' }}>
            Week {now}{lab ? ` · ${shortName(lab.title)}` : ''}{cert ? ` and ${cert.title}` : ''}
          </h4>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="pathway-hours" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hours a week</label>
          <select
            id="pathway-hours"
            className="form-input"
            style={{ width: 'auto', padding: '5px 8px', fontSize: '0.8rem' }}
            value={pathway.weeklyHours}
            onChange={(e) => applyPrefs({ weeklyHours: Number(e.target.value), certStarts: currentCertStarts() }, `Planning for ${e.target.value} hours a week.`)}
          >
            {WEEKLY_HOURS_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      {/* Checkpoint gate */}
      {gate && (
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', padding: '14px 16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--warning-rgb), 0.08)', border: '1px solid rgba(var(--warning-rgb), 0.35)' }}>
          <Lock size={20} color="var(--warning)" style={{ flexShrink: 0 }} />
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{gate.title}</div>
            <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{gate.body} You can keep ticking things off once it's booked.</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '8px 14px' }} onClick={onBookMeeting}><CalendarCheck size={14} /> Book a 1-on-1</button>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '8px 14px' }} disabled={booking} onClick={handleBooked}>{booking ? 'Saving...' : "I've booked it"}</button>
          </div>
        </div>
      )}

      {/* Cert Calendar says passed but the item isn't ticked */}
      {unclaimedPasses.map((t) => (
        <div key={t} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--success-rgb), 0.07)', border: '1px solid rgba(var(--success-rgb), 0.3)', fontSize: '0.84rem' }}>
          <span style={{ flex: '1 1 240px' }}>Your Cert Calendar shows <b>{t}</b> as passed, but it isn't ticked off here yet.</span>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.76rem', padding: '6px 12px' }} onClick={() => onCompleteItem(byTitle[t])}>Mark it done</button>
        </div>
      ))}

      {plan.labs.length + plan.certs.length === 0 ? (
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Every item on the pathway is done. {plan.afterUnlock.length ? 'The rest of the catalog is below, and none of it blocks anything.' : ''}</p>
      ) : (
        <>
          {/* This week */}
          <div style={{ display: 'flex', gap: '3px', height: '28px' }} role="img" aria-label="How this week's hours split">
            {cert && <div style={{ flex: split.cert, background: `rgba(${BLUE}, 0.16)`, color: 'rgb(59, 130, 246)', borderRadius: '5px', display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 700 }}>Certificate {fmtH(split.cert)}</div>}
            {lab && <div style={{ flex: cert ? split.labsInSprint : split.labsNormal, background: 'rgba(var(--accent-rgb), 0.16)', color: 'var(--accent-cyan)', borderRadius: '5px', display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 700 }}>Labs {fmtH(cert ? split.labsInSprint : split.labsNormal)}</div>}
            <div style={{ flex: 0.5, background: 'rgba(var(--warning-rgb), 0.16)', color: 'var(--warning)', borderRadius: '5px', display: 'grid', placeItems: 'center', fontSize: '0.66rem', fontWeight: 700 }}>30m</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            <div style={laneBox(TONE.labs.rgb)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}><span style={smallLabel}>Labs lane</span>{lab && <PriceTag title={lab.title} />}</div>
              {lab ? (
                <>
                  <button type="button" onClick={() => onOpenInfo(lab.title)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{lab.title}</button>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>On track to finish in week {lab.end}</span>
                  <Checklist item={byTitle[lab.title]} doneKeys={subtasks[lab.title]} locked={!!gate} busyKey={busyKey} onToggle={onToggleSubtask} />
                </>
              ) : <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>All three lab items are done.</span>}
            </div>
            <div style={laneBox(TONE.cert.rgb)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}><span style={smallLabel}>Certificate sprint</span>{(cert || nextCert) && <PriceTag title={(cert || nextCert).title} />}</div>
              {cert ? (
                <>
                  <button type="button" onClick={() => onOpenInfo(cert.title)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{cert.title} · week {now - cert.start + 1} of {cert.len}</button>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Aim to sit the exam by the end of week {cert.end}, and log it on the Cert Calendar.</span>
                  <Checklist item={byTitle[cert.title]} doneKeys={subtasks[cert.title]} locked={!!gate} busyKey={busyKey} onToggle={onToggleSubtask} />
                </>
              ) : (
                <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  {nextCert ? `No sprint this week. ${nextCert.title} starts in week ${nextCert.start}.` : 'Both Microsoft certificates are done.'}
                </span>
              )}
            </div>
          </div>

          {/* Rearrangeable lanes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Your lanes</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Drag a block, or use the arrows. Certificates move to any free week ahead; lab items swap places. Tap a block for details.</p>
              </div>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.74rem', padding: '6px 12px' }} onClick={resetPlan} disabled={saving}><RotateCcw size={13} /> Recommended order</button>
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
              <div
                ref={gridRef}
                role="group"
                aria-label="Your lanes by week"
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => { dragRef.current = null; setDragDx({ title: null, dx: 0 }); }}
                style={{ display: 'grid', gridTemplateColumns: `86px repeat(${cols}, minmax(28px, 1fr))`, gap: '4px', minWidth: `${86 + cols * 32}px`, alignItems: 'stretch' }}
              >
                <span style={{ ...smallLabel, fontSize: '0.6rem', alignSelf: 'center' }}>Week</span>
                {Array.from({ length: cols }, (_, i) => from + i).map((w) => (
                  <span key={w} data-week={w} style={{ fontSize: '0.64rem', textAlign: 'center', borderRadius: '3px', padding: '2px 0', color: w === now ? 'var(--accent-cyan)' : w < now ? 'var(--text-muted)' : 'var(--text-secondary)', background: w === now ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent', fontWeight: w === now ? 700 : 400 }}>{w}</span>
                ))}
                <span style={{ ...smallLabel, fontSize: '0.6rem', gridRow: 2, alignSelf: 'center' }}>Labs</span>
                <span style={{ ...smallLabel, fontSize: '0.6rem', gridRow: 3, alignSelf: 'center' }}>Certificates</span>
                {plan.labs.map((b) => (
                  <div key={b.title} data-lab={b.title} title={`${b.title}: ${span(b.start, b.end)}`} style={blockStyle(b.title, TONE.labs, 2, b.start, b.end)}
                    onPointerDown={(e) => onPointerDown(e, b.title, 'labs')}>{shortName(b.title)}</div>
                ))}
                {plan.certs.map((c) => (
                  <div key={c.title} title={`${c.title}: ${span(c.start, c.end)}`} style={blockStyle(c.title, TONE.cert, 3, c.start, c.end)}
                    onPointerDown={(e) => onPointerDown(e, c.title, 'cert')}>{c.title}</div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
              {plan.labs.map((b, i) => (
                <div key={b.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                  <div style={{ minWidth: 0 }}><b>{shortName(b.title)}</b><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lab {i + 1} of {plan.labs.length}, {span(b.start, b.end)}</div></div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 6px' }} disabled={i === 0 || saving} onClick={() => moveLab(b.title, i - 1)} aria-label={`Move ${b.title} earlier`}><ChevronLeft size={14} /></button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 6px' }} disabled={i === plan.labs.length - 1 || saving} onClick={() => moveLab(b.title, i + 1)} aria-label={`Move ${b.title} later`}><ChevronRight size={14} /></button>
                  </div>
                </div>
              ))}
              {plan.certs.map((c) => (
                <div key={c.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                  <div style={{ minWidth: 0 }}><b>{c.title} sprint</b><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{span(c.start, c.end)}</div></div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 6px' }} disabled={c.start <= now || saving} onClick={() => moveCert(c.title, c.start - 1)} aria-label={`Move the ${c.title} sprint a week earlier`}><ChevronLeft size={14} /></button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 6px' }} disabled={saving} onClick={() => moveCert(c.title, c.start + 1)} aria-label={`Move the ${c.title} sprint a week later`}><ChevronRight size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div style={smallLabel}>Minimum met, {CORE_FOUNDATIONS_MIN_REQUIRED} of 8</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{delta(plan.minMetWeek)}</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div style={smallLabel}>Specialization unlock, {SPECIALIZATION_UNLOCK_MIN} of 8</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{delta(plan.unlockWeek)}</div>
              </div>
            </div>
            {msg.text && <p role="status" style={{ fontSize: '0.8rem', margin: 0, color: msg.warn ? 'var(--warning)' : 'var(--accent-cyan)' }}>{msg.text}</p>}
            {advice.map((a) => (
              <p key={a} style={{ fontSize: '0.78rem', margin: 0, color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}><Info size={13} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} /> {a}</p>
            ))}
          </div>
        </>
      )}

      {/* Already done */}
      {plan.doneTitles.length > 0 && (
        <div>
          <div style={{ ...smallLabel, marginBottom: '8px' }}>Already done</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {plan.doneTitles.map((t) => (
              <button key={t} type="button" onClick={() => onOpenInfo(t)} className="badge badge-success" style={{ fontSize: '0.72rem', cursor: 'pointer', font: 'inherit' }}>✓ {t}</button>
            ))}
          </div>
        </div>
      )}

      {/* Everything, tickable in any order */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          All your Core Foundations items {plan.afterUnlock.length > 0 ? `(including ${plan.afterUnlock.map(shortName).join(', ')}, which come after the unlock)` : ''}
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px', marginTop: '10px' }}>
          {CORE_FOUNDATIONS_CATALOG.map(({ title }) => byTitle[title] && (
            <div key={title} style={{ ...laneBox(LAB_ITEMS.includes(title) ? TONE.labs.rgb : TONE.cert.rgb), gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <button type="button" onClick={() => onOpenInfo(title)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>{title}</button>
                {byTitle[title].completed ? <span className="badge badge-success" style={{ fontSize: '0.64rem' }}>Done</span> : <PriceTag title={title} />}
              </div>
              <Checklist item={byTitle[title]} doneKeys={subtasks[title]} locked={!!gate} busyKey={busyKey} onToggle={onToggleSubtask} />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
