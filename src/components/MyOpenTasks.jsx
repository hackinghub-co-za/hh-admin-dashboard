import { useState, useEffect } from 'react';
import { ListTodo, CalendarDays, ArrowRight, MessageSquare } from 'lucide-react';
import { fetchTasks } from '../lib/tasksData';
import { makeMockTasks } from '../lib/taskMock';
import { dueState, formatDueShort, PRIORITY_COLOR, STATUS_COLOR } from '../lib/taskHelpers';

const DUE_COLOR = { overdue: 'var(--danger)', today: 'var(--warning)', soon: 'var(--warning)', later: 'var(--text-muted)' };
const DUE_RANK = { overdue: 0, today: 1, soon: 2, later: 3 };
const PRIORITY_RANK = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const SHOWN = 5;

// Dashboard tile: the signed-in person's own unfinished tasks, most pressing
// first (overdue, then due soonest, then priority). Fetches for itself so it
// works on both the founder and community-manager dashboards.
export default function MyOpenTasks({ isMockSession, user, onOpenTask, onOpenBoard }) {
  const myEmail = (user?.email || '').toLowerCase();
  const [tasks, setTasks] = useState(() => (isMockSession ? makeMockTasks(myEmail) : null));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isMockSession) return undefined;
    let cancelled = false;
    fetchTasks().then((rows) => { if (!cancelled) setTasks(rows); }).catch(() => !cancelled && setError(true));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const mine = (tasks || [])
    .filter((t) => t.status !== 'Done' && t.assigneeEmail === myEmail)
    .sort((a, b) => (DUE_RANK[dueState(a)] ?? 4) - (DUE_RANK[dueState(b)] ?? 4)
      || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
      || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      || a.id - b.id);
  const overdue = mine.filter((t) => dueState(t) === 'overdue').length;
  const dueToday = mine.filter((t) => dueState(t) === 'today').length;

  return (
    <div className="glass-card" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ListTodo size={20} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>My open tasks</span>
          {tasks && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{mine.length}</span>}
          {overdue > 0 && <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>{overdue} overdue</span>}
          {dueToday > 0 && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{dueToday} due today</span>}
        </div>
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={onOpenBoard}>
          Open board <ArrowRight size={13} />
        </button>
      </div>

      {error ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Couldn't load your tasks right now.</p>
      ) : !tasks ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Loading...</p>
      ) : mine.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Nothing assigned to you right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {mine.slice(0, SHOWN).map((t) => {
            const due = dueState(t);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTask(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid var(--border-color)', padding: '10px 2px', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
              >
                <span title={t.priority} style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[t.priority], flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.88rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{t.title}</span>
                {t.commentCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', color: 'var(--text-muted)' }}><MessageSquare size={11} /> {t.commentCount}</span>}
                <span style={{ fontSize: '0.72rem', color: STATUS_COLOR[t.status], flexShrink: 0 }}>{t.status}</span>
                {t.dueDate && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', flexShrink: 0, color: due ? DUE_COLOR[due] : 'var(--text-muted)', fontWeight: due === 'overdue' ? 700 : 400 }}>
                    <CalendarDays size={11} /> {formatDueShort(t.dueDate)}{due === 'overdue' ? ' · overdue' : due === 'today' ? ' · today' : ''}
                  </span>
                )}
              </button>
            );
          })}
          {mine.length > SHOWN && (
            <button type="button" onClick={onOpenBoard} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-cyan)', fontSize: '0.8rem', padding: '8px 2px 0' }}>
              + {mine.length - SHOWN} more on the board
            </button>
          )}
        </div>
      )}
    </div>
  );
}
