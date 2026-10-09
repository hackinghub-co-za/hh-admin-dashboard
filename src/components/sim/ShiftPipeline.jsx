import { useRef, useState } from 'react';
import { CHOICE_LABELS } from '../../data/sim/packs';
import { playCue } from '../../lib/simAudio';
import { SimShell, TopBar, Meter } from './SimParts';
import { useShiftClock, fmtClock } from './useShiftClock';

const CHOICES = ['block', 'fix_now', 'allow_with_ticket', 'suppress_as_fp'];

export default function ShiftPipeline({ pack, provider, settings, onFinish }) {
  const [decisions, setDecisions] = useState({});
  const [selectedId, setSelectedId] = useState(pack.events[0].id);
  const [done, setDone] = useState(false);
  const decisionsRef = useRef({});

  const finish = () => {
    if (done) return;
    setDone(true);
    onFinish(provider.evaluateTriage(pack, decisionsRef.current, {}));
  };
  const elapsed = useShiftClock({ durationSec: pack.durationSec, running: !done, onEnd: finish });

  let velocity = pack.meters.velocity;
  let debt = pack.meters.debt;
  for (const d of Object.values(decisions)) {
    const m = provider.meterEffect(pack.id, d.choice);
    velocity += m.velocity;
    debt += m.debt;
  }
  velocity = Math.max(0, Math.min(100, velocity));
  debt = Math.max(0, Math.min(100, debt));

  const selected = pack.events.find((e) => e.id === selectedId);
  const decided = decisions[selected.id];
  const decide = (choice) => {
    if (decided) return;
    const next = { ...decisionsRef.current, [selected.id]: { choice, responseSec: elapsed } };
    decisionsRef.current = next;
    setDecisions(next);
    playCue('tick', settings.sound);
  };

  return (
    <SimShell scan={settings.scan}>
      <TopBar items={[
        { text: `HACKING HUB // PIPELINE // ${pack.title}` },
        { text: `Release train ${fmtClock(pack.durationSec - elapsed)}`, tone: pack.durationSec - elapsed <= 60 ? 'warn' : '' },
        { text: `Reviewed ${Object.keys(decisions).length}/${pack.events.length}` },
        { text: `Debt ${Math.round(debt)}`, tone: debt >= 60 ? 'bad' : '' },
      ]} />
      <div className="sim-body sim-grid-b">
        <div className="s-pane sel">
          <span className="s-h">{selected.repo} // {selected.title} // {selected.author}</span>
          {selected.diff.map((f, i) => (
            <div key={i} className="s-diff">
              <div className="f">{f.file}</div>
              {f.lines.map((l, j) => <div key={j} className={`l ${l.t}`}>{l.s}</div>)}
            </div>
          ))}
          <div className="s-log">
            {selected.scanners.map((s, i) => <div key={i}><span className="s-cy">{s.tool}</span> {s.finding} <span className="s-dim">(confidence {s.confidence})</span></div>)}
            <div className="s-dim">Note: {selected.note}</div>
          </div>
          <div className="s-btns" role="group" aria-label="Decision">
            {CHOICES.map((c) => (
              <button key={c} className={`s-btn${c === 'block' ? ' bad' : c === 'fix_now' ? ' cy' : c === 'allow_with_ticket' ? ' warn' : ''}`} disabled={!!decided} onClick={() => decide(c)}>{CHOICE_LABELS[c]}</button>
            ))}
          </div>
          {decided && <div className="s-gr" style={{ marginTop: 8 }}>Logged: {CHOICE_LABELS[decided.choice]}. The meters moved. Whether it was right shows in the debrief.</div>}
        </div>

        <div className="s-pane">
          <span className="s-h">Pull requests</span>
          {pack.events.map((e) => (
            <button key={e.id} className={`s-row${selected.id === e.id ? ' on' : ''}${decisions[e.id] ? ' done' : ''}`} onClick={() => setSelectedId(e.id)}>
              <span className={`sv ${e.severity}`}>{e.scanners[0].tool}</span>
              <span className="t">{e.title}</span>
            </button>
          ))}
          <div style={{ marginTop: 12 }}>
            <Meter label="Velocity" value={velocity} color="var(--s-green)" />
            <Meter label="Security debt" value={debt} color="var(--s-mag)" />
          </div>
          <div className="s-btns"><button className="s-btn warn" onClick={finish}>Ship the train now</button></div>
          <p style={{ marginTop: 10 }}>Anything you have not reviewed ships unreviewed.</p>
        </div>
      </div>
    </SimShell>
  );
}
