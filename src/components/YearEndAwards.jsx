import { useEffect, useMemo, useState } from 'react';
import { Trophy, Check, Search, BarChart3, Vote } from 'lucide-react';
import {
  AWARD_CATEGORIES, VOTED_CATEGORIES, categoryById,
  fetchAwardBallot, castAwardVote, removeAwardVote, fetchAwardWinners, awardDate,
} from '../lib/yearEndAwardsData';
import { friendlyErrorMessage } from '../lib/errorMessages';

// The HH Year-End Awards card at the top of Competitions
// (119_year_end_awards.sql). Before voting opens it previews the categories;
// while it's open members vote (one per category, changeable, skippable);
// after it closes it says when the winners are announced; once the founder
// publishes the results it shows the winners.

const MOCK_BALLOT = {
  year: 2026, opensOn: '2026-12-01', closesOn: '2026-12-14', announceOn: '2026-12-18', phase: 'open', canVote: true,
  nominees: ['Example member A', 'Example member B', 'Example member C', 'Example member D'].map((name, i) => ({ key: `m:${i}`, name, headshot: '' })),
  mentors: ['Nonhlanhla', 'Nokulunga', 'Momelezi', 'Tshepo'].map((name) => ({ key: `mentor:${name}`, name, headshot: '' })),
  myVotes: {},
};

const GOLD = 'var(--medal-gold)';
const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function Avatar({ person, size = 30 }) {
  if (person.headshot) {
    return <img src={person.headshot} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'grid', placeItems: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
      {initials(person.name)}
    </span>
  );
}

