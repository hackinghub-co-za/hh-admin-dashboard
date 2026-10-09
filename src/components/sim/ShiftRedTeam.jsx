import { useRef, useState } from 'react';
import { playCue } from '../../lib/simAudio';
import { SimShell, TopBar, Meter } from './SimParts';
import { useShiftClock, fmtClock } from './useShiftClock';

const TAG_TEXT = { public_vuln: 'exploitable web service', weak_creds: 'working credentials', remote_svc: 'open remote service' };

export default function ShiftRedTeam({ pack, provider, flags, settings, onFinish }) {
  const [compromised, setCompromised] = useState(['internet']);
  const [revealed, setRevealed] = useState({});
  const [detection, setDetection] = useState(0);
  const [log, setLog] = useState([{ tone: 's-dim', text: 'Foothold: the open Internet. Pick a technique and a target next to something you control.' }]);
  const [tech, setTech] = useState(null);
  const [target, setTarget] = useState(null);
  const [findings, setFindings] = useState([]);
  const [phase, setPhase] = useState('play');
  const [outcome, setOutcome] = useState({ objective: false, burned: false, outOfScope: false });
  const [reported, setReported] = useState({});
  const detectionRef = useRef(0);

  const toReport = (o) => { setOutcome(o); setPhase('report'); };
  const elapsed = useShiftClock({
    durationSec: pack.durationSec,
    running: phase === 'play',
    onEnd: () => toReport({ objective: false, burned: false, outOfScope: false }),
  });

  const addLog = (tone, text) => setLog((l) => [...l, { tone, text }]);

  const execute = () => {
    if (!tech || !target || phase !== 'play') return;
    const r = provider.resolveStep(pack, flags, tech, target, { compromised, revealed });
    if (r.kind === 'invalid') { addLog('s-am', r.message); return; }
    if (r.kind === 'out_of_scope') {
      addLog('s-mag', r.message);
      playCue('bad', settings.sound);
      toReport({ objective: false, burned: false, outOfScope: true });
      return;
    }
    const nextDet = Math.min(100, detectionRef.current + r.noise);
    detectionRef.current = nextDet;
    setDetection(nextDet);
    const name = pack.nodes.find((n) => n.id === r.node).name;
    if (r.kind === 'discovery') {
      setRevealed((v) => ({ ...v, [r.node]: r.reveals }));
      addLog('s-cy', `${r.message} Exposes: ${r.reveals.length ? r.reveals.map((t) => TAG_TEXT[t]).join(', ') : 'nothing useful'}. +${r.noise} noise.`);
    } else if (r.kind === 'success') {
      setCompromised((c) => [...c, r.node]);
      setFindings((f) => (f.some((x) => x.node === r.node) ? f : [...f, { node: r.node, tag: r.finding, name }]));
      addLog('s-gr', `${r.message} +${r.noise} noise.`);
      playCue('good', settings.sound);
    } else if (r.kind === 'objective') {
      addLog('s-gr', `${r.message} +${r.noise} noise.`);
      playCue('good', settings.sound);
      toReport({ objective: true, burned: false, outOfScope: false });
      return;
    } else {
      addLog('s-am', `${r.message} +${r.noise} noise.`);
      playCue('bad', settings.sound);
    }
    if (nextDet >= pack.detectionLimit) {
      addLog('s-mag', 'Detected. The defenders have shut you out. Engagement burned.');
      toReport({ objective: false, burned: true, outOfScope: false });
    }
    setTarget(null);
  };

  const uniqueFindings = findings.filter((f, i) => findings.findIndex((x) => x.node === f.node) === i);

  const finishReport = () => {
    const rep = Object.fromEntries(uniqueFindings.map((f) => [f.node, reported[f.node] !== false]));
    const run = { ...outcome, detection: detectionRef.current, findings: uniqueFindings, reported: rep };
    onFinish(provider.evaluateEngagement(pack, run), { run });
  };

  const nodeById = (id) => pack.nodes.find((n) => n.id === id);
  const nodeFill = (n) => (compromised.includes(n.id) ? '#17382b' : '#161830');
  const nodeStroke = (n) => (!n.inScope ? '#f59e0b' : target === n.id ? '#38d6f5' : compromised.includes(n.id) ? '#5ee37a' : '#3a4280');
  const stressed = detection >= 70;

  if (phase === 'report') {
    return (
      <SimShell scan={settings.scan}>
        <TopBar items={[{ text: 'HACKING HUB // ENGAGEMENT REPORT' }, { text: `Detection ${Math.round(detection)}%` }]} />
        <div className="sim-intro">
          <span className="sim-tag">{outcome.objective ? 'Objective reached' : outcome.outOfScope ? 'Out of scope' : outcome.burned ? 'Burned' : 'Stood down'}</span>
          <h2>Write the report</h2>
          <p>Choose which findings go to the client. Anything you leave out stays unfixed.</p>
          {uniqueFindings.length === 0 && <p>No weaknesses were exploited, so there is nothing to report.</p>}
          {uniqueFindings.map((f) => (
            <label key={f.node} className="s-pane" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" id={`rep-${f.node}`} checked={reported[f.node] !== false} onChange={(e) => setReported((r) => ({ ...r, [f.node]: e.target.checked }))} />
              <span><b style={{ color: 'var(--s-fg)' }}>{f.name}</b><br /><span className="s-dim">{pack.findingLabels[f.tag]}</span></span>
            </label>
          ))}
          <div className="s-btns"><button className="s-btn solid" onClick={finishReport}>Submit report</button></div>
        </div>
      </SimShell>
    );
  }

  return (
    <SimShell scan={settings.scan} stressed={stressed}>
      <TopBar items={[
        { text: `HACKING HUB // ${pack.title}` },
        { text: `Engagement ${fmtClock(pack.durationSec - elapsed)}` },
        { text: `Detection ${Math.round(detection)}%`, tone: detection >= 60 ? 'bad' : detection >= 35 ? 'warn' : '' },
      ]} />
      <div className="sim-body sim-grid-b">
        <div className="s-pane">
          <span className="s-h">Target network // objective: {pack.objective}</span>
          <svg className="s-map" viewBox="0 0 640 300" role="group" aria-label="Network map">
            <rect x="0" y="0" width="640" height="300" fill="#10122a" />
            {pack.edges.map(([a, b]) => {
              const A = nodeById(a); const B = nodeById(b);
              const chain = compromised.includes(a) && compromised.includes(b);
              return <line key={a + b} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={chain ? '#ff5c9a' : '#2a3060'} strokeWidth={chain ? 2.4 : 1.4} strokeDasharray={chain ? '6 4' : undefined} />;
            })}
            {pack.nodes.map((n) => (
              <g key={n.id} className="node" role="button" tabIndex={0} aria-label={`${n.name}${n.inScope ? '' : ', out of scope'}`}
                onClick={() => setTarget(n.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTarget(n.id); } }}>
                <rect x={n.x - 47} y={n.y - 18} width="94" height="36" rx="6" fill={nodeFill(n)} stroke={nodeStroke(n)} strokeWidth={target === n.id ? 2.4 : 1.4} strokeDasharray={n.inScope ? undefined : '4 3'} />
                <text x={n.x} y={n.y + 4} textAnchor="middle">{n.name}</text>
                {revealed[n.id] && <text x={n.x} y={n.y + 32} textAnchor="middle" style={{ fill: '#38d6f5', fontSize: '9px' }}>{revealed[n.id].length ? revealed[n.id].map((t) => TAG_TEXT[t]).join(', ') : 'nothing exposed'}</text>}
                {!n.inScope && <text x={n.x} y={n.y - 24} textAnchor="middle" style={{ fill: '#f59e0b', fontSize: '9px' }}>OUT OF SCOPE</text>}
              </g>
            ))}
          </svg>
          <div className="s-dim" style={{ marginTop: 6 }}>Green: yours. Dashed pink: your chain. Cyan outline: current target.</div>
          <div className="s-log" style={{ marginTop: 10, maxHeight: 150, overflowY: 'auto' }} aria-live="polite">
            {log.map((l, i) => <div key={i} className={l.tone}>{l.text}</div>)}
          </div>
        </div>

        <div className="s-pane sel">
          <span className="s-h">Technique cards</span>
          {pack.techniques.map((t) => (
            <button key={t.id} className={`s-row${tech === t.id ? ' on' : ''}`} onClick={() => setTech(t.id)} title={t.blurb}>
              <span className="sv low">{t.id}</span>
              <span className="t">{t.name}<br /><span className="s-dim">{t.tactic}</span></span>
            </button>
          ))}
          {tech && <p style={{ marginTop: 8 }}>{pack.techniques.find((t) => t.id === tech).blurb}</p>}
          <div className="s-dim" style={{ margin: '8px 0' }}>Target: {target ? nodeById(target).name : 'none selected'}</div>
          <Meter label="Detection" value={detection} color="var(--s-mag)" />
          <div className="s-btns">
            <button className="s-btn solid" disabled={!tech || !target} onClick={execute}>Execute</button>
            <button className="s-btn warn" onClick={() => toReport({ objective: false, burned: false, outOfScope: false })}>Stand down</button>
          </div>
          <p style={{ marginTop: 10 }}>Rules of engagement: the payroll system is out of scope.</p>
        </div>
      </div>
    </SimShell>
  );
}
