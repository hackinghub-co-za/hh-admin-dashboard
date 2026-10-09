import { CHOICE_LABELS, FLAG_TEXT } from '../../data/sim/packs';
import { SimShell, TopBar } from './SimParts';

const VERDICT_TEXT = { best: 'Best call', ok: 'Acceptable', wrong: 'Wrong call', missed: 'Missed' };

function Triage({ act, result }) {
  const byId = Object.fromEntries(act.pack.events.map((e) => [e.id, e]));
  return (
    <div className="s-pane">
      <span className="s-h">Shift review</span>
      {result.perEvent.map((p) => (
        <div key={p.id} className="debrief-item">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`verdict ${p.verdict}`}>{VERDICT_TEXT[p.verdict]}</span>
            <b style={{ color: 'var(--s-fg)' }}>{byId[p.id].summary || byId[p.id].title}</b>
          </div>
          <div className="s-dim">
            You: {p.choice ? CHOICE_LABELS[p.choice] : 'no decision'}
            {p.verdict !== 'best' && <> &middot; Best: {p.best.map((b) => CHOICE_LABELS[b]).join(' or ')}</>}
          </div>
          <p>{p.debrief}</p>
        </div>
      ))}
      {result.meters && <div className="s-dim">Final velocity {Math.round(result.meters.velocity)} &middot; security debt {Math.round(result.meters.debt)}</div>}
      {result.focusPenalty > 0 && <div className="s-am">Low focus at the end cost you {result.focusPenalty} points.</div>}
    </div>
  );
}

function RedTeam({ result, extra, notes }) {
  const run = extra.run;
  return (
    <div className="s-pane">
      <span className="s-h">Engagement review</span>
      <p>
        {run.outOfScope ? 'You touched a system outside the rules of engagement, so the engagement was ended. Authorisation is part of the job.'
          : run.objective ? `You reached the customer database and pulled data with ${Math.round(run.detection)}% detection.`
          : run.burned ? 'The defenders detected you before you reached the objective.'
          : 'You stood down before reaching the objective.'}
      </p>
      {notes.length > 0 && (
        <>
          <span className="s-h" style={{ marginTop: 10 }}>How your earlier choices shaped this</span>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{notes.map((n, i) => <li key={i} className="s-dim">{n}</li>)}</ul>
        </>
      )}
      {notes.length === 0 && <p className="s-gr">Clean hands in Acts I and II meant no easy routes, so every step had to be earned.</p>}
      {result.omitted.length > 0 && <p className="s-mag">You left {result.omitted.length} finding(s) out of the report. They stay unfixed and will come back in Act IV.</p>}
    </div>
  );
}

function Board({ act, result, extra, provider }) {
  const pack = act.pack;
  const titleOf = Object.fromEntries(pack.risks.map((r) => [r.id, r.title]));
  const audit = provider.auditFeedback(pack, extra.audit);
  const board = extra.board ? provider.boardFeedback(pack, extra.board) : null;
  return (
    <div className="s-pane">
      <span className="s-h">Board review</span>
      {result.perRisk.map((r) => (
        <div key={r.id} className="debrief-item">
          <b style={{ color: 'var(--s-fg)' }}>{titleOf[r.id]}</b>
          <div className="s-dim">You placed L{r.placed?.l ?? '-'} I{r.placed?.i ?? '-'} &middot; evidence says L{r.truth.l} I{r.truth.i}</div>
        </div>
      ))}
      <div className="debrief-item">
        <b style={{ color: 'var(--s-fg)' }}>Budget</b>
        <div className="s-dim">Spent {result.spent}. Controls cut total risk by {Math.round(result.reduction * 100)}% (target 50%).</div>
      </div>
      <div className="debrief-item">
        <span className={`verdict ${audit.quality}`}>{VERDICT_TEXT[audit.quality]}</span> <b style={{ color: 'var(--s-fg)' }}>Audit answer</b>
        <p>{audit.text}</p>
      </div>
      {board && (
        <div className="debrief-item">
          <span className={`verdict ${board.quality}`}>{VERDICT_TEXT[board.quality]}</span> <b style={{ color: 'var(--s-fg)' }}>Board briefing</b>
          <p>{board.text}</p>
        </div>
      )}
    </div>
  );
}

export default function Debrief({ act, result, extra, provider, careerFlags, isFirst, passMark, nextAct, onMap, onRetry, onNext, settings }) {
  const passed = result.score >= passMark;
  const credits = Math.round(result.score * 0.4);
  const notes = act.id === 'redteam' ? provider.flagNotes(act.pack, careerFlags) : [];
  return (
    <SimShell scan={settings.scan}>
      <TopBar items={[{ text: `DEBRIEF // ${act.role}` }, { text: act.pack.title }, { text: passed ? 'Passed' : 'Not passed', tone: passed ? '' : 'bad' }]} />
      <div className="sim-body">
        <div className="s-pane" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={`grade ${result.grade}`}>{result.grade}</div>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>{result.score} / 100</h2>
            <p style={{ margin: 0 }}>{passed ? `Pass mark is ${passMark}. ${nextAct ? 'The next act is unlocked.' : 'Career complete.'}` : `Pass mark is ${passMark}. Replay to improve; your first attempt's consequences stay.`}</p>
            <p style={{ margin: 0 }} className="s-gr">Credits banked for this act: {credits} (your best score counts)</p>
          </div>
        </div>

        {act.id === 'redteam' ? <RedTeam result={result} extra={extra} notes={notes} />
          : act.id === 'grc' ? <Board act={act} result={result} extra={extra} provider={provider} />
          : <Triage act={act} result={result} />}

        {result.flags.length > 0 && (
          <div className="s-pane hot">
            <span className="s-h">{isFirst ? 'Consequences carried forward' : 'Consequences (from your first attempt, unchanged)'}</span>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{result.flags.map((f) => <li key={f} className="s-mag">{FLAG_TEXT[f] || f}</li>)}</ul>
          </div>
        )}

        <div className="s-btns">
          <button className="s-btn" onClick={onMap}>Career map</button>
          <button className="s-btn cy" onClick={onRetry}>Replay shift</button>
          {passed && nextAct && <button className="s-btn solid" onClick={onNext}>Next: {nextAct.role}</button>}
        </div>
      </div>
    </SimShell>
  );
}
