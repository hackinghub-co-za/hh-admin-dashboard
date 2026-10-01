import { useState, useEffect } from 'react';
import { UserCheck, Plus, Clock, Users, Mail, ChevronDown, X, Search, Trash2 } from 'lucide-react';
import {
  syncNewJoinerAccountability,
  fetchAccountabilityRoster,
  fetchAccountabilityList,
  addToAccountabilityList,
  removeFromAccountabilityList,
  fetchAccountabilityCheckins,
  logAccountabilityCheckin,
  fetchAccountabilityEmailSettings,
  setAccountabilityEmailEnabled,
} from '../lib/accountabilityData';
import { friendlyErrorMessage } from '../lib/errorMessages';

// Accountability Check-ins (supabase/091_accountability_checkins.sql) - a
// staff-curated list of members who need closer attention, with a dated,
// attributed log of every check-in. Admins and community managers only.
// "Due" here uses the same rule as get_accountability_due() / the daily
// email: never checked in on, or not within the last DUE_AFTER_DAYS SAST
// calendar days.

const DUE_AFTER_DAYS = 7;

// SAST calendar day as YYYY-MM-DD, so "due" flips at local midnight - same
// day boundary the database and the daily email use.
const sastDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
const daysBetweenDays = (fromDay, toDay) => Math.round((new Date(`${toDay}T00:00:00Z`) - new Date(`${fromDay}T00:00:00Z`)) / 86400000);

const daysAgo = (iso) => daysBetweenDays(sastDay(iso), sastDay(Date.now()));

function lastCheckinLabel(iso) {
  if (!iso) return 'Never checked in';
  const d = daysAgo(iso);
  if (d <= 0) return 'Checked in today';
  if (d === 1) return 'Last checked in yesterday';
  return `Last checked in ${d} days ago`;
}

const formatNoteDate = (iso) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });

const initialsOf = (name) => name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const MOCK_ROSTER = [
  { email: 'naledi@example.com', fullName: 'Naledi Mokoena', specialty: 'Cloud Security', headshotUrl: null },
  { email: 'thabo@example.com', fullName: 'Thabo Nkosi', specialty: 'SOC', headshotUrl: null },
  { email: 'karabo@example.com', fullName: 'Karabo Sithole', specialty: 'Cloud Security', headshotUrl: null },
  { email: 'refilwe@example.com', fullName: 'Refilwe Dlamini', specialty: 'Offensive Security', headshotUrl: null },
  { email: 'blessing@example.com', fullName: 'Blessing Mahlangu', specialty: 'GRC', headshotUrl: null },
  { email: 'lindiwe@example.com', fullName: 'Lindiwe Zulu', specialty: 'DevSecOps', headshotUrl: null },
  { email: 'sizwe@example.com', fullName: 'Sizwe Zwane', specialty: 'IAM', headshotUrl: null },
];

// Thabo and Naledi stand in for new joiners, auto-assigned to the Mock
// Community Manager's account so "Assigned to me" has something to show.
const MOCK_NEW_JOINERS = new Set(['naledi@example.com', 'thabo@example.com']);
const MOCK_LIST = ['naledi@example.com', 'thabo@example.com', 'karabo@example.com', 'refilwe@example.com', 'blessing@example.com']
  .map((memberEmail, i) => ({
    memberEmail,
    addedBy: MOCK_NEW_JOINERS.has(memberEmail) ? 'auto: new joiner' : 'siya@hackinghub.co.za',
    addedAt: isoDaysAgo(30 - i),
    assignedTo: MOCK_NEW_JOINERS.has(memberEmail) ? 'cm@hackinghub.co.za' : null,
    isNewJoiner: MOCK_NEW_JOINERS.has(memberEmail),
  }));

