import { useRef, useState } from 'react';
import { CHOICE_LABELS } from '../../data/sim/packs';
import { playCue } from '../../lib/simAudio';
import { SimShell, TopBar, Meter } from './SimParts';
import { useShiftClock, fmtClock } from './useShiftClock';

const SEV_LABEL = { critical: 'CRIT', high: 'HIGH', med: 'MED', low: 'LOW' };
const CHOICES = ['escalate', 'contain', 'tune_rule', 'close_benign'];

export default function ShiftSoc({ pack, provider, settings, onFinish }) {
  const cfg = pack.focus;
  const [decisions, setDecisions] = useState({});
  const [focus, setFocus] = useState(cfg.start);
  const [selectedId, setSelectedId] = useState(null);
  const [termLines, setTermLines] = useState({});
  const [ran, setRan] = useState({});
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const decisionsRef = useRef({});
  const focusRef = useRef(cfg.start);

  const finish = () => {
    if (done) return;
    setDone(true);
    onFinish(provider.evaluateTriage(pack, decisionsRef.current, { endFocus: focusRef.current }));
  };

  const elapsed = useShiftClock({
    durationSec: pack.durationSec,
    running: !done,
    onTick: (sec) => {
      const unresolved = pack.events.filter((e) => e.at <= sec && !decisionsRef.current[e.id]).length;
      if (unresolved >= cfg.backlogThreshold) {
        focusRef.current = Math.max(0, focusRef.current - cfg.backlogDrainPerSec);
        setFocus(focusRef.current);
      }
      pack.events.filter((e) => e.at === sec).forEach((e) => playCue(e.severity === 'critical' ? 'critical' : 'alert', settings.sound));
    },
    onEnd: finish,
  });

  const spend = (n) => {
    focusRef.current = Math.max(0, focusRef.current - n);
    setFocus(focusRef.current);
  };

  const visible = pack.events.filter((e) => e.at <= elapsed);
  const unresolvedCount = visible.filter((e) => !decisions[e.id]).length;
  const selected = visible.find((e) => e.id === selectedId) || visible.find((e) => !decisions[e.id]) || visible[0] || null;
  const decided = selected ? decisions[selected.id] : null;

  const decide = (choice) => {
    if (!selected || decided) return;
    const next = { ...decisionsRef.current, [selected.id]: { choice, responseSec: elapsed - selected.at } };
    decisionsRef.current = next;
    setDecisions(next);
    spend(cfg.perChoice);
    playCue('tick', settings.sound);
  };

  const runQuery = (q) => {
    if (!selected || ran[`${selected.id}:${q.cmd}`]) return;
    setRan((r) => ({ ...r, [`${selected.id}:${q.cmd}`]: true }));
    setTermLines((t) => ({ ...t, [selected.id]: [...(t[selected.id] || []), { cmd: q.cmd, out: q.out }] }));
    spend(cfg.perQuery);
  };

  const submitTyped = (e) => {
    e.preventDefault();
    if (!selected) return;
    const text = typed.trim();
    setTyped('');
    if (!text) return;
    const q = selected.queries.find((x) => x.cmd === text);
    if (q) { runQuery(q); return; }
    const hint = text === 'help' ? 'available' : 'unknown query';
    setTermLines((t) => ({ ...t, [selected.id]: [...(t[selected.id] || []), { cmd: text, out: [`${hint}: ${selected.queries.map((x) => x.cmd).join(' | ')}`] }] }));
  };

  const stressed = focus < cfg.lowMark;
  return (
    <SimShell scan={settings.scan} stressed={stressed}>
      <TopBar items={[
        { text: `HACKING HUB // SOC-01 // ${pack.title}` },
        { text: `Clock ${fmtClock(pack.durationSec - elapsed)}`, tone: pack.durationSec - elapsed <= 60 ? 'warn' : '' },
        { text: `Queue ${unresolvedCount}`, tone: unresolvedCount >= cfg.backlogThreshold ? 'bad' : '' },
        { text: `Focus ${Math.round(focus)}%`, tone: stressed ? 'bad' : '' },
      ]} />
      <div className="sim-body sim-grid-a">
        <div className="s-pane">
          <span className="s-h">Alert queue ({visible.length})</span>
          {visible.length === 0 && <div className="s-dim">Quiet. Waiting for the first alert...</div>}
          {visible.map((e) => (
            <button key={e.id} className={`s-row${selected?.id === e.id ? ' on' : ''}${decisions[e.id] ? ' done' : ''}`} onClick={() => setSelectedId(e.id)}>
              <span className={`sv ${e.severity}`}>{SEV_LABEL[e.severity]}</span>
              <span className="t">{e.source}: {e.summary}</span>
              {decisions[e.id] && <span className="s-gr">done</span>}
            </button>
          ))}
        </div>

        <div className="s-pane sel">
          {selected ? (
            <>
              <span className="s-h">Evidence // {selected.id}</span>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>{selected.summary}</h3>
              <div className="s-log">{selected.lines.map((l, i) => <div key={i}>{l}</div>)}</div>
              <div className="s-dim" style={{ marginTop: 6 }}>{selected.context.map((c, i) => <div key={i}>{c}</div>)}</div>
              <div className="s-btns" role="group" aria-label="Decision">
                {CHOICES.map((c) => (
                  <button key={c} className={`s-btn${c === 'escalate' ? ' bad' : c === 'contain' ? ' warn' : c === 'tune_rule' ? ' cy' : ''}`} disabled={!!decided} onClick={() => decide(c)}>
                    {CHOICE_LABELS[c]}
                  </button>
                ))}
              </div>
              {decided && <div className="s-gr" style={{ marginTop: 8 }}>Logged: {CHOICE_LABELS[decided.choice]}. Results appear in the shift debrief.</div>}
              <div className="s-term">
                <span className="s-h">Terminal</span>
                <div className="s-log s-term-out" aria-live="polite">
                  {(termLines[selected.id] || []).length === 0 && <div className="s-dim">No queries run. Each query costs {cfg.perQuery} focus.</div>}
                  {(termLines[selected.id] || []).map((t, i) => (
                    <div key={i}><span className="s-gr">$</span> {t.cmd}{t.out.map((o, j) => <div key={j} className="s-dim">&nbsp;&nbsp;{o}</div>)}</div>
                  ))}
                </div>
                <div className="s-chips">
                  {selected.queries.map((q) => (
                    <button key={q.cmd} className="s-chip" disabled={!!ran[`${selected.id}:${q.cmd}`]} onClick={() => runQuery(q)}>{q.cmd}</button>
                  ))}
                </div>
                <form className="s-term-in" onSubmit={submitTyped}>
                  <span className="s-gr">$</span>
                  <input id="sim-soc-query" aria-label="Query" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="type a query or help" autoComplete="off" />
                </form>
              </div>
            </>
          ) : <div className="s-dim">Select an alert.</div>}
        </div>

        <div className="s-pane">
          <span className="s-h">Desk status</span>
          <Meter label="Focus" value={focus} color={stressed ? 'var(--s-mag)' : 'var(--s-green)'} />
          <div className="s-dim">Resolved {Object.keys(decisions).length} of {pack.events.length}</div>
          {stressed && <p className="s-mag" style={{ marginTop: 8 }}>Focus is low. Details blur and you start missing things. Clear the queue.</p>}
          <div className="s-btns"><button className="s-btn warn" onClick={finish}>Clock out now</button></div>
          <p style={{ marginTop: 10 }}>Clocking out early leaves any open alerts unresolved, and those count as missed.</p>
        </div>
      </div>
    </SimShell>
  );
}
