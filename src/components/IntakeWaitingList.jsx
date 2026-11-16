import { useEffect, useState } from 'react';
import { Hourglass, Plus, Check, X, Undo2, Trash2, Pencil } from 'lucide-react';
import {
  DEPOSIT_AMOUNT, DEPOSIT_METHODS,
  fetchIntakeSchedule, setIntakeCapacity, fetchReservations, addReservation,
  updateReservation, deleteReservation, fetchUnlinkedDeposits, shortDate,
} from '../lib/intakeData';
import { friendlyErrorMessage } from '../lib/errorMessages';

// Founder-only Intakes & Deposits page (116_intake_reservations.sql): the
// running intake and the next two, each with its waiting list of R300
// deposits. Reserved and Joined entries take a spot on the website's
// "N spots left" counter straight away; Cancelled gives it back.

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });

const MOCK_SCHEDULE = [
  { name: 'December', opensOn: '2026-11-16', closesOn: '2026-12-15', capacity: 8, stored: true, reserved: 2, paidWithoutReservation: 1, spotsLeft: 5, isCurrent: true },
  { name: 'January', opensOn: '2026-12-16', closesOn: '2027-01-15', capacity: 10, stored: true, reserved: 1, paidWithoutReservation: 0, spotsLeft: 9, isCurrent: false },
  { name: 'February', opensOn: '2027-01-16', closesOn: '2027-02-15', capacity: 10, stored: false, reserved: 0, paidWithoutReservation: 0, spotsLeft: 10, isCurrent: false },
];
const MOCK_RESERVATIONS = [
  { id: 1, intakeOpensOn: '2026-11-16', intakeName: 'December', fullName: 'Example member A', email: 'a@example.com', phone: '082 000 0001', depositAmount: 300, paidOn: '2026-11-16', method: 'EFT', paymentRef: '', status: 'Reserved', notes: '' },
  { id: 2, intakeOpensOn: '2026-11-16', intakeName: 'December', fullName: 'Example member B', email: 'b@example.com', phone: '', depositAmount: 300, paidOn: '2026-11-17', method: 'PayFast', paymentRef: '', status: 'Joined', notes: '' },
  { id: 3, intakeOpensOn: '2026-12-16', intakeName: 'January', fullName: 'Example member C', email: 'c@example.com', phone: '', depositAmount: 300, paidOn: '2026-11-18', method: 'EFT', paymentRef: '', status: 'Reserved', notes: 'Starts after exams' },
];
const MOCK_UNLINKED = [{ source: 'PayFast', ref: 'mock-1', name: 'Example member D', email: 'd@example.com', amount: 300, paidOn: '2026-11-18' }];

const emptyForm = (intake) => ({
  intakeOpensOn: intake?.opensOn || '',
  intakeName: intake?.name || '',
  fullName: '', email: '', phone: '',
  depositAmount: DEPOSIT_AMOUNT, paidOn: today(), method: 'EFT', paymentRef: '', notes: '',
});

const label = { display: 'block', fontSize: '0.8rem', marginBottom: '6px', color: 'var(--text-secondary)' };
const STATUS_COLORS = { Reserved: 'var(--warning)', Joined: 'var(--success)', Cancelled: 'var(--text-muted)' };

