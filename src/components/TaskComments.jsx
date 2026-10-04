import { useState, useEffect } from 'react';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { fetchTaskComments, addTaskComment, deleteTaskComment } from '../lib/tasksData';
import { personName, initialsOf } from '../lib/taskHelpers';
import { friendlyErrorMessage } from '../lib/errorMessages';

const when = (iso) => new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });

// Conversation under a task. Comments save the moment they're posted (they
// don't wait for the task form's Save), and posting one notifies the
// assignee, the creator and anyone already in the thread.
export default function TaskComments({ taskId, assignees, myEmail, isAdmin, isMockSession, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(!isMockSession);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchTaskComments(taskId)
      .then((rows) => { if (!cancelled) setComments(rows); })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [taskId, isMockSession]);

  const post = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      const created = isMockSession
        ? { id: Math.max(0, ...comments.map((c) => c.id)) + 1, taskId, authorEmail: myEmail, body, createdAt: new Date().toISOString() }
        : await addTaskComment(taskId, body, myEmail);
      const next = [...comments, created];
      setComments(next);
      onCountChange(taskId, next.length);
      setDraft('');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (c) => {
    setError(null);
    try {
      if (!isMockSession) await deleteTaskComment(c.id);
      const next = comments.filter((x) => x.id !== c.id);
      setComments(next);
      onCountChange(taskId, next.length);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
        <MessageSquare size={13} /> Comments {comments.length > 0 && <span style={{ fontFamily: 'var(--font-mono)' }}>({comments.length})</span>}
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading comments...</p>}
        {!loading && comments.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No comments yet. Updates and questions go here, and the people on this task get notified.</p>}
        {comments.map((c) => {
          const name = c.authorEmail === myEmail ? 'You' : personName(assignees, c.authorEmail);
          const canDelete = c.authorEmail === myEmail || isAdmin;
          return (
            <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(var(--accent-rgb), 0.15)', color: 'var(--accent-cyan)', display: 'grid', placeItems: 'center', fontSize: '0.64rem', fontWeight: 700, flexShrink: 0 }}>{initialsOf(personName(assignees, c.authorEmail))}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>{name}</strong>
                  <span>{when(c.createdAt)}</span>
                  {canDelete && <button type="button" aria-label={`Delete comment by ${name}`} onClick={() => remove(c)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}><Trash2 size={12} /></button>}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            className="form-input"
            aria-label="Write a comment"
            rows={2}
            style={{ flex: 1 }}
            value={draft}
            maxLength={2000}
            placeholder="Write a comment"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); } }}
          />
          <button type="button" className="btn btn-secondary" aria-label="Post comment" disabled={posting || !draft.trim()} onClick={post} style={{ padding: '9px 12px' }}><Send size={14} /></button>
        </div>
        {error && <p style={{ fontSize: '0.8rem', color: 'var(--danger)', margin: 0 }}>{error}</p>}
      </div>
    </div>
  );
}
