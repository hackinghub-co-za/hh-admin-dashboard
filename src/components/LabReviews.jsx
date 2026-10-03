import { useState, useEffect } from 'react';
import { FlaskConical, ExternalLink, CheckCircle2, RotateCcw, Plus, X, Eye, EyeOff } from 'lucide-react';
import { fetchLabAttemptsForReview, fetchLabAnswerKeys, reviewLabAttempt, fetchLabs, createCuratedLab, setLabPublished } from '../lib/labsData';
import { HUB_LAB_CONTENT, riskRating } from '../data/labs';
import { ROADMAP_TRACKS } from '../lib/memberOptions';
import { formatDate } from '../lib/dateFormat';
import { friendlyErrorMessage } from '../lib/errorMessages';
import { isSafeUrl } from '../lib/safeUrl';
import { TaskDebrief } from './LabPlayer';
import { STATUS_BADGE } from '../lib/labHelpers';

// Lab Reviews (supabase/099_labs.sql) - admins and community managers.
// Approving is a human call; the auto-grade only covers objective tasks.

const MOCK_RUBRIC_T6 = [
  { criterion: 'Risk statement', levels: ["A vague label such as 'IT risk'", 'Names the event but not the cause or the consequence', 'Clear cause, event and consequence'] },
  { criterion: 'Owner', levels: ["None, or just 'IT'", 'A person, but not the one accountable for the business outcome', 'A role that owns the business outcome, with IT as control owner'] },
  { criterion: 'Scoring', levels: ['No reasoning', 'Scores given, reasoning thin', 'Scores tied to the scoring guide and the evidence'] },
  { criterion: 'Controls and residual', levels: ["Generic, such as 'improve security'", 'Specific controls, but residual missing or unrealistic', 'Specific controls and a plausible, lower residual rating'] },
];

const MOCK_LABS = [
  { id: 1, slug: 'grc-risk-register-kasi-kredit', kind: 'hub', title: 'Build a Risk Register: Kasi Kredit', track: 'GRC', difficulty: 'Beginner', isPublished: true },
  { id: 2, slug: 'grc-breach-or-not-mzansi-learn', kind: 'hub', title: 'Breach or Not? Mzansi Learn', track: 'GRC', difficulty: 'Beginner', isPublished: true },
  { id: 3, slug: 'grc-popia-gap-analysis-ikhaya-health', kind: 'hub', title: 'POPIA Gap Analysis: Ikhaya Health Clinics', track: 'GRC', difficulty: 'Intermediate', isPublished: true },
];

const MOCK_ATTEMPTS = [
  {
    id: 101, labId: 1, labSlug: 'grc-risk-register-kasi-kredit', labTitle: 'Build a Risk Register: Kasi Kredit', labKind: 'hub',
    memberEmail: 'blessing@example.com', memberName: 'Blessing Mahlangu', status: 'Submitted', submittedAt: '2026-10-02T15:20:00Z',
    autoScore: 76, autoMax: 90,
    taskResults: { t1: { earned: 20, max: 20 }, t2: { earned: 10, max: 10 }, t3: { earned: 10, max: 10 }, t4: { earned: 15, max: 20 }, t5: { earned: 21, max: 30 } },
    answers: {
      t1: ['server-loss', 'shared-logins', 'bec', 'id-folder', 'laptop-theft', 'whatsapp'],
      t2: { likelihood: 4, impact: 5 },
      t3: { likelihood: 3, impact: 4 },
      t4: { 'no-mfa': 'mitigate', 'breach-costs': 'transfer', whatsapp: 'mitigate', printer: 'avoid' },
      t5: { 'server-loss': 'backups', 'shared-logins': 'named-accounts', 'stolen-password': 'mfa', 'id-folder': 'least-privilege', 'laptop-theft': 'awareness', 'fake-login': 'disk-encryption' },
      t6: 'Risk statement: Because LoanDesk runs on one server with an untested weekly USB backup, a failure or ransomware attack could wipe the loan book and stop Kasi Kredit from trading.\nOwner: Sipho (IT)\nLikelihood 4, impact 5 = 20 Critical, because the MD said they would stop trading.\nTreatment: Mitigate\nControls: cloud backups, restore tests.\nResidual: Medium',
    },
    feedback: '', rubricScores: null,
  },
  {
    id: 102, labId: 9, labSlug: 'curated-example', labTitle: 'Example curated lab', labKind: 'curated',
    memberEmail: 'thabo@example.com', memberName: 'Thabo Nkosi', status: 'Submitted', submittedAt: '2026-10-01T09:05:00Z',
    proofUrl: 'https://tryhackme.com/', answers: {}, feedback: '',
  },
];

