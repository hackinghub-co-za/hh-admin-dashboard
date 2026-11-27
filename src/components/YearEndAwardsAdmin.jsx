import { useEffect, useState } from 'react';
import { Trophy, BarChart3, Users } from 'lucide-react';
import {
  AWARD_CATEGORIES, fetchAwardResults, fetchAwardSettings, saveAwardSettings, awardDate,
} from '../lib/yearEndAwardsData';
import { friendlyErrorMessage } from '../lib/errorMessages';

// Founder-only Year-End Awards tab (119_year_end_awards.sql): the voting
// dates, turnout, live vote totals with reasons, the data award leaders, and
// the switch that shows the winners to members on Competitions.

const YEAR = new Date().getFullYear();
const MOCK_SETTINGS = { year: YEAR, opensOn: `${YEAR}-12-01`, closesOn: `${YEAR}-12-14`, announceOn: `${YEAR}-12-18`, published: false };
const MOCK_RESULTS = {
  voters: 2, eligible_voters: 71,
  votes: [{ category: 'newcomer', name: 'Example member A', votes: 2, reasons: ['Helped me with SC-900 notes'] }],
  data: [{ category: 'certs', rank: 1, name: 'Example member B', score: 3, unit: 'certs passed' }],
};

const fmtScore = (n) => Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 1 });

export default function YearEndAwardsAdmin({ isMockSession }) {
  const [settings, setSettings] = useState(isMockSession ? MOCK_SETTINGS : null);
  const [results, setResults] = useState(isMockSession ? MOCK_RESULTS : null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    Promise.all([fetchAwardSettings(YEAR), fetchAwardResults(YEAR)])
      .then(([s, r]) => {
        if (cancelled) return;
        setSettings(s || { ...MOCK_SETTINGS });
        setResults(r);
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const save = async (next) => {
    setSaving(true);
    setError(null);
    setSaved('');
    try {
      if (!isMockSession) await saveAwardSettings(next);
      setSettings(next);
      setSaved(next.published !== settings.published ? (next.published ? 'Winners are now showing on Competitions.' : 'Winners hidden from members.') : 'Dates saved.');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
      setConfirmPublish(false);
    }
  };

  if (!settings || !results) {
    return error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : <p style={{ color: 'var(--text-muted)' }}>Loading the awards...</p>;
  }

  const votesFor = (id) => results.votes.filter((v) => v.category === id);
  const dataFor = (id) => results.data.filter((d) => d.category === id);
  const turnout = results.eligible_voters ? Math.round((results.voters / results.eligible_voters) * 100) : 0;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Year-End Awards {settings.year}</h1>
        <p>Members vote on the Competitions tab. Totals here are live and only visible to you. Winners show on Competitions once you publish them.</p>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '18px', display: 'grid', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Dates</h3>
          {[['opensOn', 'Voting opens'], ['closesOn', 'Voting closes'], ['announceOn', 'Winners announced']].map(([key, label]) => (
            <label key={key} style={{ display: 'grid', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {label}
              <input type="date" className="form-input" value={settings[key] || ''} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
            </label>
          ))}
          <button type="button" className="btn btn-primary" disabled={saving || settings.closesOn < settings.opensOn} onClick={() => save(settings)} style={{ justifyContent: 'center' }}>
            {saving ? 'Saving...' : 'Save dates'}
          </button>
          {settings.closesOn < settings.opensOn && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--danger)' }}>Voting has to close on or after the day it opens.</p>}
        </div>

        <div className="glass-card" style={{ padding: '18px', display: 'grid', gap: '10px', alignContent: 'start' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', gap: '8px', alignItems: 'center' }}><Users size={16} /> Turnout</h3>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{results.voters} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)' }}>of {results.eligible_voters} members voted ({turnout}%)</span></div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Voting runs {awardDate(settings.opensOn)} to {awardDate(settings.closesOn)}.</p>
        </div>

        <div className="glass-card" style={{ padding: '18px', display: 'grid', gap: '10px', alignContent: 'start' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', gap: '8px', alignItems: 'center' }}><Trophy size={16} color="var(--medal-gold)" /> Winners</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {settings.published ? 'Showing to members on Competitions. Voting is closed while they show.' : `Hidden. Publish on ${awardDate(settings.announceOn)} after you announce them.`}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className={settings.published ? 'btn btn-secondary' : 'btn btn-primary'} disabled={saving}
              onClick={() => (confirmPublish ? save({ ...settings, published: !settings.published }) : setConfirmPublish(true))}>
              {confirmPublish ? (settings.published ? 'Yes, hide them' : 'Yes, publish to members') : (settings.published ? 'Hide winners' : 'Publish winners')}
            </button>
            {confirmPublish && <button type="button" className="btn btn-secondary" onClick={() => setConfirmPublish(false)}>Not yet</button>}
          </div>
        </div>
      </div>
      {saved && <p role="status" style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', margin: '-12px 0 20px' }}>{saved}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {AWARD_CATEGORIES.map((cat) => {
          const rows = cat.type === 'vote' ? votesFor(cat.id) : dataFor(cat.id);
          const top = cat.type === 'vote' ? (rows[0]?.votes || 0) : null;
          return (
            <div key={cat.id} className="glass-card" style={{ padding: '14px 16px', display: 'grid', gap: '8px', alignContent: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <strong>{cat.name}</strong>
                <span style={{ fontSize: '0.7rem', color: cat.type === 'data' ? 'var(--medal-gold)' : 'var(--accent-cyan)', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                  {cat.type === 'data' ? <><BarChart3 size={12} /> From data</> : `${rows.reduce((n, r) => n + r.votes, 0)} votes`}
                </span>
              </div>
              {rows.length === 0 && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cat.type === 'vote' ? 'No votes yet.' : 'No data yet.'}</p>}
              {rows.slice(0, 5).map((r, i) => (
                <div key={`${r.name}-${i}`} style={{ display: 'grid', gap: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.88rem' }}>
                    <span style={{ fontWeight: (cat.type === 'vote' ? r.votes === top : r.rank === 1) ? 700 : 400 }}>
                      {cat.type === 'data' ? `${r.rank}. ` : ''}{r.name}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {cat.type === 'vote' ? `${r.votes} vote${r.votes === 1 ? '' : 's'}` : `${fmtScore(r.score)} ${r.unit}`}
                    </span>
                  </div>
                  {cat.type === 'vote' && r.reasons?.length > 0 && (
                    <details style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <summary style={{ cursor: 'pointer' }}>{r.reasons.length} reason{r.reasons.length === 1 ? '' : 's'}</summary>
                      <ul style={{ margin: '4px 0 0', paddingLeft: '18px', display: 'grid', gap: '2px' }}>
                        {r.reasons.map((text, j) => <li key={j}>“{text}”</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
