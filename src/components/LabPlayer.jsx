import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Lock, Send, Clock, FlaskConical } from 'lucide-react';
import { saveLabProgress, submitLabAttempt, fetchLabDebrief } from '../lib/labsData';
import { fetchMyLabHelp } from '../lib/gemmaData';
import GemmaLabHelp from './gemma/GemmaLabHelp';
import { logPortalEvent } from '../lib/portalEventsData';
import { friendlyMemberErrorMessage } from '../lib/errorMessages';
import { RISK_SCALE, riskRating } from '../data/labs';
import { STATUS_BADGE, isTaskAnswered } from '../lib/labHelpers';

const AUTOSAVE_MS = 1200;
const SUBMITTED_STATES = ['Submitted', 'Approved', 'Needs Changes'];

const RATING_COLOR = { Low: 'var(--success)', Medium: 'var(--warning)', High: 'var(--warning)', Critical: 'var(--danger)' };

const wordCount = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;

export function EvidenceBlock({ block }) {
  switch (block.type) {
    case 'p':
      return <p style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{block.text}</p>;
    case 'note':
      return <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{block.text}</p>;
    case 'quote':
      return (
        <blockquote style={{ margin: 0, padding: '10px 14px', borderLeft: '3px solid var(--accent-cyan)', background: 'var(--bg-tertiary)', borderRadius: '0 var(--border-radius-sm) var(--border-radius-sm) 0', fontSize: '0.86rem', lineHeight: 1.55 }}>
          {block.text}
        </blockquote>
      );
    case 'list':
      return (
        <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.86rem', lineHeight: 1.55 }}>
          {block.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      );
    case 'table':
      return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                {block.columns.map((c) => (
                  <th key={c} style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, i) => (
                    <td key={i} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

const optionLabel = (list, id) => list?.find((o) => o.id === id)?.label || id;

function RiskScoreInput({ value, disabled, onChange }) {
  const likelihood = value?.likelihood;
  const impact = value?.impact;
  const score = likelihood && impact ? likelihood * impact : null;
  const rating = score ? riskRating(score) : null;
  const selectStyle = { minWidth: 0 };
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', flex: '1 1 160px' }}>
        Likelihood
        <select className="form-input" style={selectStyle} disabled={disabled} value={likelihood || ''} onChange={(e) => onChange({ ...value, likelihood: Number(e.target.value) || undefined })}>
          <option value="">Choose...</option>
          {RISK_SCALE.map((s) => <option key={s.value} value={s.value}>{s.value} · {s.likelihood}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', flex: '1 1 160px' }}>
        Impact
        <select className="form-input" style={selectStyle} disabled={disabled} value={impact || ''} onChange={(e) => onChange({ ...value, impact: Number(e.target.value) || undefined })}>
          <option value="">Choose...</option>
          {RISK_SCALE.map((s) => <option key={s.value} value={s.value}>{s.value} · {s.impact}</option>)}
        </select>
      </label>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', padding: '8px 0', minWidth: '130px' }}>
        {score ? (
          <span>Score {score}/25 · <span style={{ color: RATING_COLOR[rating], fontWeight: 700 }}>{rating}</span></span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Score: -</span>
        )}
      </div>
    </div>
  );
}

function TaskInput({ task, value, disabled, onChange }) {
  if (task.type === 'single') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {task.options.map((opt) => (
          <label key={opt.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.86rem', padding: '8px 10px', borderRadius: 'var(--border-radius-sm)', border: `1px solid ${value === opt.id ? 'var(--accent-cyan)' : 'var(--border-color)'}`, cursor: disabled ? 'default' : 'pointer' }}>
            <input type="radio" name={task.key} checked={value === opt.id} disabled={disabled} onChange={() => onChange(opt.id)} style={{ marginTop: '3px' }} />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }
  if (task.type === 'multi') {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (id) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {task.options.map((opt) => (
          <label key={opt.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.86rem', padding: '8px 10px', borderRadius: 'var(--border-radius-sm)', border: `1px solid ${selected.includes(opt.id) ? 'var(--accent-cyan)' : 'var(--border-color)'}`, cursor: disabled ? 'default' : 'pointer' }}>
            <input type="checkbox" checked={selected.includes(opt.id)} disabled={disabled} onChange={() => toggle(opt.id)} style={{ marginTop: '3px' }} />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }
  if (task.type === 'match') {
    const current = value && typeof value === 'object' ? value : {};
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {task.items.map((item) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.85rem' }}>{item.label}</span>
            <select className="form-input" aria-label={item.label} disabled={disabled} value={current[item.id] || ''} onChange={(e) => onChange({ ...current, [item.id]: e.target.value || undefined })}>
              <option value="">Choose...</option>
              {task.choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }
  if (task.type === 'risk_score') {
    return <RiskScoreInput value={value || {}} disabled={disabled} onChange={onChange} />;
  }
  if (task.type === 'rubric') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <textarea
          className="form-input"
          rows={10}
          disabled={disabled}
          placeholder={task.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontFamily: 'var(--font-sans)', lineHeight: 1.55, resize: 'vertical' }}
        />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'flex-end', fontFamily: 'var(--font-mono)' }}>{wordCount(value)} words</span>
      </div>
    );
  }
  return null;
}

export function RubricTable({ rubric, scores }) {
  if (!Array.isArray(rubric) || rubric.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr>
            {['Criterion', '0', '1', '2'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '7px 10px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rubric.map((row, i) => (
            <tr key={row.criterion}>
              <td style={{ padding: '7px 10px', fontWeight: 600, borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' }}>{row.criterion}</td>
              {row.levels.map((level, lvl) => {
                const picked = Array.isArray(scores) && scores[i] === lvl;
                return (
                  <td key={lvl} style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', verticalAlign: 'top', background: picked ? 'rgba(var(--accent-rgb), 0.12)' : undefined, fontWeight: picked ? 600 : 400 }}>{level}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaskDebrief({ task, given, debrief }) {
  if (!debrief) return null;
  const result = debrief.result;
  const answer = debrief.answer;
  return (
    <div style={{ marginTop: '12px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Debrief</span>
        {result && (
          <span className={`badge ${result.earned === result.max ? 'badge-success' : result.earned > 0 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
            {result.earned}/{result.max} pts
          </span>
        )}
      </div>

      {task.type === 'single' && answer && (
        <p style={{ fontSize: '0.84rem', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} /> {optionLabel(task.options, answer)}
        </p>
      )}
      {task.type === 'multi' && Array.isArray(answer) && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {task.options.map((opt) => {
            const correct = answer.includes(opt.id);
            const picked = Array.isArray(given) && given.includes(opt.id);
            if (!correct && !picked) return null;
            return (
              <li key={opt.id} style={{ fontSize: '0.82rem', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                {correct ? <CheckCircle2 size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} /> : <XCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                <span>{opt.label}{correct && !picked ? ' (you missed this)' : ''}{!correct && picked ? ' (not supported)' : ''}</span>
              </li>
            );
          })}
        </ul>
      )}
      {task.type === 'match' && answer && typeof answer === 'object' && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {task.items.map((item) => {
            const right = given?.[item.id] === answer[item.id];
            return (
              <li key={item.id} style={{ fontSize: '0.82rem', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                {right ? <CheckCircle2 size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} /> : <XCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                <span>{item.label}: <strong>{optionLabel(task.choices, answer[item.id])}</strong></span>
              </li>
            );
          })}
        </ul>
      )}
      {task.type === 'risk_score' && answer && (
        <p style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>Accepted score range: {answer.min} to {answer.max}</p>
      )}
      {task.type === 'rubric' && <RubricTable rubric={debrief.rubric} />}
      {debrief.model_answer && (
        <div style={{ fontSize: '0.84rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {task.type === 'rubric' && <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Model answer</div>}
          {debrief.model_answer}
        </div>
      )}
    </div>
  );
}

export default function LabPlayer({ lab, content, attempt, isMockSession, onBack, onAttemptChange }) {
  const [answers, setAnswers] = useState(attempt?.answers || {});
  const [saveState, setSaveState] = useState('idle');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(content.evidence[0]?.id);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [debrief, setDebrief] = useState(null);
  const [gemmaHelp, setGemmaHelp] = useState([]);
  const saveTimer = useRef(null);
  const pendingAnswers = useRef(null);
  const hasStarted = useRef(!!attempt);

  const status = attempt?.status || null;
  const isSubmitted = SUBMITTED_STATES.includes(status);
  const fullyLocked = status === 'Submitted' || status === 'Approved';
  const objectiveLocked = fullyLocked || (status === 'Needs Changes' && !!attempt?.taskResults);

  useEffect(() => {
    if (isMockSession) return;
    logPortalEvent('lab_opened', { lab: lab.slug }).catch(() => {});
  }, [lab.slug, isMockSession]);

  useEffect(() => {
    if (!isSubmitted || isMockSession) return;
    fetchLabDebrief(lab.id)
      .then(setDebrief)
      .catch((err) => setError(friendlyMemberErrorMessage(err)));
  }, [isSubmitted, isMockSession, lab.id, attempt?.submittedAt]);

  useEffect(() => {
    if (isMockSession) return;
    fetchMyLabHelp(lab.slug).then(setGemmaHelp).catch(() => {});
  }, [lab.slug, isMockSession]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const persist = async (next) => {
    pendingAnswers.current = null;
    if (isMockSession) {
      setSaveState('saved');
      if (!hasStarted.current) {
        hasStarted.current = true;
        onAttemptChange({ labId: lab.id, status: 'In Progress', answers: next });
      }
      return;
    }
    setSaveState('saving');
    try {
      await saveLabProgress(lab.id, next);
      setSaveState('saved');
      if (!hasStarted.current) {
        hasStarted.current = true;
        logPortalEvent('lab_started', { lab: lab.slug }).catch(() => {});
        onAttemptChange({ ...(attempt || {}), labId: lab.id, status: attempt?.status || 'In Progress', answers: next });
      }
    } catch (err) {
      setSaveState('error');
      setError(friendlyMemberErrorMessage(err));
    }
  };

  const updateAnswer = (key, value) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    setSaveState('pending');
    pendingAnswers.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next), AUTOSAVE_MS);
  };

  const handleBack = () => {
    clearTimeout(saveTimer.current);
    if (pendingAnswers.current) persist(pendingAnswers.current);
    onBack();
  };

  const answeredCount = content.tasks.filter((t) => isTaskAnswered(t, answers[t.key])).length;
  const allAnswered = answeredCount === content.tasks.length;

  const handleSubmit = async () => {
    clearTimeout(saveTimer.current);
    pendingAnswers.current = null;
    setSubmitting(true);
    setError(null);
    try {
      if (isMockSession) {
        onAttemptChange({ labId: lab.id, status: 'Submitted', answers, autoScore: null, autoMax: null, taskResults: null, submittedAt: new Date().toISOString() });
      } else {
        const graded = await submitLabAttempt(lab.id, answers);
        logPortalEvent('lab_submitted', { lab: lab.slug }).catch(() => {});
        onAttemptChange({ ...(attempt || {}), labId: lab.id, status: 'Submitted', answers, ...graded, submittedAt: new Date().toISOString() });
      }
      setConfirmingSubmit(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEvidence = content.evidence.find((e) => e.id === selectedEvidenceId) || content.evidence[0];
  const saveLabel = { pending: 'Unsaved changes', saving: 'Saving...', saved: 'Saved', error: 'Not saved' }[saveState];

  return (
    <div>
      <button onClick={handleBack} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', marginBottom: '20px' }}>
        <ArrowLeft size={14} /> All labs
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FlaskConical size={13} /> Hub Lab · {lab.track} · {lab.difficulty}{lab.estMinutes ? ` · ~${lab.estMinutes} min` : ''}
          </div>
          <h1 style={{ fontSize: '1.7rem', marginBottom: '4px' }}>{lab.title}</h1>
          {lab.roadmapItemTitle && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Practice for your roadmap item: {lab.roadmapItemTitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {status && <span className={`badge ${STATUS_BADGE[status]}`}>{status}</span>}
          {!fullyLocked && (
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: saveState === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}>
              {answeredCount}/{content.tasks.length} answered{saveLabel ? ` · ${saveLabel}` : ''}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: '16px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--danger-rgb), 0.1)', border: '1px solid rgba(var(--danger-rgb), 0.2)', color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</div>
      )}

      {isSubmitted && (
        <div className="glass-card" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px', border: `1px solid ${status === 'Needs Changes' ? 'var(--danger)' : 'var(--accent-cyan)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <h3 style={{ fontSize: '1rem' }}>
              {status === 'Approved' ? 'Approved. Nice work.' : status === 'Needs Changes' ? 'Your reviewer asked for changes' : 'Submitted for review'}
            </h3>
            {attempt?.autoScore != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                Auto-graded: {attempt.autoScore}/{attempt.autoMax}
              </span>
            )}
          </div>
          {status === 'Submitted' && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {isMockSession
                ? 'Mock Member: scoring and model answers only run on real accounts.'
                : 'Objective tasks are graded and the debrief is open below. A reviewer will score your written work against the rubric.'}
            </p>
          )}
          {status === 'Needs Changes' && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Update your written answer below and resubmit. Your graded answers stay as they were.</p>
          )}
          {attempt?.feedback && (
            <div style={{ fontSize: '0.86rem', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', whiteSpace: 'pre-wrap' }}>
              <strong>Reviewer feedback:</strong> {attempt.feedback}
            </div>
          )}
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>The brief · {content.organisation}</h3>
        {content.brief.map((block, i) => <EvidenceBlock key={i} block={block} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
        <div className="glass-card" style={{ position: 'sticky', top: '16px', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Evidence pack</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {content.evidence.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelectedEvidenceId(ev.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '6px 10px', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${ev.id === selectedEvidence?.id ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: ev.id === selectedEvidence?.id ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent', color: ev.id === selectedEvidence?.id ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontWeight: ev.id === selectedEvidence?.id ? 600 : 400 }}
              >
                <FileText size={12} /> {ev.title}
              </button>
            ))}
          </div>
          {selectedEvidence && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <h4 style={{ fontSize: '0.95rem', margin: 0 }}>{selectedEvidence.title}</h4>
              {selectedEvidence.body.map((block, i) => <EvidenceBlock key={i} block={block} />)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {content.tasks.map((task, idx) => {
            const disabled = fullyLocked || (task.type !== 'rubric' && objectiveLocked);
            return (
              <div key={task.key} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <h3 style={{ fontSize: '0.98rem' }}>Task {idx + 1}: {task.title}</h3>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {disabled && <Lock size={11} />}
                    {task.type === 'rubric' ? 'reviewed with a rubric' : `auto-graded · ${task.points} pts`}
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{task.prompt}</p>
                <TaskInput task={task} value={answers[task.key]} disabled={disabled} onChange={(v) => updateAnswer(task.key, v)} />
                {task.type !== 'rubric' && (!isSubmitted || debrief || isMockSession) && (
                  <GemmaLabHelp
                    labSlug={lab.slug}
                    content={content}
                    task={task}
                    mode={isSubmitted ? 'explain' : 'hint'}
                    help={gemmaHelp}
                    onHelpAdded={(h) => setGemmaHelp((prev) => [...prev, h])}
                    isMockSession={isMockSession}
                  />
                )}
                {isSubmitted && debrief && <TaskDebrief task={task} given={answers[task.key]} debrief={debrief[task.key]} />}
              </div>
            );
          })}

          {!fullyLocked && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!confirmingSubmit ? (
                <>
                  <button className="btn btn-primary" disabled={!allAnswered || submitting} onClick={() => setConfirmingSubmit(true)} style={{ alignSelf: 'flex-start' }}>
                    <Send size={14} /> {status === 'Needs Changes' ? 'Resubmit' : 'Submit lab'}
                  </button>
                  {!allAnswered && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} /> Answer all {content.tasks.length} tasks to submit. Your progress saves as you go.
                    </span>
                  )}
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.86rem' }}>
                    {status === 'Needs Changes'
                      ? 'Resubmit your updated written answer for review?'
                      : 'Submit now? Objective tasks are graded straight away and lock, and the model answers unlock.'}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>{submitting ? 'Submitting...' : 'Yes, submit'}</button>
                    <button className="btn btn-secondary" disabled={submitting} onClick={() => setConfirmingSubmit(false)}>Keep working</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
