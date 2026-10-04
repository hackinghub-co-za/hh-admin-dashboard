import { useState } from 'react';
import { X, Plus, Trash2, Lock } from 'lucide-react';
import { TASK_STATUSES, TASK_PRIORITIES } from '../lib/tasksData';
import { parseLabels } from '../lib/taskHelpers';
import TaskComments from './TaskComments';

const labelStyle = { display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' };

// Create/edit dialog for the staff task board. `task` is null for a new
// task (with `defaults` carrying the column it was opened from).
export default function TaskModal({ task, defaults, assignees, isAdmin, myEmail, isMockSession, saving, error, onSave, onDelete, onClose, onCommentCountChange }) {
  const [form, setForm] = useState(() => (task
    ? { ...task, labelsText: task.labels.join(', '), checklist: task.checklist.map((c) => ({ ...c })) }
    : { title: '', description: '', status: defaults.status, priority: 'Medium', assigneeEmail: defaults.assigneeEmail || '', dueDate: '', labelsText: '', checklist: [], adminOnly: false }));
  const [newItem, setNewItem] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localError, setLocalError] = useState(null);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const assigneeOptions = form.adminOnly ? assignees.filter((a) => a.role === 'admin') : assignees;
  const assigneeStillValid = !form.assigneeEmail || assigneeOptions.some((a) => a.email === form.assigneeEmail);

  const addItem = () => {
    const text = newItem.trim();
    if (!text || form.checklist.length >= 30) return;
    set({ checklist: [...form.checklist, { text, done: false }] });
    setNewItem('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setLocalError('Give the task a title.'); return; }
    if (!assigneeStillValid) { setLocalError('A private task can only be assigned to an admin.'); return; }
    setLocalError(null);
    onSave({ ...form, labels: parseLabels(form.labelsText) });
  };

  const done = form.checklist.filter((c) => c.done).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{ width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', padding: '28px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{task ? 'Edit task' : 'New task'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div>
          <label htmlFor="task-title" style={labelStyle}>Title</label>
          <input id="task-title" className="form-input" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} autoFocus placeholder="What needs doing?" />
        </div>

        <div>
          <label htmlFor="task-desc" style={labelStyle}>Description</label>
          <textarea id="task-desc" className="form-input" rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={4000} placeholder="Context, links, what done looks like" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div>
            <label htmlFor="task-status" style={labelStyle}>Status</label>
            <select id="task-status" className="form-input" value={form.status} onChange={(e) => set({ status: e.target.value })}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="task-priority" style={labelStyle}>Priority</label>
            <select id="task-priority" className="form-input" value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="task-assignee" style={labelStyle}>Assigned to</label>
            <select id="task-assignee" className="form-input" value={assigneeStillValid ? form.assigneeEmail : ''} onChange={(e) => set({ assigneeEmail: e.target.value })}>
              <option value="">Unassigned</option>
              {assigneeOptions.map((a) => <option key={a.email} value={a.email}>{a.fullName || a.email}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="task-due" style={labelStyle}>Due date</label>
            <input id="task-due" type="date" className="form-input" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          </div>
        </div>

        <div>
          <label htmlFor="task-labels" style={labelStyle}>Labels (comma separated, up to 6)</label>
          <input id="task-labels" className="form-input" value={form.labelsText} onChange={(e) => set({ labelsText: e.target.value })} placeholder="e.g. Sales, Events, Content" />
        </div>

        <div>
          <label style={labelStyle}>Checklist {form.checklist.length > 0 && <span style={{ fontFamily: 'var(--font-mono)' }}>({done}/{form.checklist.length})</span>}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {form.checklist.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" aria-label={`Done: ${item.text}`} checked={item.done} onChange={(e) => set({ checklist: form.checklist.map((c, j) => (j === i ? { ...c, done: e.target.checked } : c)) })} />
                <input className="form-input" aria-label={`Checklist item ${i + 1}`} style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }} value={item.text} maxLength={200} onChange={(e) => set({ checklist: form.checklist.map((c, j) => (j === i ? { ...c, text: e.target.value } : c)) })} />
                <button type="button" aria-label="Remove item" onClick={() => set({ checklist: form.checklist.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-input" aria-label="New checklist item" style={{ flex: 1 }} value={newItem} maxLength={200} placeholder="Add a step" onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} />
              <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={addItem} aria-label="Add checklist item"><Plus size={14} /></button>
            </div>
          </div>
        </div>

        {task && (
          <TaskComments taskId={task.id} assignees={assignees} myEmail={myEmail} isAdmin={isAdmin} isMockSession={isMockSession} onCountChange={onCommentCountChange} />
        )}

        {isAdmin && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.adminOnly} onChange={(e) => set({ adminOnly: e.target.checked })} style={{ marginTop: '3px' }} />
            <span><strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Lock size={13} /> Admins only</strong><br /><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Community managers can't see this task.</span></span>
          </label>
        )}

        {(localError || error) && <p style={{ fontSize: '0.82rem', color: 'var(--danger)' }}>{localError || error}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <div>
            {task && !confirmDelete && <button type="button" className="btn btn-secondary" style={{ color: 'var(--danger)', fontSize: '0.8rem' }} onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete</button>}
            {task && confirmDelete && (
              <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem' }}>
                Delete for good?
                <button type="button" className="btn btn-secondary" style={{ color: 'var(--danger)', fontSize: '0.8rem' }} disabled={saving} onClick={() => onDelete(task)}>Yes, delete</button>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : task ? 'Save changes' : 'Create task'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
