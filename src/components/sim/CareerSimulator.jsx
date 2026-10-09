import { useState, useEffect } from 'react';
import './sim.css';
import { SIM_ACTS, FLAG_TEXT } from '../../data/sim/packs';
import { applyResult, deriveCareer, emptyCareer, visibleRisks, boardEventVisible, PASS_MARK, CREDITS_PER_SCORE } from '../../lib/simEngine';
import { loadCareer, saveCareer, clearCareer } from '../../lib/simCareer';
import { playCue } from '../../lib/simAudio';
import { SimShell, TopBar } from './SimParts';
import ShiftSoc from './ShiftSoc';
import ShiftPipeline from './ShiftPipeline';
import ShiftRedTeam from './ShiftRedTeam';
import ShiftBoard from './ShiftBoard';
import Debrief from './Debrief';

export default function CareerSimulator({ email, onExit }) {
  const [provider, setProvider] = useState(null);
  const [career, setCareer] = useState(() => loadCareer(email));
  const [view, setView] = useState({ name: 'map' });
  const [runKey, setRunKey] = useState(0);
  const [settings, setSettings] = useState({ sound: false, scan: true });
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let live = true;
    import('../../lib/simProvider').then((m) => { if (live) setProvider(m.simProvider); });
    return () => { live = false; };
  }, []);

  const derived = deriveCareer(career, SIM_ACTS);
  const actById = (id) => SIM_ACTS.find((a) => a.id === id);

  const start = (actId) => { setRunKey((k) => k + 1); setView({ name: 'brief', actId }); };
  const begin = (actId) => { playCue('boot', settings.sound); setRunKey((k) => k + 1); setView({ name: 'play', actId }); };

  const complete = (act, result, extra) => {
    const isFirst = !career.results[act.id];
    const next = applyResult(career, act, result);
    setCareer(next);
    saveCareer(email, next);
    playCue(result.score >= PASS_MARK ? 'good' : 'bad', settings.sound);
    setView({ name: 'debrief', actId: act.id, result, extra: extra || {}, isFirst });
  };

  const reset = () => { clearCareer(email); setCareer(emptyCareer()); setConfirmReset(false); setView({ name: 'map' }); };

  const toolbar = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={onExit}>Back to Labs</button>
      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} aria-pressed={settings.sound} onClick={() => setSettings((s) => ({ ...s, sound: !s.sound }))}>Sound: {settings.sound ? 'on' : 'off'}</button>
      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} aria-pressed={settings.scan} onClick={() => setSettings((s) => ({ ...s, scan: !s.scan }))}>Scanlines: {settings.scan ? 'on' : 'off'}</button>
    </div>
  );

  if (!provider) {
    return <div>{toolbar}<SimShell scan={settings.scan}><div className="sim-intro"><span className="sim-tag">Booting</span><p>Loading workstation...</p></div></SimShell></div>;
  }

  if (view.name === 'brief') {
    const act = actById(view.actId);
    return (
      <div>{toolbar}
        <SimShell scan={settings.scan}>
          <TopBar items={[{ text: `ACT ${act.order} // ${act.role}` }, { text: act.pack.title }]} />
          <div className="sim-intro">
            <span className="sim-tag">Briefing</span>
            <h2>{act.pack.title}</h2>
            <p>{act.pack.briefing}</p>
            {act.pack.durationSec && <p className="s-am">Shift length: {Math.round(act.pack.durationSec / 60)} minutes. The clock starts when you press start.</p>}
            <div className="s-btns">
              <button className="s-btn solid" onClick={() => begin(act.id)}>Start shift</button>
              <button className="s-btn" onClick={() => setView({ name: 'map' })}>Back</button>
            </div>
          </div>
        </SimShell>
      </div>
    );
  }

  if (view.name === 'play') {
    const act = actById(view.actId);
    const common = { pack: act.pack, provider, settings };
    const flags = derived.flags;
    let screen;
    if (act.id === 'soc') screen = <ShiftSoc key={runKey} {...common} onFinish={(r) => complete(act, r)} />;
    else if (act.id === 'devsecops') screen = <ShiftPipeline key={runKey} {...common} onFinish={(r) => complete(act, r)} />;
    else if (act.id === 'redteam') screen = <ShiftRedTeam key={runKey} {...common} flags={flags} onFinish={(r, x) => complete(act, r, x)} />;
    else {
      const otherCredits = Object.entries(career.results).filter(([id]) => id !== 'grc').reduce((s, [, r]) => s + Math.round(r.best * CREDITS_PER_SCORE), 0);
      screen = (
        <ShiftBoard key={runKey} {...common} flags={flags} risks={visibleRisks(act.pack, flags)} credits={act.pack.baseCredits + otherCredits}
          hasBoard={boardEventVisible(act.pack, flags)} onFinish={(r, x) => complete(act, r, x)} />
      );
    }
    return <div>{toolbar}{screen}</div>;
  }

  if (view.name === 'debrief') {
    const act = actById(view.actId);
    const next = SIM_ACTS.find((a) => a.order === act.order + 1);
    return (
      <div>{toolbar}
        <Debrief act={act} result={view.result} extra={view.extra} provider={provider} careerFlags={derived.flags} isFirst={view.isFirst}
          passMark={PASS_MARK} nextAct={next} settings={settings}
          onMap={() => setView({ name: 'map' })} onRetry={() => start(act.id)} onNext={() => start(next.id)} />
      </div>
    );
  }

  return (
    <div>{toolbar}
      <SimShell scan={settings.scan}>
        <TopBar items={[{ text: 'HACKING HUB // CAREER SIMULATOR' }, { text: `Trust ${derived.trust}` }, { text: `Credits ${derived.credits}` }, { text: `Consequences ${derived.flags.length}`, tone: derived.flags.length ? 'warn' : '' }]} />
        <div className="sim-intro" style={{ maxWidth: 'none' }}>
          <span className="sim-tag">Preview build</span>
          <h2>Four roles. One career. Every call follows you.</h2>
          <p>Work a SOC desk, a DevSecOps pipeline, a red team engagement and a CISO board room. Choices you make early come back later. Pass an act (60 or more) to unlock the next. Progress is saved in this browser.</p>
          <div className="act-map">
            {SIM_ACTS.map((a) => {
              const res = career.results[a.id];
              const locked = a.order > derived.unlocked;
              return (
                <div key={a.id} className={`act-card${locked ? ' locked' : ''}`}>
                  <div className="s-dim">ACT {a.order}</div>
                  <h3>{a.role}</h3>
                  <p style={{ margin: '0 0 8px' }}>{a.tagline}</p>
                  {res ? <div className="s-gr">Best {res.best} ({res.grade}) &middot; {res.attempts} attempt{res.attempts === 1 ? '' : 's'}{res.passed ? ' · passed' : ''}</div> : <div className="s-dim">{locked ? 'Locked: pass the previous act' : 'Not played'}</div>}
                  <div className="s-btns"><button className="s-btn solid" disabled={locked} onClick={() => start(a.id)}>{res ? 'Replay' : 'Start'}</button></div>
                </div>
              );
            })}
          </div>
          {derived.flags.length > 0 && (
            <div className="s-pane hot">
              <span className="s-h">Consequences waiting for you</span>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{derived.flags.map((f) => <li key={f} className="s-mag">{FLAG_TEXT[f] || f}</li>)}</ul>
            </div>
          )}
          {derived.complete && (
            <div className="s-pane sel" style={{ marginTop: 10 }}>
              <span className="s-h">Career complete</span>
              <p style={{ margin: 0 }}>You finished all four acts with a trust rating of {derived.trust} and {derived.credits} credits banked. The consequences above are what your choices left behind.</p>
            </div>
          )}
          <div className="s-btns">
            {!confirmReset
              ? <button className="s-btn" onClick={() => setConfirmReset(true)}>Reset career</button>
              : <><button className="s-btn bad" onClick={reset}>Confirm reset</button><button className="s-btn" onClick={() => setConfirmReset(false)}>Cancel</button></>}
          </div>
        </div>
      </SimShell>
    </div>
  );
}