const MOCK_CHECKINS = [
  { id: 1, memberEmail: 'naledi@example.com', note: 'Mentioned they might pause their subscription - offered a 1on1 to talk it through.', loggedBy: 'siya@hackinghub.co.za', loggedByName: 'Siya', loggedAt: isoDaysAgo(12) },
  { id: 2, memberEmail: 'karabo@example.com', note: "Stuck on the IAM policy exercise - pointed them to the office hours doc.", loggedBy: 'siya@hackinghub.co.za', loggedByName: 'Siya', loggedAt: isoDaysAgo(3) },
  { id: 3, memberEmail: 'karabo@example.com', note: 'On track, finishing Security+ this week.', loggedBy: 'thakgalang@hackinghub.co.za', loggedByName: 'Thakgalang', loggedAt: isoDaysAgo(10) },
  { id: 4, memberEmail: 'refilwe@example.com', note: 'Booked the eJPT for next month. Feeling good about it.', loggedBy: 'thakgalang@hackinghub.co.za', loggedByName: 'Thakgalang', loggedAt: isoDaysAgo(1) },
  { id: 5, memberEmail: 'blessing@example.com', note: 'Working through the ISO 27001 course, about halfway.', loggedBy: 'siya@hackinghub.co.za', loggedByName: 'Siya', loggedAt: isoDaysAgo(5) },
];