export default function IntakeWaitingList({ isMockSession, user }) {
  const [schedule, setSchedule] = useState(isMockSession ? MOCK_SCHEDULE : null);
  const [reservations, setReservations] = useState(isMockSession ? MOCK_RESERVATIONS : []);
  const [unlinked, setUnlinked] = useState(isMockSession ? MOCK_UNLINKED : []);
  const [selected, setSelected] = useState(isMockSession ? MOCK_SCHEDULE[0].opensOn : null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // null = closed
  const [saving, setSaving] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(null); // { opensOn, value }
  const [reloadKey, setReloadKey] = useState(0); // bumped after every save

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchIntakeSchedule(3)
      .then((s) => Promise.all([fetchReservations(s.map((i) => i.opensOn)), fetchUnlinkedDeposits()]).then(([r, u]) => {
        if (cancelled) return;
        setSchedule(s);
        setReservations(r);
        setUnlinked(u);
        setSelected((cur) => cur || s[0]?.opensOn || null);
        setError('');
      }))
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => { cancelled = true; };
  }, [isMockSession, reloadKey]);

  const intake = schedule?.find((i) => i.opensOn === selected) || null;
  const list = reservations.filter((r) => r.intakeOpensOn === selected);

  const run = async (fn) => {
    setError('');
    try {
      if (!isMockSession) {
        await fn();
        setReloadKey((k) => k + 1);
      }
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setError('Add the person\'s name.'); return; }
    if (!form.email.trim() && !form.phone.trim()) { setError('Add an email or a phone number so you can reach them.'); return; }
    const target = schedule.find((i) => i.opensOn === form.intakeOpensOn);
    const entry = { ...form, intakeName: target?.name || form.intakeName };
    setSaving(true);
    if (isMockSession) {
      setReservations((prev) => [...prev, { ...entry, id: Date.now(), status: 'Reserved' }]);
      setForm(null);
      setSaving(false);
      return;
    }
    await run(() => addReservation(entry, user?.email));
    setSaving(false);
    setForm(null);
  };

  const setStatus = (r, status) => {
    if (isMockSession) { setReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x))); return; }
    run(() => updateReservation(r.id, { status }));
  };

  const moveTo = (r, opensOn) => {
    const target = schedule.find((i) => i.opensOn === opensOn);
    if (!target) return;
    if (isMockSession) { setReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, intakeOpensOn: opensOn, intakeName: target.name } : x))); return; }
    run(() => updateReservation(r.id, { intakeOpensOn: opensOn, intakeName: target.name }));
  };

  const remove = (r) => {
    if (!window.confirm(`Delete ${r.fullName}'s entry? Use Cancelled instead if they asked for a refund, so there's a record.`)) return;
    if (isMockSession) { setReservations((prev) => prev.filter((x) => x.id !== r.id)); return; }
    run(() => deleteReservation(r.id));
  };

  const saveCapacity = async () => {
    const value = Number(editingCapacity.value);
    if (!Number.isInteger(value) || value < 0) { setError('Spots must be a whole number, 0 or more.'); return; }
    const target = schedule.find((i) => i.opensOn === editingCapacity.opensOn);
    setEditingCapacity(null);
    await run(() => setIntakeCapacity(target, value));
  };

  const addFromDeposit = (d) => {
    setForm({ ...emptyForm(intake), fullName: d.name, email: d.email, depositAmount: d.amount, paidOn: d.paidOn, method: d.source === 'PayFast' ? 'PayFast' : 'EFT', paymentRef: d.ref });
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Hourglass size={28} color="var(--accent-cyan)" /> Intakes &amp; Deposits
        </h1>
        <p>Each intake takes sign-ups from the 16th to the next 15th. Add everyone who pays the R{DEPOSIT_AMOUNT} deposit to the intake they&apos;re securing: Reserved and Joined take a spot on the website straight away, and Cancelled gives it back.</p>
        {isMockSession && <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '8px' }}>Mock Admin: these people are invented, to show how the screen works.</p>}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}
      {!schedule && !error && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {schedule && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {schedule.map((i) => {
              const isSel = i.opensOn === selected;
              const editing = editingCapacity?.opensOn === i.opensOn;
              return (
                <div
                  key={i.opensOn}
                  className="glass-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(i.opensOn)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelected(i.opensOn); }}
                  style={{ padding: '18px', cursor: 'pointer', border: `1px solid ${isSel ? 'var(--accent-cyan)' : 'var(--border-color)'}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ fontSize: '1.1rem' }}>{i.name} intake</strong>
                    {i.isCurrent && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>ON THE WEBSITE</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Sign-ups {shortDate(i.opensOn)} – {shortDate(i.closesOn)}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: i.spotsLeft === 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {i.spotsLeft}<span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}> spots left</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {i.reserved} on the waiting list · {i.paidWithoutReservation} joined without a deposit
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                    {editing ? (
                      <>
                        <input type="number" min={0} className="form-input" style={{ width: '80px', padding: '4px 8px' }} value={editingCapacity.value} onChange={(e) => setEditingCapacity({ ...editingCapacity, value: e.target.value })} aria-label={`Spots for ${i.name}`} />
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={saveCapacity}>Save</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setEditingCapacity(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <span style={{ color: 'var(--text-secondary)' }}>{i.capacity} spots in total{!i.stored && ' (same as last month)'}</span>
                        <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => setEditingCapacity({ opensOn: i.opensOn, value: i.capacity })} aria-label={`Change spots for ${i.name}`}><Pencil size={12} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {unlinked.length > 0 && (
            <div className="glass-card" style={{ padding: '18px', marginBottom: '24px', borderLeft: '3px solid var(--warning)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>R{DEPOSIT_AMOUNT} payments not on a waiting list</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Completed in the last 90 days. Add each one to the intake they&apos;re securing.</p>
              {unlinked.map((d) => (
                <div key={`${d.source}-${d.ref}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '0.88rem' }}>
                  <span style={{ flex: '1 1 200px', minWidth: 0, overflowWrap: 'anywhere' }}><strong>{d.name || d.email}</strong> · {d.email}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.source} · {shortDate(d.paidOn)}</span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => addFromDeposit(d)}>
                    <Plus size={14} /> Add to {intake?.name || 'intake'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="glass-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{intake?.name} waiting list</h3>
              <button type="button" className="btn btn-primary" onClick={() => setForm(emptyForm(intake))}><Plus size={16} /> Add deposit</button>
            </div>

            {form && (
              <form onSubmit={submitForm} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', padding: '14px', marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div><label style={label} htmlFor="wl-name">Name</label><input id="wl-name" className="form-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
                <div><label style={label} htmlFor="wl-email">Email</label><input id="wl-email" type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><label style={label} htmlFor="wl-phone">Phone</label><input id="wl-phone" type="tel" className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div>
                  <label style={label} htmlFor="wl-intake">Intake</label>
                  <select id="wl-intake" className="form-input" value={form.intakeOpensOn} onChange={(e) => setForm({ ...form, intakeOpensOn: e.target.value })}>
                    {schedule.map((i) => <option key={i.opensOn} value={i.opensOn}>{i.name}</option>)}
                  </select>
                </div>
                <div><label style={label} htmlFor="wl-amount">Deposit (R)</label><input id="wl-amount" type="number" min={0} className="form-input" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} /></div>
                <div><label style={label} htmlFor="wl-paid">Paid on</label><input id="wl-paid" type="date" className="form-input" value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} /></div>
                <div>
                  <label style={label} htmlFor="wl-method">Paid by</label>
                  <select id="wl-method" className="form-input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                    {DEPOSIT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={label} htmlFor="wl-notes">Notes</label><input id="wl-notes" className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
                </div>
              </form>
            )}

            {list.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>Nobody has paid a deposit for {intake?.name} yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <th style={{ padding: '8px' }}>Name</th><th style={{ padding: '8px' }}>Contact</th><th style={{ padding: '8px' }}>Deposit</th><th style={{ padding: '8px' }}>Status</th><th style={{ padding: '8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--border-color)', opacity: r.status === 'Cancelled' ? 0.6 : 1 }}>
                        <td style={{ padding: '8px' }}><strong>{r.fullName}</strong>{r.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.notes}</div>}</td>
                        <td style={{ padding: '8px', overflowWrap: 'anywhere' }}>{r.email}{r.phone && <div style={{ color: 'var(--text-secondary)' }}>{r.phone}</div>}</td>
                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>R{r.depositAmount} · {r.method}<div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{shortDate(r.paidOn)}</div></td>
                        <td style={{ padding: '8px', fontWeight: 700, color: STATUS_COLORS[r.status] }}>{r.status}</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {r.status === 'Reserved' && <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => setStatus(r, 'Joined')}><Check size={13} /> Joined</button>}
                            {r.status !== 'Cancelled' && <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => setStatus(r, 'Cancelled')}><X size={13} /> Cancel</button>}
                            {r.status !== 'Reserved' && <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => setStatus(r, 'Reserved')}><Undo2 size={13} /> Reserved</button>}
                            <select className="form-input" style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto' }} value="" onChange={(e) => moveTo(r, e.target.value)} aria-label={`Move ${r.fullName} to another intake`}>
                              <option value="">Move to…</option>
                              {schedule.filter((i) => i.opensOn !== r.intakeOpensOn).map((i) => <option key={i.opensOn} value={i.opensOn}>{i.name}</option>)}
                            </select>
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r)} aria-label={`Delete ${r.fullName}`}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
