import { useState, useEffect, useMemo } from 'react';
import { UserSearch, Eye, EyeOff, Copy, Mail, Phone, Link as LinkIcon, X } from 'lucide-react';
import { searchTalentPool, fetchTalentFilters, getTalentContact, setTalentProfileHidden } from '../lib/talentData';
import { buildTalentPack, availabilityLabel, highlightParts } from '../lib/talentHelpers';
import { friendlyErrorMessage } from '../lib/errorMessages';
import { isSafeUrl } from '../lib/safeUrl';

// Talent Pool for the founder (supabase/107_talent_pool.sql): search the members
// who opted in by keyword, skill and experience, tick a shortlist and copy an
// anonymous recruiter pack. Names and contact details stay behind a Reveal
// button that is logged, for use only after the person agreed to an introduction.
// Admins only - this is personal information.

// Invented people for Mock Admin, so the screen has something to show.
const MOCK_CARDS = [
  { id: 1, displayId: 'T-0101', source: 'Member', score: 0, headline: 'SOC analyst, 3 years', role: 'SOC analyst', years: 3, city: 'Johannesburg', track: 'SOC', workMode: 'Hybrid', openToContract: false, availableFrom: '2026-10-01', verified: ['SC-200', 'CompTIA Security+', 'Microsoft Sentinel'], self: ['Splunk', 'Incident response'], summary: 'Three years triaging alerts in a financial services SOC, now moving into threat hunting.', hidden: false, notes: '' },
  { id: 2, displayId: 'T-0102', source: 'Member', score: 0, headline: 'Cloud security engineer', role: 'Cloud engineer', years: 5, city: 'Cape Town', track: 'Cloud Security', workMode: 'Remote', openToContract: true, availableFrom: '', verified: ['AZ-104', 'Terraform', 'Azure'], self: ['Azure Policy', 'Python'], summary: 'Five years in cloud operations, hardening Azure environments with infrastructure as code.', hidden: false, notes: '' },
  { id: 3, displayId: 'T-0103', source: 'Member', score: 0, headline: 'GRC analyst, 2 years', role: 'GRC analyst', years: 2, city: 'Johannesburg', track: 'GRC', workMode: 'Any', openToContract: false, availableFrom: '2026-11-15', verified: ['POPIA', 'ISACA IT Risk Fundamentals'], self: ['ISO 27001', 'Risk registers'], summary: 'Law graduate with two years in compliance, building a risk and POPIA practice.', hidden: false, notes: '' },
  { id: 4, displayId: 'T-0104', source: 'Member', score: 0, headline: 'DevSecOps engineer', role: 'DevOps engineer', years: 4, city: 'Durban', track: 'DevSecOps', workMode: 'Hybrid', openToContract: true, availableFrom: '2026-10-10', verified: ['GH-500', 'KCSA', 'Kubernetes'], self: ['GitHub Actions', 'Docker'], summary: 'Four years shipping pipelines, adding secret scanning and image checks to every build.', hidden: false, notes: '' },
];

const YEAR_OPTIONS = [{ label: 'Any', value: 0 }, { label: '2+', value: 2 }, { label: '4+', value: 4 }, { label: '6+', value: 6 }];

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: active ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent', color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontWeight: 600 }}
    >
      {children}
    </button>
  );
}

function Highlight({ text, terms }) {
  return highlightParts(text, terms).map((p, i) => (p.hit
    ? <mark key={i} style={{ background: 'rgba(var(--warning-rgb), 0.3)', color: 'inherit', borderRadius: '3px', padding: '0 2px' }}>{p.text}</mark>
    : <span key={i}>{p.text}</span>));
}

