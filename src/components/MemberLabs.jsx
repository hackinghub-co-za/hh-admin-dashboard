import { useState, useEffect } from 'react';
import { FlaskConical, ExternalLink, Clock, Send, X } from 'lucide-react';
import { fetchLabs, fetchMyLabAttempts, submitCuratedLabProof } from '../lib/labsData';
import { HUB_LAB_CONTENT } from '../data/labs';
import { friendlyMemberErrorMessage } from '../lib/errorMessages';
import { isSafeUrl } from '../lib/safeUrl';
import { logPortalEvent } from '../lib/portalEventsData';
import LabPlayer from './LabPlayer';
import { STATUS_BADGE, isTaskAnswered } from '../lib/labHelpers';

const MOCK_LABS = [
  { id: 1, slug: 'grc-risk-register-kasi-kredit', kind: 'hub', title: 'Build a Risk Register: Kasi Kredit', summary: 'A micro-lender needs its first information security risk register before funder due diligence. Separate real risks from noise, score them, choose treatments and controls, and write up the top risk.', track: 'GRC', difficulty: 'Beginner', estMinutes: 60, roadmapItemTitle: 'Mock Risk Assessment', externalUrl: '', provider: '' },
  { id: 2, slug: 'grc-breach-or-not-mzansi-learn', kind: 'hub', title: 'Breach or Not? Mzansi Learn', summary: 'Four incidents at an online tutoring company. Decide which must be notified under POPIA section 22, who gets told, and draft the notice to parents.', track: 'GRC', difficulty: 'Beginner', estMinutes: 45, roadmapItemTitle: 'POPIA/GDPR Practitioner', externalUrl: '', provider: '' },
  { id: 3, slug: 'grc-popia-gap-analysis-ikhaya-health', kind: 'hub', title: 'POPIA Gap Analysis: Ikhaya Health Clinics', summary: 'Assess a group of private clinics against the eight POPIA conditions using interviews, forms and an incident log, then write a remediation memo the owner can act on.', track: 'GRC', difficulty: 'Intermediate', estMinutes: 90, roadmapItemTitle: 'Compliance Gap Analysis', externalUrl: '', provider: '' },
  { id: 4, slug: 'curated-example', kind: 'curated', title: 'Example curated lab (Mock Member)', summary: 'Curated labs are external labs picked by the Hacking Hub team. Do the lab on its own platform, then submit a link that proves you finished it.', track: 'SOC', difficulty: 'Beginner', estMinutes: 60, roadmapItemTitle: '', externalUrl: 'https://tryhackme.com/', provider: 'TryHackMe' },
];

const DIFFICULTY_ORDER = { Beginner: 0, Intermediate: 1, Advanced: 2 };

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: active ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent', color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontWeight: active ? 600 : 400 }}
    >
      {children}
    </button>
  );
}