const EMPTY_LAB_FORM = { title: '', provider: '', externalUrl: '', track: 'SOC', difficulty: 'Beginner', estMinutes: '', summary: '' };

function givenSummary(task, given) {
  if (given == null) return '(no answer)';
  if (task.type === 'single') return task.options.find((o) => o.id === given)?.label || given;
  if (task.type === 'risk_score' && given.likelihood && given.impact) {
    const score = given.likelihood * given.impact;
    return `Likelihood ${given.likelihood} × impact ${given.impact} = ${score} (${riskRating(score)})`;
  }
  return null;
}

function ReviewPanel({ attempt, answerKeys, isMockSession, onDone }) {
  const content = HUB_LAB_CONTENT[attempt.labSlug];
  const rubricTasks = content ? content.tasks.filter((t) => t.type === 'rubric') : [];
  const [rubricScores, setRubricScores] = useState(attempt.rubricScores || {});
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const rubricFor = (taskKey) => answerKeys?.[taskKey]?.rubric || (isMockSession && attempt.labSlug === 'grc-risk-register-kasi-kredit' && taskKey === 't6' ? MOCK_RUBRIC_T6 : null);
  const reviewerScore = Object.values(rubricScores).flat().reduce((sum, v) => sum + (Number.isInteger(v) ? v : 0), 0);
  const reviewerMax = rubricTasks.reduce((sum, t) => sum + (rubricFor(t.key)?.length || 0) * 2, 0);

  const pick = (taskKey, idx, level) => setRubricScores((prev) => {
    const row = [...(prev[taskKey] || [])];
    row[idx] = level;
    return { ...prev, [taskKey]: row };
  });

  const decide = async (approved) => {
    if (!approved && !feedback.trim()) {
      setError('Add feedback so the member knows what to change.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (!isMockSession) {
        await reviewLabAttempt(attempt.id, approved, feedback.trim(), rubricTasks.length ? rubricScores : null, rubricTasks.length ? reviewerScore : null);
      }
      onDone({ ...attempt, status: approved ? 'Approved' : 'Needs Changes', feedback: feedback.trim(), rubricScores, reviewerScore, reviewedAt: new Date().toISOString() });
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {attempt.labKind === 'curated' && (
        isSafeUrl(attempt.proofUrl) ? (
          <a href={attempt.proofUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.86rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '6px', wordBreak: 'break-all' }}>
            <ExternalLink size={14} /> {attempt.proofUrl}
          </a>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>No valid proof link.</p>
        )
      )}

      {attempt.labKind === 'hub' && !content && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>This lab's content isn't in this version of the app.</p>}

      {attempt.labKind === 'hub' && content && content.tasks.map((task, idx) => {
        const given = attempt.answers?.[task.key];
        const key = answerKeys?.[task.key];
        const summary = givenSummary(task, given);
        return (
          <div key={task.key} style={{ padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.88rem' }}>Task {idx + 1}: {task.title}</strong>
              {attempt.taskResults?.[task.key] && (
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {attempt.taskResults[task.key].earned}/{attempt.taskResults[task.key].max} pts
                </span>
              )}
            </div>
            {task.type === 'rubric' ? (
              <>
                <div style={{ fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)' }}>{given || '(no answer)'}</div>
                {rubricFor(task.key) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {rubricFor(task.key).map((row, i) => (
                      <div key={row.criterion} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{row.criterion}</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px' }}>
                          {row.levels.map((level, lvl) => {
                            const active = rubricScores[task.key]?.[i] === lvl;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => pick(task.key, i, lvl)}
                                aria-pressed={active}
                                style={{ textAlign: 'left', fontSize: '0.76rem', padding: '7px 9px', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: active ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent', color: 'var(--text-primary)' }}
                              >
                                <strong style={{ fontFamily: 'var(--font-mono)' }}>{lvl}</strong> · {level}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Rubric not available.</p>
                )}
                {key?.model_answer && (
                  <details>
                    <summary style={{ fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>Show model answer</summary>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: '8px' }}>{key.model_answer}</div>
                  </details>
                )}
              </>
            ) : (
              <>
                {summary && <p style={{ fontSize: '0.84rem' }}>Member's answer: {summary}</p>}
                {key ? <TaskDebrief task={task} given={given} debrief={{ ...key, result: null, rubric: null, model_answer: null }} /> : !isMockSession && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading answer key...</p>}
              </>
            )}
          </div>
        );
      })}

      {rubricTasks.length > 0 && reviewerMax > 0 && (
        <p style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
          Rubric: {reviewerScore}/{reviewerMax} · Auto-graded: {attempt.autoScore ?? '-'}/{attempt.autoMax ?? '-'}
          <span style={{ color: 'var(--text-muted)' }}> · Suggested bar: 60% auto-graded and at least half the rubric points</span>
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor={`lab-feedback-${attempt.id}`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Feedback to the member (required to send back)</label>
        <textarea id={`lab-feedback-${attempt.id}`} className="form-input" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What was strong, and what to change" />
      </div>
      {error && <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={submitting} onClick={() => decide(true)}><CheckCircle2 size={14} /> Approve</button>
        <button className="btn btn-secondary" disabled={submitting} onClick={() => decide(false)} style={{ color: 'var(--danger)' }}><RotateCcw size={14} /> Send back</button>
      </div>
    </div>
  );
}

export default function LabReviews({ isMockSession, user }) {
  const [attempts, setAttempts] = useState(isMockSession ? MOCK_ATTEMPTS : []);
  const [labs, setLabs] = useState(isMockSession ? MOCK_LABS : []);
  const [loading, setLoading] = useState(!isMockSession);
  const [error, setError] = useState(null);
  const [openAttemptId, setOpenAttemptId] = useState(null);
  const [answerKeysByLab, setAnswerKeysByLab] = useState({});
  const [showLabForm, setShowLabForm] = useState(false);
  const [labForm, setLabForm] = useState(EMPTY_LAB_FORM);
  const [labFormError, setLabFormError] = useState(null);
  const [savingLab, setSavingLab] = useState(false);

  useEffect(() => {
    if (isMockSession) return;
    Promise.all([fetchLabAttemptsForReview(), fetchLabs()])
      .then(([attemptRows, labRows]) => { setAttempts(attemptRows); setLabs(labRows); })
      .catch((err) => setError(friendlyErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isMockSession]);

  const openReview = (attempt) => {
    const next = openAttemptId === attempt.id ? null : attempt.id;
    setOpenAttemptId(next);
    if (next && attempt.labKind === 'hub' && !isMockSession && !answerKeysByLab[attempt.labId]) {
      fetchLabAnswerKeys(attempt.labId)
        .then((keys) => setAnswerKeysByLab((prev) => ({ ...prev, [attempt.labId]: keys })))
        .catch((err) => setError(friendlyErrorMessage(err)));
    }
  };

  const handleReviewed = (updated) => {
    setAttempts((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
    setOpenAttemptId(null);
  };

  const handleTogglePublished = async (lab) => {
    setError(null);
    const next = !lab.isPublished;
    setLabs((prev) => prev.map((l) => (l.id === lab.id ? { ...l, isPublished: next } : l)));
    if (isMockSession) return;
    try {
      await setLabPublished(lab.id, next);
    } catch (err) {
      setLabs((prev) => prev.map((l) => (l.id === lab.id ? { ...l, isPublished: !next } : l)));
      setError(friendlyErrorMessage(err));
    }
  };

  const handleAddLab = async (e) => {
    e.preventDefault();
    if (!labForm.title.trim()) { setLabFormError('Give the lab a title.'); return; }
    if (!/^https:\/\//i.test(labForm.externalUrl.trim()) || !isSafeUrl(labForm.externalUrl.trim())) { setLabFormError('The lab link must start with https://'); return; }
    setSavingLab(true);
    setLabFormError(null);
    try {
      const created = isMockSession
        ? { ...labForm, id: labs.length + 100, slug: `mock-${labs.length + 100}`, kind: 'curated', isPublished: true }
        : await createCuratedLab(labForm, user?.email);
      setLabs((prev) => [...prev, created]);
      setLabForm(EMPTY_LAB_FORM);
      setShowLabForm(false);
    } catch (err) {
      setLabFormError(friendlyErrorMessage(err));
    } finally {
      setSavingLab(false);
    }
  };

  const pending = attempts.filter((a) => a.status === 'Submitted');
  const reviewed = attempts.filter((a) => a.status === 'Approved' || a.status === 'Needs Changes').slice(0, 25);
  const nameOf = (a) => a.memberName || a.memberEmail;

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FlaskConical size={28} color="var(--accent-cyan)" /> Lab Reviews
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Members' lab submissions. Hub Labs arrive with objective tasks already graded; you score the written work against the rubric. Curated labs need a check of the proof link.</p>
      </div>

      {isMockSession && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
          Mock Admin: example submissions, nothing is saved.
        </div>
      )}
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '14px' }}>Waiting for review ({pending.length})</h3>
        {loading ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</p>
        ) : pending.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing waiting. Submissions show up here as members finish labs.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pending.map((a) => (
              <div key={a.id} style={{ padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{nameOf(a)} · {a.labTitle}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {a.labKind === 'hub' ? 'Hub Lab' : 'Curated'} · submitted {formatDate(a.submittedAt)}
                      {a.autoScore != null && ` · auto ${a.autoScore}/${a.autoMax}`}
                    </div>
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => openReview(a)}>
                    {openAttemptId === a.id ? 'Close' : 'Review'}
                  </button>
                </div>
                {openAttemptId === a.id && (
                  <ReviewPanel attempt={a} answerKeys={answerKeysByLab[a.labId]} isMockSession={isMockSession} onDone={handleReviewed} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '14px' }}>Recently reviewed</h3>
        {reviewed.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No reviews yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reviewed.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem' }}>{nameOf(a)} · {a.labTitle}</div>
                  {a.feedback && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.feedback}</div>}
                </div>
                <span className={`badge ${STATUS_BADGE[a.status]}`} style={{ fontSize: '0.68rem' }}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h3>Lab catalog</h3>
          {!showLabForm && (
            <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => setShowLabForm(true)}>
              <Plus size={14} /> Add curated lab
            </button>
          )}
        </div>

        {showLabForm && (
          <form onSubmit={handleAddLab} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <input className="form-input" aria-label="Lab title" placeholder="Title, e.g. Splunk 101" value={labForm.title} onChange={(e) => setLabForm({ ...labForm, title: e.target.value })} />
              <input className="form-input" aria-label="Provider" placeholder="Provider, e.g. TryHackMe" value={labForm.provider} onChange={(e) => setLabForm({ ...labForm, provider: e.target.value })} />
              <input className="form-input" aria-label="Lab link" type="url" placeholder="https://" value={labForm.externalUrl} onChange={(e) => setLabForm({ ...labForm, externalUrl: e.target.value })} />
              <select className="form-input" aria-label="Track" value={labForm.track} onChange={(e) => setLabForm({ ...labForm, track: e.target.value })}>
                {ROADMAP_TRACKS.filter((t) => t !== 'Not Assigned').map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-input" aria-label="Difficulty" value={labForm.difficulty} onChange={(e) => setLabForm({ ...labForm, difficulty: e.target.value })}>
                {['Beginner', 'Intermediate', 'Advanced'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input className="form-input" aria-label="Estimated minutes" type="number" min="5" max="600" placeholder="Est. minutes" value={labForm.estMinutes} onChange={(e) => setLabForm({ ...labForm, estMinutes: e.target.value })} />
            </div>
            <textarea className="form-input" aria-label="Summary" rows={2} placeholder="One or two sentences on what members practise" value={labForm.summary} onChange={(e) => setLabForm({ ...labForm, summary: e.target.value })} />
            {labFormError && <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{labFormError}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={savingLab} style={{ fontSize: '0.8rem' }}>{savingLab ? 'Adding...' : 'Add and publish'}</button>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => { setShowLabForm(false); setLabFormError(null); }}><X size={14} /> Cancel</button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {labs.map((lab) => (
            <div key={lab.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', opacity: lab.isPublished ? 1 : 0.6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{lab.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {lab.kind === 'hub' ? 'Hub Lab' : 'Curated'} · {lab.track} · {lab.difficulty}
                </div>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => handleTogglePublished(lab)}>
                {lab.isPublished ? <><EyeOff size={13} /> Unpublish</> : <><Eye size={13} /> Publish</>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