export default function TalentPoolAdmin({ isMockSession }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [track, setTrack] = useState('');
  const [city, setCity] = useState('');
  const [minYears, setMinYears] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableNow, setAvailableNow] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [filters, setFilters] = useState({ tracks: [], cities: [] });
  const [items, setItems] = useState(isMockSession ? MOCK_CARDS : []);
  const [totalVisible, setTotalVisible] = useState(isMockSession ? MOCK_CARDS.length : 0);
  const [loading, setLoading] = useState(!isMockSession);
  const [error, setError] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [contacts, setContacts] = useState({});
  const [revealing, setRevealing] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (isMockSession) return;
    fetchTalentFilters().then(setFilters).catch(() => {});
  }, [isMockSession]);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    searchTalentPool({ query: debounced, track, city, minYears, verifiedOnly, availableNow, includeHidden })
      .then(({ items: rows, totalVisible: total }) => {
        if (cancelled) return;
        setItems(rows);
        setTotalVisible(total);
        setError(null);
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isMockSession, debounced, track, city, minYears, verifiedOnly, availableNow, includeHidden]);

  // Mock Admin filters locally, since there is no database to ask.
  const shown = useMemo(() => {
    if (!isMockSession) return items;
    const words = debounced.toLowerCase().split(/\s+/).filter(Boolean);
    return MOCK_CARDS.filter((c) => {
      const hay = [c.role, c.headline, c.summary, c.track, c.city, ...c.verified, ...c.self].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w))
        && (!track || c.track === track) && (!city || c.city === city) && (c.years || 0) >= minYears
        && (!verifiedOnly || c.verified.length > 0) && (!availableNow || (c.availableFrom && c.availableFrom <= new Date().toISOString().slice(0, 10)));
    });
  }, [isMockSession, items, debounced, track, city, minYears, verifiedOnly, availableNow]);

  const trackChips = isMockSession ? [...new Set(MOCK_CARDS.map((c) => c.track))] : filters.tracks;
  const cityChips = isMockSession ? [...new Set(MOCK_CARDS.map((c) => c.city))] : filters.cities;
  const terms = debounced.toLowerCase().split(/\s+/).filter(Boolean);

  const byId = (id) => [...items, ...MOCK_CARDS].find((c) => c.id === id);
  const picked = shortlist.map(byId).filter(Boolean);
  const packText = buildTalentPack(picked);

  const toggleShortlist = (id) => setShortlist((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const copyPack = async () => {
    if (!packText) { setCopyMsg('Add a candidate first.'); return; }
    try {
      await navigator.clipboard.writeText(packText);
      setCopyMsg('Copied.');
    } catch {
      setCopyMsg('Could not copy. Select the text and copy it.');
    }
  };

  const reveal = async (card) => {
    setRevealing(card.id);
    try {
      const c = isMockSession
        ? { displayId: card.displayId, name: 'Example Person (Mock Admin)', email: 'example@example.com', phone: '', links: {} }
        : await getTalentContact(card.id);
      setContacts((prev) => ({ ...prev, [card.id]: c }));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setRevealing(null);
    }
  };

  const toggleHidden = async (card) => {
    const next = !card.hidden;
    setItems((prev) => prev.map((c) => (c.id === card.id ? { ...c, hidden: next } : c)));
    if (isMockSession) return;
    try {
      await setTalentProfileHidden(card.id, next, card.notes);
      if (next && !includeHidden) setItems((prev) => prev.filter((c) => c.id !== card.id));
      setTotalVisible((n) => Math.max(0, n + (next ? -1 : 1)));
    } catch (err) {
      setItems((prev) => prev.map((c) => (c.id === card.id ? { ...c, hidden: card.hidden } : c)));
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserSearch size={28} color="var(--accent-cyan)" /> Talent Pool
        </h1>
        <p>Members who opted in to being shared with recruiters. Search by skill, tool, certification or role, build a shortlist and copy an anonymous pack. Reveal a name and contact details only after the person has agreed to that introduction.</p>
        {isMockSession && (
          <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '8px' }}>Mock Admin: these four people are invented, to show how the screen works.</p>
        )}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>{totalVisible} in the pool</p>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <input
            type="search"
            className="form-input"
            aria-label="Search the talent pool"
            placeholder="Search skills, tools, certs, roles, e.g. sentinel or terraform"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {trackChips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', minWidth: '56px' }}>Track</span>
              <Chip active={!track} onClick={() => setTrack('')}>All</Chip>
              {trackChips.map((t) => <Chip key={t} active={track === t} onClick={() => setTrack(track === t ? '' : t)}>{t}</Chip>)}
            </div>
          )}
          {cityChips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', minWidth: '56px' }}>City</span>
              <Chip active={!city} onClick={() => setCity('')}>All</Chip>
              {cityChips.map((c) => <Chip key={c} active={city === c} onClick={() => setCity(city === c ? '' : c)}>{c}</Chip>)}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', minWidth: '56px' }}>Years</span>
            {YEAR_OPTIONS.map((o) => <Chip key={o.label} active={minYears === o.value} onClick={() => setMinYears(o.value)}>{o.label}</Chip>)}
            <span style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border-color)', margin: '0 4px' }} aria-hidden="true" />
            <Chip active={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)}>Has verified skills</Chip>
            <Chip active={availableNow} onClick={() => setAvailableNow((v) => !v)}>Available now</Chip>
            <Chip active={includeHidden} onClick={() => setIncludeHidden((v) => !v)}>Show hidden</Chip>
          </div>

          <p style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {loading ? 'Searching...' : `${shown.length} match${shown.length === 1 ? '' : 'es'}`}
          </p>

          {!loading && shown.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '28px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {totalVisible === 0
                  ? 'Nobody is in the pool yet. Members join from the Job Board tab in their portal.'
                  : 'No one matches. Try fewer words or clear a filter.'}
              </p>
            </div>
          ) : (
            shown.map((c) => {
              const inList = shortlist.includes(c.id);
              const contact = contacts[c.id];
              return (
                <div key={c.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, opacity: c.hidden ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>{c.displayId}</span>
                    <span style={{ display: 'flex', gap: '6px' }}>
                      {c.hidden && <span className="badge badge-warning" style={{ fontSize: '0.66rem' }}>Hidden</span>}
                      <span className={`badge ${c.source === 'Member' ? 'badge-success' : ''}`} style={{ fontSize: '0.66rem' }}>{c.source}</span>
                    </span>
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    <Highlight text={c.role || c.headline} terms={terms} />{c.years != null && ` · ${c.years} yr${c.years === 1 ? '' : 's'}`}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {[c.city, c.track, c.workMode, `available ${availabilityLabel(c.availableFrom)}`, c.openToContract ? 'open to contract' : ''].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {c.verified.map((s) => <span key={s} className="badge badge-success" style={{ fontSize: '0.7rem' }} title="Verified by Hacking Hub">✓ <Highlight text={s} terms={terms} /></span>)}
                    {c.self.map((s) => <span key={s} className="badge" style={{ fontSize: '0.7rem' }} title="Self-reported"><Highlight text={s} terms={terms} /></span>)}
                  </div>
                  {c.summary && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}><Highlight text={c.summary} terms={terms} /></p>}

                  {contact && (
                    <div style={{ padding: '10px 12px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <strong>{contact.name || 'No name on file'}</strong>
                        <button type="button" aria-label="Hide contact details" onClick={() => setContacts((prev) => { const n = { ...prev }; delete n[c.id]; return n; })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }}><X size={14} /></button>
                      </div>
                      {contact.email && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={13} /> {contact.email}</span>}
                      {contact.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={13} /> {contact.phone}</span>}
                      {Object.entries(contact.links || {}).filter(([, v]) => isSafeUrl(v)).map(([k, v]) => (
                        <a key={k} href={v} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)' }}><LinkIcon size={13} /> {k}</a>
                      ))}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>This reveal was logged.</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" className={`btn ${inList ? 'btn-secondary' : 'btn-primary'}`} style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => toggleShortlist(c.id)}>
                      {inList ? 'Remove from shortlist' : 'Add to shortlist'}
                    </button>
                    {!contact && (
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} disabled={revealing === c.id} onClick={() => reveal(c)} title="Only after the person has agreed to an introduction. Each reveal is logged.">
                        <Eye size={13} /> {revealing === c.id ? 'Revealing...' : 'Reveal contact'}
                      </button>
                    )}
                    <button type="button" onClick={() => toggleHidden(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: 0 }}>
                      {c.hidden ? <Eye size={13} /> : <EyeOff size={13} />} {c.hidden ? 'Restore' : 'Hide'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="glass-card" style={{ position: 'sticky', top: '16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>Recruiter pack · {picked.length}</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Anonymous cards for the recruiter. No names, emails or phone numbers go in it.</p>
          <textarea
            readOnly
            aria-label="Recruiter pack text"
            className="form-input"
            rows={14}
            value={packText}
            placeholder="Add candidates from the results to build the pack."
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', lineHeight: 1.55, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.82rem' }} onClick={copyPack}><Copy size={14} /> Copy pack</button>
            {picked.length > 0 && <button type="button" className="btn btn-secondary" style={{ fontSize: '0.82rem' }} onClick={() => { setShortlist([]); setCopyMsg(''); }}>Clear</button>}
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }} aria-live="polite">{copyMsg}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
