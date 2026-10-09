import { useState } from 'react';
import { SimShell, TopBar } from './SimParts';

const cellClass = (l, i) => { const p = l * i; return p >= 15 ? 'r' : p >= 10 ? 'o' : p >= 5 ? 'a' : 'g'; };
const STEPS = ['Risk matrix', 'Budget', 'Audit', 'Board'];

export default function ShiftBoard({ pack, provider, flags, risks, credits, hasBoard, settings, onFinish }) {
  const [step, setStep] = useState(0);
  const [placements, setPlacements] = useState({});
  const [activeRisk, setActiveRisk] = useState(risks[0].id);
  const [alloc, setAlloc] = useState({});
  const [audit, setAudit] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');

  const spent = pack.controls.reduce((s, c) => s + (alloc[c.id] || 0), 0);
  const lastStep = hasBoard ? 3 : 2;
  const placedAll = risks.every((r) => placements[r.id]);

  const canNext = step === 0 ? placedAll : step === 1 ? spent <= credits : step === 2 ? !!audit : !!board;

  const submit = () => {
    const r = provider.evaluateBoard(pack, flags, credits, { placements, alloc, audit, board });
    if (r.error) { setError(r.error); return; }
    onFinish(r, { placements, alloc, audit, board });
  };

  return (
    <SimShell scan={settings.scan}>
      <TopBar items={[
        { text: `HACKING HUB // BOARD ROOM // ${pack.title}` },
        { text: `Step ${step + 1}: ${STEPS[step]}` },
        { text: `Budget ${spent}/${credits}`, tone: spent > credits ? 'bad' : '' },
      ]} />
      <div className="sim-body">
        {step === 0 && (
          <div className="sim-grid-b" style={{ display: 'grid', gap: 10 }}>
            <div className="s-pane">
              <span className="s-h">Risk register ({risks.filter((r) => placements[r.id]).length}/{risks.length} placed)</span>
              {risks.map((r, idx) => (
                <button key={r.id} className={`s-row${activeRisk === r.id ? ' on' : ''}`} onClick={() => setActiveRisk(r.id)}>
                  <span className="sv low">{idx + 1}</span>
                  <span className="t">{r.title}<br /><span className="s-dim">{r.detail}</span></span>
                  {placements[r.id] && <span className="s-gr">L{placements[r.id].l} I{placements[r.id].i}</span>}
                </button>
              ))}
            </div>
            <div className="s-pane sel">
              <span className="s-h">Place risk {risks.findIndex((r) => r.id === activeRisk) + 1}: likelihood across, impact up</span>
              <div className="s-matrix">
                {[5, 4, 3, 2, 1].map((i) => (
                  <div key={`row${i}`} style={{ display: 'contents' }}>
                    <div className="ax">{i}</div>
                    {[1, 2, 3, 4, 5].map((l) => {
                      const here = risks.map((r, idx) => ({ r, idx })).filter(({ r }) => placements[r.id]?.l === l && placements[r.id]?.i === i);
                      return (
                        <button key={l} className={`${cellClass(l, i)}${placements[activeRisk]?.l === l && placements[activeRisk]?.i === i ? ' pick' : ''}`}
                          aria-label={`Likelihood ${l} (${pack.scale[l - 1].likelihood}), impact ${i} (${pack.scale[i - 1].impact})`}
                          onClick={() => setPlacements((p) => ({ ...p, [activeRisk]: { l, i } }))}>
                          {here.map(({ idx }) => <b key={idx}>{idx + 1}</b>)}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <div className="ax" />
                {[1, 2, 3, 4, 5].map((l) => <div key={l} className="ax">{l}</div>)}
              </div>
              <p style={{ marginTop: 10 }}>Likelihood: 1 rare to 5 almost certain. Impact: 1 negligible to 5 severe. Use the evidence in each risk.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="s-pane">
            <span className="s-h">Allocate {credits} credits</span>
            <p>Each control cuts the risks it covers, up to 60%, when fully funded. Spending too little leaves risk on the table. You cannot overspend.</p>
            {pack.controls.map((c) => (
              <div key={c.id} style={{ marginBottom: 14 }}>
                <label htmlFor={`alloc-${c.id}`}><b style={{ color: 'var(--s-fg)' }}>{c.name}</b> <span className="s-cy">{alloc[c.id] || 0} / {c.max}</span></label>
                <div className="s-dim">{c.detail}</div>
                <input id={`alloc-${c.id}`} className="s-range" type="range" min="0" max={c.max} step="5" value={alloc[c.id] || 0}
                  onChange={(e) => setAlloc((a) => ({ ...a, [c.id]: Number(e.target.value) }))} />
              </div>
            ))}
            <div className={spent > credits ? 's-mag' : 's-gr'}>{spent > credits ? `Over budget by ${spent - credits}` : `${credits - spent} credits unspent`}</div>
          </div>
        )}

        {step === 2 && (
          <div className="s-pane hot">
            <span className="s-h">Audit question // {pack.audit.framework} {pack.audit.clause}</span>
            <h3 style={{ fontSize: '1rem' }}>{pack.audit.question}</h3>
            {pack.audit.options.map((o) => (
              <button key={o.id} className={`s-opt${audit === o.id ? ' on' : ''}`} onClick={() => setAudit(o.id)}>{o.text}</button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="s-pane hot">
            <span className="s-h">{pack.boardEvent.title}</span>
            <h3 style={{ fontSize: '1rem' }}>{pack.boardEvent.question}</h3>
            {pack.boardEvent.options.map((o) => (
              <button key={o.id} className={`s-opt${board === o.id ? ' on' : ''}`} onClick={() => setBoard(o.id)}>{o.text}</button>
            ))}
          </div>
        )}

        {error && <div className="s-mag">{error}</div>}
        <div className="s-btns">
          {step > 0 && <button className="s-btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < lastStep
            ? <button className="s-btn solid" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>
            : <button className="s-btn solid" disabled={!canNext} onClick={submit}>Submit to the board</button>}
        </div>
      </div>
    </SimShell>
  );
}
