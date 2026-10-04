import { useState, useEffect } from 'react';
import { Route } from 'lucide-react';
import { fetchMemberPathway } from '../lib/pathwayData';
import { pathwayWeek, DEFAULT_CERT_STARTS, LAB_ITEMS } from '../lib/pathway';

const todaySast = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });

// Staff view of a member's Core Foundations pathway (Roadmaps tab): their
// week, whether they've moved things around, and how each checkpoint 1-on-1
// was cleared. "Self-declared" means the member said they booked it and no
// real meeting has been logged since - worth following up.
export default function PathwayStaffNote({ email, isMockSession }) {
  const [today] = useState(todaySast);
  const [state, setState] = useState({ loading: !isMockSession, pathway: null, error: false });

  useEffect(() => {
    if (isMockSession || !email) return undefined;
    let cancelled = false;
    fetchMemberPathway(email)
      .then((p) => { if (!cancelled) setState({ loading: false, pathway: p, error: false }); })
      .catch(() => { if (!cancelled) setState({ loading: false, pathway: null, error: true }); });
    return () => { cancelled = true; };
  }, [email, isMockSession]);

  const style = { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-secondary)' };
  if (isMockSession) return <div style={style}><Route size={12} /> Pathway details show for real members.</div>;
  if (state.loading) return null;
  if (state.error) return <div style={style}><Route size={12} /> Couldn't load this member's pathway.</div>;
  if (!state.pathway) return <div style={style}><Route size={12} /> Hasn't opened the new pathway yet.</div>;

  const p = state.pathway;
  const customLabs = p.labOrder.length > 0 && p.labOrder.some((t, i) => t !== LAB_ITEMS.filter((x) => p.labOrder.includes(x))[i]);
  const customCerts = Object.entries(p.certStarts).some(([t, w]) => DEFAULT_CERT_STARTS[t] !== w);
  const cps = Object.entries(p.checkpoints).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <div style={style}>
      <Route size={12} />
      <span>Pathway week {pathwayWeek(p.startedOn, today)}</span>
      <span>· {p.weeklyHours}h a week</span>
      <span>· {customLabs || customCerts ? 'Own order' : 'Recommended order'}</span>
      {cps.map(([at, c]) => (
        <span key={at} className={`badge ${c.how === 'booked' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.6rem' }} title={c.how === 'booked' ? 'The member said they booked this 1-on-1. Follow up if no session gets logged.' : 'Already past this checkpoint when the pathway started.'}>
          {at}-item checkpoint · {c.how === 'booked' ? `self-declared ${c.on}` : 'before pathway'}
        </span>
      ))}
    </div>
  );
}
