import { useEffect, useState } from 'react';
import { Mail, Phone, Link2, Trash2, Megaphone, Briefcase } from 'lucide-react';
import { isSafeUrl } from '../lib/safeUrl';
import {
  CAREER_SERVICES, CAREER_STATUSES,
  fetchCareerServiceRequests, updateCareerServiceRequest, deleteCareerServiceRequest,
} from '../lib/careerServicesData';
import { friendlyErrorMessage } from '../lib/errorMessages';

// Founder-only Career Services tab (117_career_services.sql): free LinkedIn
// and CV reviews requested on hackinghub.co.za. Each request is also a Sales
// Pipeline lead; this tab is for doing the review itself and keeping track
// of which LinkedIn reviews can be used for content.

const MOCK_REQUESTS = [
  { id: 1, service: 'LinkedIn review', fullName: 'Example person A', email: 'a@example.com', phone: '+27820000001', linkedinUrl: 'https://www.linkedin.com/in/example-a', targetRole: 'SOC / Cybersecurity Analyst', situation: 'Working in IT, moving into security', contentConsent: true, status: 'New', notes: '', createdAt: '2026-11-26T08:00:00Z' },
  { id: 2, service: 'CV review', fullName: 'Example person B', email: 'b@example.com', phone: '', linkedinUrl: '', targetRole: 'Cloud Security', situation: '', contentConsent: false, status: 'Call booked', notes: 'Call on Monday', createdAt: '2026-11-20T08:00:00Z' },
];

const STATUS_COLORS = {
  New: 'var(--warning)',
  'Call booked': 'var(--info)',
  Reviewed: 'var(--success)',
  'Used for content': 'var(--accent-cyan)',
  Closed: 'var(--text-muted)',
};

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' });

export default function CareerServicesAdmin({ isMockSession }) {
  const [requests, setRequests] = useState(isMockSession ? MOCK_REQUESTS : []);
  const [loading, setLoading] = useState(!isMockSession);
  const [error, setError] = useState(null);
  const [serviceFilter, setServiceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Open');
  const [notesDraft, setNotesDraft] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchCareerServiceRequests()
      .then((rows) => !cancelled && setRequests(rows))
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const save = async (id, patch) => {
    setError(null);
    const previous = requests;
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (isMockSession) return;
    try {
      await updateCareerServiceRequest(id, patch);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setRequests(previous);
    }
  };

  const saveNotes = (r) => {
    const draft = notesDraft[r.id];
    if (draft === undefined || draft.trim() === r.notes) return;
    save(r.id, { notes: draft.trim() });
  };

  const remove = async (id) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    setError(null);
    const previous = requests;
    setRequests((prev) => prev.filter((r) => r.id !== id));
    if (isMockSession) return;
    try {
      await deleteCareerServiceRequest(id);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setRequests(previous);
    }
  };

  const isOpen = (r) => r.status !== 'Closed' && r.status !== 'Used for content';
  const shown = requests.filter((r) =>
    (serviceFilter === 'All' || r.service === serviceFilter)
    && (statusFilter === 'All' || (statusFilter === 'Open' ? isOpen(r) : r.status === statusFilter)));
  const newCount = requests.filter((r) => r.status === 'New').length;
  const contentReady = requests.filter((r) => r.contentConsent && r.status === 'Reviewed').length;

  const chip = (label, active, onClick) => (
    <button key={label} type="button" className="btn btn-secondary" onClick={onClick} aria-pressed={active}
      style={{ padding: '5px 12px', fontSize: '0.8rem', ...(active ? { borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' } : {}) }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Career Services</h1>
        <p>Free LinkedIn and CV reviews requested on the website. Each one is also a lead on the Sales Pipeline. LinkedIn review requesters have agreed that their review may be used for Hacking Hub content.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {[
          ['New requests', newCount],
          ['LinkedIn reviews', requests.filter((r) => r.service === 'LinkedIn review').length],
          ['CV reviews', requests.filter((r) => r.service === 'CV review').length],
          ['Reviewed, ready for content', contentReady],
        ].map(([label, n]) => (
          <div key={label} className="glass-card" style={{ padding: '12px 16px', minWidth: '150px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px' }}>Service:</span>
        {['All', ...CAREER_SERVICES].map((s) => chip(s, serviceFilter === s, () => setServiceFilter(s)))}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px' }}>Status:</span>
        {['Open', 'All', ...CAREER_STATUSES].map((s) => chip(s, statusFilter === s, () => setStatusFilter(s)))}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading requests...</p>}
      {!loading && shown.length === 0 && (
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Briefcase size={22} style={{ marginBottom: '8px' }} />
          <p style={{ margin: 0 }}>{requests.length === 0 ? 'No requests yet. They appear here as soon as someone asks for a review on the website.' : 'Nothing matches these filters.'}</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px' }}>
        {shown.map((r) => (
          <div key={r.id} className="glass-card" style={{ padding: '16px 18px', display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1rem' }}>{r.fullName}</strong>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{r.service}</span>
                  {r.contentConsent && (
                    <span title="Agreed their review may be used for content" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', background: 'var(--accent-glow)', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Megaphone size={11} /> OK for content
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Requested {shortDate(r.createdAt)}{r.targetRole ? ` · ${r.targetRole}` : ''}{r.situation ? ` · ${r.situation}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS[r.status] }} />
                <select className="form-input" value={r.status} onChange={(e) => save(r.id, { status: e.target.value })} aria-label={`Status for ${r.fullName}`} style={{ padding: '6px 10px', fontSize: '0.85rem', width: 'auto' }}>
                  {CAREER_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => remove(r.id)} onBlur={() => setConfirmDelete(null)} aria-label={`Delete request from ${r.fullName}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: confirmDelete === r.id ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Trash2 size={14} />{confirmDelete === r.id ? 'Delete?' : ''}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px 18px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflowWrap: 'anywhere' }}><Mail size={14} color="var(--text-muted)" />{r.email}</span>
              {r.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Phone size={14} color="var(--text-muted)" />{r.phone}</span>}
              {r.linkedinUrl && isSafeUrl(r.linkedinUrl) && (
                <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', overflowWrap: 'anywhere' }}>
                  <Link2 size={14} />LinkedIn profile
                </a>
              )}
            </div>

            <textarea
              className="form-input"
              rows={2}
              placeholder="Notes: what you found, what to fix, content ideas"
              value={notesDraft[r.id] ?? r.notes}
              onChange={(e) => setNotesDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
              onBlur={() => saveNotes(r)}
              aria-label={`Notes for ${r.fullName}`}
              style={{ fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