function Avatar({ name, headshotUrl, size = 36 }) {
  if (headshotUrl) {
    return <img src={headshotUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size >= 36 ? '0.78rem' : '0.72rem', color: 'var(--accent-ink)',
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

const textareaStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 'var(--border-radius-sm)',
  border: '1px solid var(--border-color)', background: 'rgba(0, 0, 0, 0.15)', color: 'var(--text-primary)',
  fontFamily: 'inherit', fontSize: '0.84rem', resize: 'vertical',
};

export default function AccountabilityCheckins({ isMockSession, user }) {
  const [roster, setRoster] = useState(isMockSession ? MOCK_ROSTER : []);
  const [list, setList] = useState(isMockSession ? MOCK_LIST : []);
  const [checkins, setCheckins] = useState(isMockSession ? MOCK_CHECKINS : []);
  const [emailSettings, setEmailSettings] = useState(isMockSession ? { emailEnabled: true, recipients: ['thakgalang@hackinghub.co.za'] } : null);
  const [loading, setLoading] = useState(!isMockSession);
  const [error, setError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingEmail, setSavingEmail] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [togglingEmail, setTogglingEmail] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    // Sync new joiners first so the list reflects today, not the last 7am
    // run - but never let a sync hiccup block the tab from loading.
    syncNewJoinerAccountability()
      .catch((err) => console.error('Could not sync new joiners:', err))
      .then(() => Promise.all([fetchAccountabilityRoster(), fetchAccountabilityList(), fetchAccountabilityCheckins(), fetchAccountabilityEmailSettings()]))
      .then(([r, l, c, s]) => {
        if (cancelled) return;
        setRoster(r);
        setList(l);
        setCheckins(c);
        setEmailSettings(s);
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const myEmail = (user?.email || 'you@hackinghub.co.za').toLowerCase();
  const myName = (user?.user_metadata?.full_name || '').trim().split(' ')[0] || myEmail;

  const rosterByEmail = Object.fromEntries(roster.map((m) => [m.email, m]));
  const checkinsByEmail = checkins.reduce((acc, c) => {
    (acc[c.memberEmail] ||= []).push(c);
    return acc;
  }, {});
  Object.values(checkinsByEmail).forEach((arr) => arr.sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt)));

  const tracked = list.map((entry) => {
    const member = rosterByEmail[entry.memberEmail];
    const history = checkinsByEmail[entry.memberEmail] || [];
    const lastCheckinAt = history[0]?.loggedAt || null;
    const due = !lastCheckinAt || daysAgo(lastCheckinAt) >= DUE_AFTER_DAYS;
    return {
      email: entry.memberEmail,
      name: member?.fullName || entry.memberEmail,
      specialty: member?.specialty || null,
      headshotUrl: member?.headshotUrl || null,
      history,
      lastCheckinAt,
      due,
      assignedTo: entry.assignedTo || null,
      isNewJoiner: !!entry.isNewJoiner,
    };
  });
  const assigneeLabel = (email) => (email === myEmail ? 'you' : rosterByEmail[email]?.fullName || email);
  const assignedToMeCount = tracked.filter((t) => t.assignedTo === myEmail).length;
  const visible = onlyMine ? tracked.filter((t) => t.assignedTo === myEmail) : tracked;
  // Longest-waiting first, same order as the daily email.
  const dueToday = visible.filter((t) => t.due).sort((a, b) => (a.lastCheckinAt ? new Date(a.lastCheckinAt) : 0) - (b.lastCheckinAt ? new Date(b.lastCheckinAt) : 0));
  const checkedInThisWeek = visible.length - dueToday.length;

  const onList = new Set(list.map((l) => l.memberEmail));
  const searchResults = search.trim()
    ? roster.filter((m) => !onList.has(m.email) && (m.fullName.toLowerCase().includes(search.toLowerCase()) || m.email.includes(search.toLowerCase()))).slice(0, 8)
    : [];

  const handleAdd = async (member) => {
    setError(null);
    const optimistic = { memberEmail: member.email, addedBy: myEmail, addedAt: new Date().toISOString() };
    setList((prev) => [...prev, optimistic]);
    setSearch('');
    if (isMockSession) return;
    try {
      await addToAccountabilityList(member.email, myEmail);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setList((prev) => prev.filter((l) => l.memberEmail !== member.email));
    }
  };

  const handleRemove = async (email) => {
    setError(null);
    const previous = list;
    setList((prev) => prev.filter((l) => l.memberEmail !== email));
    if (isMockSession) return;
    try {
      await removeFromAccountabilityList(email);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setList(previous);
    }
  };

  const handleLogCheckin = async (email) => {
    const note = (drafts[email] || '').trim();
    if (!note) return;
    setError(null);
    setSavingEmail(email);
    try {
      const saved = isMockSession
        ? { id: Math.max(0, ...checkins.map((c) => c.id)) + 1, memberEmail: email, note, loggedBy: myEmail, loggedByName: myName, loggedAt: new Date().toISOString() }
        : await logAccountabilityCheckin({ memberEmail: email, note, loggedBy: myEmail, loggedByName: myName });
      setCheckins((prev) => [saved, ...prev]);
      setDrafts((prev) => ({ ...prev, [email]: '' }));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSavingEmail(null);
    }
  };

  const handleToggleEmail = async () => {
    if (!emailSettings) return;
    const next = !emailSettings.emailEnabled;
    setEmailSettings((prev) => ({ ...prev, emailEnabled: next }));
    if (isMockSession) return;
    setTogglingEmail(true);
    try {
      await setAccountabilityEmailEnabled(next);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setEmailSettings((prev) => ({ ...prev, emailEnabled: !next }));
    } finally {
      setTogglingEmail(false);
    }
  };

  const renderLogBox = (t) => (
    <>
      <label htmlFor={`checkin-${t.email}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Check-in note for {t.name}
      </label>
      <textarea
        id={`checkin-${t.email}`}
        rows={2}
        placeholder="What are they working on? How's it going?"
        value={drafts[t.email] || ''}
        onChange={(e) => setDrafts((prev) => ({ ...prev, [t.email]: e.target.value }))}
        style={textareaStyle}
      />
      <button
        type="button"
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '0.75rem' }}
        disabled={!(drafts[t.email] || '').trim() || savingEmail === t.email}
        onClick={() => handleLogCheckin(t.email)}
      >
        {savingEmail === t.email ? 'Saving...' : 'Log Check-in'}
      </button>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: '640px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UserCheck size={28} color="var(--accent-cyan)" /> Accountability Check-ins
          </h1>
          <p style={{ margin: 0 }}>A running log of personal check-ins with members who need closer attention - what they said they're working on, logged every time you reach out.</p>
        </div>
        <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => { setAddOpen((v) => !v); setSearch(''); }}>
          {addOpen ? <X size={16} /> : <Plus size={16} />} {addOpen ? 'Done Adding' : 'Add Member to Check-In List'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}

      {addOpen && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '10px 12px' }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              autoFocus
              aria-label="Search members to add"
              placeholder="Search members by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.88rem' }}
            />
          </div>
          {search.trim() && searchResults.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No matching members who aren't already on the list.</p>
          )}
          {searchResults.map((m) => (
            <button
              key={m.email}
              type="button"
              onClick={() => handleAdd(m)}
              className="hover-glow"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', font: 'inherit' }}
            >
              <Avatar name={m.fullName} headshotUrl={m.headshotUrl} size={30} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>{m.fullName}</span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{m.specialty || m.email}</span>
              </span>
              <Plus size={16} color="var(--accent-cyan)" />
            </button>
          ))}
        </div>
      )}

      {assignedToMeCount > 0 && (
        <div role="group" aria-label="Filter the list" style={{ display: 'flex', gap: '8px' }}>
          {[{ key: false, label: 'Everyone' }, { key: true, label: `Assigned to me (${assignedToMeCount})` }].map((f) => (
            <button
              key={String(f.key)}
              type="button"
              aria-pressed={onlyMine === f.key}
              onClick={() => setOnlyMine(f.key)}
              className={`btn ${onlyMine === f.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '7px 14px', fontSize: '0.72rem' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        {[
          { label: 'Due Today', value: dueToday.length, caption: 'Not checked in on for a week or more', color: 'var(--warning)' },
          { label: 'On the List', value: visible.length, caption: onlyMine ? 'Assigned to you' : "Members you're actively tracking", color: 'var(--accent-cyan)' },
          { label: 'Checked In This Week', value: checkedInThisWeek, caption: `Out of ${visible.length} on the list`, color: 'var(--success)' },
        ].map((s) => (
          <div key={s.label} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: s.color, textTransform: 'uppercase' }}>{s.label}</span>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1.1 }}>{loading ? '—' : s.value}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.caption}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0, flex: '2 1 520px' }}>
          {/* Due Today */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} color="var(--warning)" />
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Due Today</h3>
            </div>
            {loading ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Loading...</p>
            ) : dueToday.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                {visible.length === 0 ? 'Nobody on the list yet - add a member above to start tracking check-ins.' : "Everyone on the list has been checked in on this week. Nice."}
              </p>
            ) : (
              dueToday.map((t) => (
                <div key={t.email} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-tertiary)', border: '1px solid rgba(var(--warning-rgb), 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar name={t.name} headshotUrl={t.headshotUrl} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--warning)' }}>
                        {lastCheckinLabel(t.lastCheckinAt)}{t.assignedTo ? <span style={{ color: 'var(--text-muted)' }}> · Assigned to {assigneeLabel(t.assignedTo)}</span> : null}
                      </div>
                    </div>
                    {t.isNewJoiner && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>New joiner</span>}
                    {t.specialty && <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>{t.specialty}</span>}
                  </div>
                  {renderLogBox(t)}
                </div>
              ))
            )}
          </div>

          {/* Everyone You're Tracking */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Everyone You're Tracking</h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{visible.length} member{visible.length === 1 ? '' : 's'}</span>
            </div>
            {!loading && visible.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Nobody on the list yet.</p>
            )}
            {visible.map((t) => {
              const isOpen = !!expanded[t.email];
              return (
                <div key={t.email} style={{ borderRadius: 'var(--border-radius-md)', border: `1px solid ${isOpen ? 'var(--border-glow)' : 'var(--border-color)'}`, background: isOpen ? 'rgba(var(--accent-rgb), 0.03)' : 'transparent' }}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded((prev) => ({ ...prev, [t.email]: !prev[t.email] }))}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', font: 'inherit' }}
                  >
                    <Avatar name={t.name} headshotUrl={t.headshotUrl} size={34} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
                        {t.name}
                        {t.isNewJoiner && <span className="badge badge-warning" style={{ fontSize: '0.58rem' }}>New joiner</span>}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: t.due ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {t.specialty ? `${t.specialty} · ` : ''}{lastCheckinLabel(t.lastCheckinAt)}{t.assignedTo ? ` · Assigned to ${assigneeLabel(t.assignedTo)}` : ''}
                      </span>
                    </span>
                    <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }} />
                  </button>
                  {isOpen && (
                    <div style={{ position: 'relative', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {t.history.length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No check-ins logged yet.</p>
                        ) : (
                          t.history.map((c) => (
                            <div key={c.id} style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {formatNoteDate(c.loggedAt)} · {c.loggedByName}
                              </span>
                              {c.note}
                            </div>
                          ))
                        )}
                      </div>
                      {renderLogBox(t)}
                      {t.isNewJoiner ? (
                        // The daily sync would just put them straight back -
                        // new joiners come off on their own after 3 weeks.
                        <span style={{ alignSelf: 'flex-end', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Comes off the list automatically after their first 3 weeks
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ alignSelf: 'flex-end', padding: '6px 12px', fontSize: '0.7rem', color: 'var(--danger)' }}
                          onClick={() => handleRemove(t.email)}
                        >
                          <Trash2 size={13} /> Remove from List
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0, flex: '1 1 280px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Daily Email to the Community Manager</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5 }}>
              Every morning, whoever's due for a check-in gets emailed to the community manager - no need to open the dashboard to see who needs a nudge. Nothing's sent on a morning when nobody's due.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Sends every morning, 7:00 AM</span>
              <button
                type="button"
                role="switch"
                aria-checked={!!emailSettings?.emailEnabled}
                aria-label="Daily email"
                disabled={!emailSettings || togglingEmail}
                onClick={handleToggleEmail}
                style={{
                  width: '40px', height: '24px', borderRadius: '999px', border: 'none', position: 'relative', flexShrink: 0,
                  cursor: emailSettings ? 'pointer' : 'default',
                  background: emailSettings?.emailEnabled ? 'var(--accent-cyan)' : 'var(--bg-secondary)',
                  boxShadow: 'inset 0 0 0 1px var(--border-color)',
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{ position: 'absolute', top: '4px', left: emailSettings?.emailEnabled ? '20px' : '4px', width: '16px', height: '16px', borderRadius: '50%', background: emailSettings?.emailEnabled ? 'var(--accent-ink)' : 'var(--text-muted)', transition: 'left 0.15s ease' }} />
              </button>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-word' }}>
              Recipient{emailSettings?.recipients?.length === 1 ? '' : 's'}: {emailSettings ? emailSettings.recipients.join(', ') : '—'}
            </span>
            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setPreviewOpen(true)}>
              Preview Today's Email
            </button>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>How this works</h3>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <li>Add anyone you want to keep closer tabs on - no limit, unlike Focus 5.</li>
              <li>Every new member is added automatically for their first 3 weeks and assigned to a community manager, who gets their own morning email for them.</li>
              <li>"Due Today" surfaces whoever hasn't been checked in on for a week or more.</li>
              <li>Every note is dated and attributed to whichever staff member logged it.</li>
              <li>Remove someone once they're back on track - their history stays on record.</li>
            </ul>
          </div>
        </div>
      </div>

      {previewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview of today's email"
          onClick={() => setPreviewOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '14px', background: '#ffffff', color: '#374151', boxShadow: 'var(--glass-shadow)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ fontSize: '12px', lineHeight: 1.7 }}>
                <div><strong style={{ color: '#111827' }}>To</strong> {emailSettings?.recipients?.join(', ') || '—'}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                  {dueToday.length
                    ? `${dueToday.length} member${dueToday.length === 1 ? ' needs' : 's need'} a check-in today`
                    : 'Nothing to send today'}
                </div>
              </div>
              <button type="button" aria-label="Close preview" onClick={() => setPreviewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dueToday.length === 0 ? (
                <p style={{ margin: 0, fontSize: '14px' }}>Nobody's due today, so no email goes out this morning.</p>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>Morning! Here's who hasn't been checked in on in over a week - a quick message goes a long way.</p>
                  {dueToday.map((t) => (
                    <div key={t.email} style={{ padding: '14px 16px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{t.name}</div>
                      <div style={{ fontSize: '12px', color: '#92400e' }}>{lastCheckinLabel(t.lastCheckinAt)}{t.specialty ? ` · ${t.specialty}` : ''}</div>
                    </div>
                  ))}
                  {emailSettings && !emailSettings.emailEnabled && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c' }}>The daily email is switched off, so this won't actually be sent.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
