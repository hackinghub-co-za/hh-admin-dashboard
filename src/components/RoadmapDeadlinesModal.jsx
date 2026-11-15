import { useState } from 'react';
import { CalendarClock } from 'lucide-react';

// Asks for a deadline on the member's next roadmap items
// (lib/roadmapDeadlines.js). It has no close button on purpose: it stays
// until every listed item has a date of today or later. The parent saves
// through the same RPC as the date field on My Roadmap.
export default function RoadmapDeadlinesModal({ items, today, onSave }) {
  const [dates, setDates] = useState(() => Object.fromEntries(items.map((i) => [i.id, ''])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const allSet = items.every((i) => dates[i.id] && dates[i.id] >= today);

  const save = async () => {
    if (!allSet) return setError('Pick a date from today onwards for each item.');
    setSaving(true);
    setError('');
    try {
      await onSave(dates);
    } catch (err) {
      setError(err?.message || 'Could not save your deadlines. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="roadmap-deadlines-title" style={{ position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', border: '1px solid var(--accent-cyan)' }}>
        <h2 id="roadmap-deadlines-title" style={{ fontSize: '1.3rem', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CalendarClock size={20} color="var(--accent-cyan)" /> Set your deadlines
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
          Goals with a date get done. Pick when you'll finish your next {items.length === 1 ? 'roadmap item' : `${items.length} roadmap items`}. You can change these later on My Roadmap.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {items.map((item) => (
            <label key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.phase} · {item.category}</span>
              <span style={{ fontWeight: 600 }}>{item.title}</span>
              <input
                type="date"
                min={today}
                value={dates[item.id]}
                onChange={(e) => setDates((d) => ({ ...d, [item.id]: e.target.value }))}
                style={{ marginTop: '4px', padding: '10px 12px', fontSize: '0.95rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'inherit' }}
                aria-label={`Deadline for ${item.title}`}
              />
            </label>
          ))}
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: '14px 0 0' }}>{error}</p>}

        <button type="button" className="btn btn-primary" disabled={!allSet || saving} onClick={save} style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}>
          {saving ? 'Saving...' : 'Save my deadlines'}
        </button>
      </div>
    </div>
  );
}