function CuratedProofForm({ lab, attempt, isMockSession, onSubmitted, onCancel }) {
  const [url, setUrl] = useState(attempt?.proofUrl || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!/^https:\/\//i.test(trimmed) || !isSafeUrl(trimmed)) {
      setError('Paste a link that starts with https://, such as your completion certificate or profile page.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (!isMockSession) {
        await submitCuratedLabProof(lab.id, trimmed);
        logPortalEvent('lab_submitted', { lab: lab.slug }).catch(() => {});
      }
      onSubmitted({ ...(attempt || {}), labId: lab.id, status: 'Submitted', proofUrl: trimmed, submittedAt: new Date().toISOString() });
    } catch (err) {
      setError(friendlyMemberErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
      <label htmlFor={`proof-${lab.id}`} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Proof link (completion certificate, badge or profile page)</label>
      <input id={`proof-${lab.id}`} type="url" className="form-input" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
      {error && <span style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</span>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} disabled={submitting}>
          <Send size={13} /> {submitting ? 'Submitting...' : 'Submit proof'}
        </button>
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={onCancel}>
          <X size={13} /> Cancel
        </button>
      </div>
    </form>
  );
}

export default function MemberLabs({ isMockSession, roadmapTrack }) {
  const [labs, setLabs] = useState(isMockSession ? MOCK_LABS : []);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(!isMockSession);
  const [error, setError] = useState(null);
  // null = automatic: the member's own track if it has labs, otherwise All.
  const [trackFilterChoice, setTrackFilter] = useState(null);
  const [kindFilter, setKindFilter] = useState('all');
  const [openLabId, setOpenLabId] = useState(null);
  const [proofFormLabId, setProofFormLabId] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    Promise.all([fetchLabs(), fetchMyLabAttempts()])
      .then(([labRows, attemptRows]) => {
        setLabs(labRows.filter((l) => l.kind === 'curated' || HUB_LAB_CONTENT[l.slug]));
        setAttempts(attemptRows);
      })
      .catch((err) => setError(friendlyMemberErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isMockSession]);

  const attemptFor = (labId) => attempts.find((a) => a.labId === labId) || null;
  const upsertAttempt = (next) => setAttempts((prev) => [...prev.filter((a) => a.labId !== next.labId), next]);

  const openLab = labs.find((l) => l.id === openLabId);
  if (openLab && HUB_LAB_CONTENT[openLab.slug]) {
    return (
      <LabPlayer
        key={openLab.id}
        lab={openLab}
        content={HUB_LAB_CONTENT[openLab.slug]}
        attempt={attemptFor(openLab.id)}
        isMockSession={isMockSession}
        onBack={() => setOpenLabId(null)}
        onAttemptChange={upsertAttempt}
      />
    );
  }

  const tracks = [...new Set(labs.map((l) => l.track))].sort();
  const trackFilter = trackFilterChoice ?? (roadmapTrack && tracks.includes(roadmapTrack) ? roadmapTrack : 'All');
  const trackChips = ['All', ...(trackFilter !== 'All' && !tracks.includes(trackFilter) ? [trackFilter] : []), ...tracks];
  const visibleLabs = labs
    .filter((l) => trackFilter === 'All' || l.track === trackFilter)
    .filter((l) => kindFilter === 'all' || l.kind === kindFilter)
    .sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]) || a.title.localeCompare(b.title));

  const approvedCount = attempts.filter((a) => a.status === 'Approved').length;
  const activeCount = attempts.filter((a) => a.status !== 'Approved').length;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FlaskConical size={28} color="var(--accent-cyan)" /> Labs
        </h1>
        <p>Hands-on practice for your track. Hub Labs run right here in the portal; curated labs are the best external labs we've found, checked by the team when you submit proof.</p>
        {(approvedCount > 0 || activeCount > 0) && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            {approvedCount} approved · {activeCount} in progress or in review
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        {trackChips.map((t) => (
          <Chip key={t} active={trackFilter === t} onClick={() => setTrackFilter(t)}>{t === 'All' ? 'All tracks' : t}</Chip>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
        <Chip active={kindFilter === 'all'} onClick={() => setKindFilter('all')}>All labs</Chip>
        <Chip active={kindFilter === 'hub'} onClick={() => setKindFilter('hub')}>Hub Labs</Chip>
        <Chip active={kindFilter === 'curated'} onClick={() => setKindFilter('curated')}>Curated</Chip>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Loading labs...</p>
      ) : visibleLabs.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            No {kindFilter === 'hub' ? 'Hub Labs' : kindFilter === 'curated' ? 'curated labs' : 'labs'} for {trackFilter === 'All' ? 'any track' : trackFilter} yet.
          </p>
          {trackFilter !== 'All' && (
            <button className="btn btn-secondary" style={{ marginTop: '12px', fontSize: '0.8rem' }} onClick={() => setTrackFilter('All')}>See all tracks</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {visibleLabs.map((lab) => {
            const attempt = attemptFor(lab.id);
            const status = attempt?.status || null;
            const content = HUB_LAB_CONTENT[lab.slug];
            const answered = content ? content.tasks.filter((t) => isTaskAnswered(t, attempt?.answers?.[t.key])).length : 0;
            const progressPct = content ? (status && status !== 'In Progress' ? 100 : Math.round((answered / content.tasks.length) * 100)) : status ? 100 : 0;
            const actionLabel = !status ? 'Start' : status === 'In Progress' || status === 'Needs Changes' ? 'Continue' : 'Review';
            return (
              <div key={lab.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span className={`badge ${lab.kind === 'hub' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                    {lab.kind === 'hub' ? 'Hub Lab' : `Curated${lab.provider ? ` · ${lab.provider}` : ''}`}
                  </span>
                  {status ? (
                    <span className={`badge ${STATUS_BADGE[status]}`} style={{ fontSize: '0.68rem' }}>{status}</span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Not started</span>
                  )}
                </div>
                <h3 style={{ fontSize: '1rem', lineHeight: 1.35 }}>{lab.title}</h3>
                {lab.summary && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{lab.summary}</p>}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  <span>{lab.track}</span>
                  <span>{lab.difficulty}</span>
                  {lab.estMinutes && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> ~{lab.estMinutes} min</span>}
                  {content && <span>{content.tasks.length} tasks</span>}
                </div>
                <div style={{ height: '5px', background: 'var(--bg-tertiary)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', background: status === 'Approved' ? 'var(--success)' : 'var(--accent-cyan)' }} />
                </div>
                {attempt?.feedback && status === 'Needs Changes' && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>Reviewer: {attempt.feedback}</p>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {lab.kind === 'hub' ? (
                    <button className={`btn ${actionLabel === 'Review' ? 'btn-secondary' : 'btn-primary'}`} style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => setOpenLabId(lab.id)}>
                      {actionLabel}
                    </button>
                  ) : (
                    <>
                      {isSafeUrl(lab.externalUrl) && (
                        <a
                          href={lab.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '7px 14px', textDecoration: 'none' }}
                          onClick={() => { if (!isMockSession) logPortalEvent('lab_opened', { lab: lab.slug }).catch(() => {}); }}
                        >
                          <ExternalLink size={13} /> Open lab
                        </a>
                      )}
                      {status !== 'Approved' && proofFormLabId !== lab.id && (
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => setProofFormLabId(lab.id)}>
                          {status === 'Submitted' ? 'Update proof' : 'Submit proof'}
                        </button>
                      )}
                    </>
                  )}
                </div>
                {lab.kind === 'curated' && proofFormLabId === lab.id && (
                  <CuratedProofForm
                    lab={lab}
                    attempt={attempt}
                    isMockSession={isMockSession}
                    onSubmitted={(next) => { upsertAttempt(next); setProofFormLabId(null); }}
                    onCancel={() => setProofFormLabId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