export default function YearEndAwards({ isMockSession }) {
  const [ballot, setBallot] = useState(isMockSession ? MOCK_BALLOT : null);
  const [winners, setWinners] = useState([]);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(VOTED_CATEGORIES[0].id);
  const [picked, setPicked] = useState(null);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAwardBallot()
      .then((b) => {
        if (cancelled) return;
        setBallot(b);
        if (b.phase === 'results') fetchAwardWinners().then((w) => !cancelled && setWinners(w)).catch(() => {});
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const myVotes = useMemo(() => ballot?.myVotes || {}, [ballot]);
  const votedCount = Object.keys(myVotes).length;
  const isOpen = ballot?.phase === 'open' && ballot?.canVote;
  const currentCat = categoryById(current);
  const options = current === 'mentor' ? (ballot?.mentors || []) : (ballot?.nominees || []);
  const filtered = options.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));

  const openCategory = (id) => {
    const cat = categoryById(id);
    if (cat.type !== 'vote') {
      setNotice(`${cat.name} isn’t voted for. It’s worked out from the portal when voting closes.`);
      return;
    }
    setCurrent(id);
    setPicked(myVotes[id]?.key || null);
    setReason(myVotes[id]?.reason || '');
    setSearch('');
    setNotice('');
  };

  const applyVote = (category, vote) => {
    setBallot((b) => {
      const next = { ...b.myVotes };
      if (vote) next[category] = vote; else delete next[category];
      return { ...b, myVotes: next };
    });
  };

  const handleVote = async () => {
    const person = options.find((o) => o.key === picked);
    if (!person) return;
    setSaving(true);
    setError(null);
    try {
      if (!isMockSession) await castAwardVote(current, person.key, reason.trim());
      applyVote(current, { key: person.key, name: person.name, reason: reason.trim() });
      const left = VOTED_CATEGORIES.filter((c) => c.id !== current && !myVotes[c.id]).length;
      setNotice(`Vote saved for ${person.name}.${left ? ` ${left} more categor${left === 1 ? 'y' : 'ies'} you can vote in.` : ' That’s every category. Thank you for voting!'}`);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!isMockSession) await removeAwardVote(current);
      applyVote(current, null);
      setPicked(null);
      setReason('');
      setNotice('Vote removed.');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    const i = VOTED_CATEGORIES.findIndex((c) => c.id === current);
    const rest = [...VOTED_CATEGORIES.slice(i + 1), ...VOTED_CATEGORIES.slice(0, i)];
    openCategory((rest.find((c) => !myVotes[c.id]) || rest[0]).id);
  };

  if (!ballot || ballot.phase === 'none') {
    return error ? <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '24px' }}>{error}</p> : null;
  }

  const badge = {
    upcoming: { label: `Voting opens ${awardDate(ballot.opensOn)}`, color: 'var(--text-secondary)' },
    open: { label: 'Voting open', color: GOLD },
    closed: { label: 'Voting closed', color: 'var(--text-secondary)' },
    results: { label: 'Winners announced', color: GOLD },
  }[ballot.phase];

  const intro = {
    upcoming: `It’s been a big year. From ${awardDate(ballot.opensOn)} to ${awardDate(ballot.closesOn)}, vote for the members who inspired you, helped you or made you laugh. Winners are announced on ${awardDate(ballot.announceOn)}.`,
    open: `Vote once in each category for the members who inspired you, helped you or made you laugh. Skip any you’re not sure about, and change a vote any time until ${awardDate(ballot.closesOn)}. Votes are private. Winners are announced on ${awardDate(ballot.announceOn)}.`,
    closed: `Voting has closed. Thank you to everyone who voted! The winners are announced on ${awardDate(ballot.announceOn)}.`,
    results: 'The votes are in. Congratulations to this year’s winners!',
  }[ballot.phase];

  return (
    <div className="glass-card" style={{ marginBottom: '32px', border: `1px solid ${GOLD}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={24} color={GOLD} />
          <div>
            <h3 style={{ margin: 0 }}>The HH Year-End Awards {ballot.year}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              {VOTED_CATEGORIES.length} voted categories and {AWARD_CATEGORIES.length - VOTED_CATEGORIES.length} decided by portal data
            </p>
          </div>
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', border: `1px solid ${badge.color}`, color: badge.color }}>{badge.label}</span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>{intro}</p>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

      {ballot.phase === 'results' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {AWARD_CATEGORIES.map((cat) => {
            const won = winners.filter((w) => w.category === cat.id);
            return (
              <div key={cat.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.75rem', color: GOLD, fontWeight: 700, marginBottom: '4px' }}>{cat.name}</div>
                {won.length === 0
                  ? <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No winner this year</div>
                  : won.map((w) => (
                    <div key={w.name} style={{ fontWeight: 700 }}>
                      {w.name}{w.detail && <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>{w.detail}</span>}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: isOpen ? '18px' : 0 }}>
            {AWARD_CATEGORIES.map((cat) => {
              const vote = myVotes[cat.id];
              const active = isOpen && cat.id === current;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => isOpen && openCategory(cat.id)}
                  aria-pressed={active}
                  disabled={!isOpen}
                  title={cat.desc}
                  style={{
                    textAlign: 'left', font: 'inherit', color: 'inherit', cursor: isOpen ? 'pointer' : 'default',
                    background: active ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                    border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                    borderRadius: '10px', padding: '10px 12px', display: 'grid', gap: '2px',
                  }}
                >
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{cat.name}</strong>
                    {cat.type === 'data'
                      ? <BarChart3 size={13} color={GOLD} aria-label="Decided by portal data" />
                      : vote ? <Check size={14} color="var(--accent-cyan)" aria-label="You voted" /> : null}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {vote ? `You voted: ${vote.name}` : cat.type === 'data' ? 'From portal data' : cat.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {ballot.phase === 'open' && !ballot.canVote && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '14px 0 0' }}>Voting is for members. Staff can follow the results on the admin side.</p>
          )}

          {isOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 260px)', gap: '16px', alignItems: 'start' }} className="hh-awards-ballot">
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'grid', gap: '10px', minWidth: 0 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem' }}>{currentCat.name}</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentCat.desc}</p>
                </div>
                {current !== 'mentor' && (
                  <label style={{ position: 'relative', display: 'block' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="form-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members" aria-label="Search members" style={{ paddingLeft: '30px' }} />
                  </label>
                )}
                <div role="radiogroup" aria-label={`Vote for ${currentCat.name}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                  {filtered.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={picked === o.key}
                      onClick={() => setPicked(o.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer',
                        background: 'var(--bg-secondary)', borderRadius: '10px', padding: '7px 9px',
                        border: `1px solid ${picked === o.key ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                        boxShadow: picked === o.key ? 'inset 0 0 0 1px var(--accent-cyan)' : 'none',
                      }}
                    >
                      <Avatar person={o} />
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: '0.85rem', fontWeight: 600 }}>{o.name}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No members match “{search}”.</p>}
                </div>
                <textarea
                  className="form-input"
                  rows={2}
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why them? (optional)"
                  aria-label="Why them? (optional)"
                  style={{ fontSize: '0.85rem', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" disabled={!picked || saving} onClick={handleVote} style={{ justifyContent: 'center' }}>
                    <Vote size={14} /> {saving ? 'Saving...' : myVotes[current] ? 'Change vote' : 'Vote'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={goNext} disabled={saving}>Next category</button>
                  {myVotes[current] && <button type="button" className="btn btn-secondary" onClick={handleRemove} disabled={saving}>Remove vote</button>}
                </div>
                {notice && <p role="status" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{notice}</p>}
              </div>

              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'grid', gap: '8px' }}>
                <strong style={{ fontSize: '0.9rem' }}>Your votes: {votedCount} of {VOTED_CATEGORIES.length}</strong>
                <div style={{ height: '6px', borderRadius: '999px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(votedCount / VOTED_CATEGORIES.length) * 100}%`, background: 'var(--accent-cyan)' }} />
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '4px', fontSize: '0.8rem' }}>
                  {VOTED_CATEGORIES.map((c) => (
                    <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span>{c.name}</span>
                      <span style={{ color: myVotes[c.id] ? 'var(--accent-cyan)' : 'var(--text-muted)', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{myVotes[c.id]?.name || 'Not voted'}</span>
                    </li>
                  ))}
                </ul>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>You can’t vote for yourself. Only you can see your votes.</p>
              </div>
            </div>
          )}
          {!isOpen && notice && <p role="status" style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{notice}</p>}
        </>
      )}
    </div>
  );
}
