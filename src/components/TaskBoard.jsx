import { useState, useEffect } from 'react';
import { DndContext, closestCorners, PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Search, Lock, CalendarDays, CheckSquare, Pencil, X } from 'lucide-react';
import TaskModal from './TaskModal';
import { TASK_STATUSES, TASK_PRIORITIES, fetchTasks, fetchTaskAssignees, createTask, updateTask, deleteTask, moveTasks } from '../lib/tasksData';
import { addDaysSast, dueState, formatDueShort, isRecentlyDone, personName, initialsOf, PRIORITY_COLOR, STATUS_COLOR } from '../lib/taskHelpers';
import { friendlyErrorMessage } from '../lib/errorMessages';

// Staff task tracker (supabase/101_staff_tasks.sql). Same drag-and-drop
// shape as the Sales Pipeline board, but a drag is saved in one
// move_staff_tasks() call and the whole column is re-numbered so hidden
// (filtered or old-Done) cards never end up tied with visible ones.

const DUE_COLOR = { overdue: 'var(--danger)', today: 'var(--warning)', soon: 'var(--warning)', later: 'var(--text-muted)' };

const makeMockTasks = (myEmail) => [
  { id: 1, title: 'Follow up with the three Ready to Join prospects', description: '', status: 'To Do', priority: 'High', assigneeEmail: myEmail, dueDate: addDaysSast(1), labels: ['Sales'], checklist: [{ text: 'Call Blessing', done: true }, { text: 'Send payment link', done: false }, { text: 'Log outcome', done: false }], adminOnly: false, sortOrder: 0, completedAt: null },
  { id: 2, title: 'Plan the November meetup', description: 'Venue, speaker, RSVP link.', status: 'In Progress', priority: 'Medium', assigneeEmail: 'thandiwe@example.com', dueDate: addDaysSast(9), labels: ['Events'], checklist: [{ text: 'Shortlist venues', done: true }, { text: 'Confirm speaker', done: false }], adminOnly: false, sortOrder: 0, completedAt: null },
  { id: 3, title: 'Approve pending room logs', description: '', status: 'To Do', priority: 'Urgent', assigneeEmail: 'blessing@example.com', dueDate: addDaysSast(-2), labels: ['Competition'], checklist: [], adminOnly: false, sortOrder: 1, completedAt: null },
  { id: 4, title: 'Review Q4 staff compensation', description: 'Compare against the org chart.', status: 'Backlog', priority: 'Medium', assigneeEmail: myEmail, dueDate: '', labels: ['Finance'], checklist: [], adminOnly: true, sortOrder: 0, completedAt: null },
  { id: 5, title: 'Write the weekly breakdown', description: '', status: 'In Review', priority: 'Medium', assigneeEmail: 'thandiwe@example.com', dueDate: addDaysSast(0), labels: ['Content'], checklist: [], adminOnly: false, sortOrder: 0, completedAt: null },
  { id: 6, title: 'Add curated labs for SOC', description: '', status: 'Backlog', priority: 'Low', assigneeEmail: '', dueDate: '', labels: ['Labs', 'Content'], checklist: [], adminOnly: false, sortOrder: 1, completedAt: null },
  { id: 7, title: 'Publish GRC labs announcement', description: '', status: 'Done', priority: 'Medium', assigneeEmail: myEmail, dueDate: '', labels: ['Labs'], checklist: [], adminOnly: false, sortOrder: 0, completedAt: new Date().toISOString() },
].map((t) => ({ createdBy: myEmail, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...t }));

function TaskCard({ task, assignees, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const due = dueState(task);
  const checkDone = task.checklist.filter((c) => c.done).length;
  const owner = personName(assignees, task.assigneeEmail);
  return (
    <div
      ref={setNodeRef}
      onClick={() => onOpen(task)}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '12px', marginBottom: '8px', cursor: 'grab', touchAction: 'none', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}
      {...attributes}
      {...listeners}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
        <span style={{ fontWeight: 600, fontSize: '0.86rem', lineHeight: 1.35, overflowWrap: 'anywhere', textDecoration: task.status === 'Done' ? 'line-through' : 'none', opacity: task.status === 'Done' ? 0.7 : 1 }}>{task.title}</span>
        <button type="button" aria-label={`Edit ${task.title}`} onClick={(e) => { e.stopPropagation(); onOpen(task); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }}><Pencil size={12} /></button>
      </div>

      {task.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {task.labels.map((l) => <span key={l} style={{ fontSize: '0.66rem', padding: '1px 7px', borderRadius: '999px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{l}</span>)}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: PRIORITY_COLOR[task.priority], fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLOR[task.priority] }} /> {task.priority}
        </span>
        {task.dueDate && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: due ? DUE_COLOR[due] : 'var(--text-muted)', fontWeight: due === 'overdue' ? 700 : 400 }}>
            <CalendarDays size={11} /> {formatDueShort(task.dueDate)}{due === 'overdue' ? ' · overdue' : due === 'today' ? ' · today' : ''}
          </span>
        )}
        {task.checklist.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckSquare size={11} /> {checkDone}/{task.checklist.length}</span>}
        {task.adminOnly && <span title="Admins only" style={{ display: 'inline-flex', alignItems: 'center' }}><Lock size={11} /></span>}
        <span style={{ flex: 1 }} />
        {owner && (
          <span title={owner} aria-label={`Assigned to ${owner}`} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(var(--accent-rgb), 0.15)', color: 'var(--accent-cyan)', display: 'grid', placeItems: 'center', fontSize: '0.62rem', fontWeight: 700 }}>{initialsOf(owner)}</span>
        )}
      </div>
    </div>
  );
}

function Column({ status, tasks, olderCount, showOlder, onToggleOlder, assignees, onOpen, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: '215px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '0 2px' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{status}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{tasks.length}</span>
      </div>
      <div ref={setNodeRef} style={{ flex: 1, minHeight: '120px', padding: '6px', borderRadius: 'var(--border-radius-md)', background: isOver ? 'rgba(var(--accent-rgb), 0.05)' : 'rgba(var(--overlay-rgb), 0.015)', border: `1px dashed ${isOver ? 'var(--accent-cyan)' : 'var(--border-color)'}` }}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <TaskCard key={t.id} task={t} assignees={assignees} onOpen={onOpen} />)}
        </SortableContext>
        {tasks.length === 0 && <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '14px 4px' }}>Drop a task here</p>}
        {olderCount > 0 && (
          <button type="button" onClick={onToggleOlder} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.74rem', padding: '6px' }}>
            {showOlder ? 'Hide older done' : `Show ${olderCount} older done`}
          </button>
        )}
        <button type="button" onClick={() => onAdd(status)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

export default function TaskBoard({ isMockSession, user, isAdmin }) {
  const myEmail = (user?.email || 'you@example.com').toLowerCase();
  const [tasks, setTasks] = useState(() => (isMockSession ? makeMockTasks(myEmail) : []));
  const [assignees, setAssignees] = useState(isMockSession ? [
    { email: myEmail, fullName: 'You', role: 'admin' },
    { email: 'thandiwe@example.com', fullName: 'Thandiwe Nkosi', role: 'community_manager' },
    { email: 'blessing@example.com', fullName: 'Blessing Mahlangu', role: 'community_manager' },
  ] : []);
  const [loading, setLoading] = useState(!isMockSession);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [showOlderDone, setShowOlderDone] = useState(false);
  const [filters, setFilters] = useState({ search: '', assignee: 'all', priority: 'all', label: 'all' });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    Promise.all([fetchTasks(), fetchTaskAssignees()])
      .then(([taskRows, people]) => { if (!cancelled) { setTasks(taskRows); setAssignees(people); } })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = (status) => tasks.filter((t) => t.status === status).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const allLabels = [...new Set(tasks.flatMap((t) => t.labels))].sort((a, b) => a.localeCompare(b));
  const filtersActive = filters.search.trim() !== '' || filters.assignee !== 'all' || filters.priority !== 'all' || filters.label !== 'all';

  const matches = (t) => {
    const q = filters.search.trim().toLowerCase();
    if (q && !`${t.title} ${t.description} ${t.labels.join(' ')}`.toLowerCase().includes(q)) return false;
    if (filters.assignee === 'me' && t.assigneeEmail !== myEmail) return false;
    if (filters.assignee === 'none' && t.assigneeEmail) return false;
    if (filters.assignee !== 'all' && filters.assignee !== 'me' && filters.assignee !== 'none' && t.assigneeEmail !== filters.assignee) return false;
    if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
    if (filters.label !== 'all' && !t.labels.includes(filters.label)) return false;
    return true;
  };

  const visibleIn = (status) => columnOf(status).filter((t) => matches(t) && (status !== 'Done' || showOlderDone || isRecentlyDone(t)));
  const olderDoneCount = columnOf('Done').filter((t) => matches(t) && !isRecentlyDone(t)).length;

  const open = tasks.filter((t) => t.status !== 'Done');
  const overdue = open.filter((t) => dueState(t) === 'overdue').length;
  const dueSoon = open.filter((t) => ['today', 'soon'].includes(dueState(t))).length;
  const mine = open.filter((t) => t.assigneeEmail === myEmail).length;

  const openNew = (status) => { setModalError(null); setModal({ task: null, defaults: { status, assigneeEmail: filters.assignee === 'me' ? myEmail : '' } }); };
  const openEdit = (task) => { setModalError(null); setModal({ task, defaults: null }); };

  const handleSave = async (form) => {
    setSaving(true);
    setModalError(null);
    try {
      if (!modal.task) {
        const end = Math.max(-1, ...columnOf(form.status).map((t) => t.sortOrder)) + 1;
        if (isMockSession) {
          setTasks((prev) => [...prev, { ...form, id: Math.max(0, ...prev.map((t) => t.id)) + 1, sortOrder: end, createdBy: myEmail, createdAt: '', updatedAt: '', completedAt: form.status === 'Done' ? new Date().toISOString() : null }]);
        } else {
          const created = await createTask(form, end, user?.email);
          setTasks((prev) => [...prev, created]);
        }
      } else {
        const statusChanged = form.status !== modal.task.status;
        const end = Math.max(-1, ...columnOf(form.status).filter((t) => t.id !== modal.task.id).map((t) => t.sortOrder)) + 1;
        if (isMockSession) {
          setTasks((prev) => prev.map((t) => (t.id === modal.task.id ? { ...t, ...form, sortOrder: statusChanged ? end : t.sortOrder } : t)));
        } else {
          await updateTask(modal.task.id, form);
          if (statusChanged) await moveTasks([{ id: modal.task.id, status: form.status, sortOrder: end }]);
          setTasks(await fetchTasks());
        }
      }
      setModal(null);
    } catch (err) {
      setModalError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task) => {
    setSaving(true);
    setModalError(null);
    try {
      if (!isMockSession) await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setModal(null);
    } catch (err) {
      setModalError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;

    const overIsColumn = typeof over.id === 'string' && over.id.startsWith('column-');
    const targetStatus = overIsColumn ? over.id.slice('column-'.length) : (tasks.find((t) => t.id === over.id)?.status || dragged.status);
    const sourceStatus = dragged.status;

    const target = columnOf(targetStatus).filter((t) => t.id !== dragged.id);
    const overIndex = overIsColumn ? -1 : target.findIndex((t) => t.id === over.id);
    target.splice(overIndex === -1 ? target.length : overIndex, 0, { ...dragged, status: targetStatus });
    const next = target.map((t, i) => ({ id: t.id, status: targetStatus, sortOrder: i }));
    if (targetStatus !== sourceStatus) {
      columnOf(sourceStatus).filter((t) => t.id !== dragged.id).forEach((t, i) => next.push({ id: t.id, status: sourceStatus, sortOrder: i }));
    }
    const current = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const changed = next.filter((m) => current[m.id].status !== m.status || current[m.id].sortOrder !== m.sortOrder);
    if (changed.length === 0) return;

    const byId = Object.fromEntries(changed.map((m) => [m.id, m]));
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (byId[t.id] ? { ...t, status: byId[t.id].status, sortOrder: byId[t.id].sortOrder, completedAt: byId[t.id].status === 'Done' ? (t.completedAt || new Date().toISOString()) : null } : t)));
    if (isMockSession) return;
    try {
      await moveTasks(changed);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setTasks(previous);
    }
  };

  const activeTask = tasks.find((t) => t.id === activeId);
  const selectStyle = { minWidth: 0, fontSize: '0.82rem', padding: '8px 10px' };

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Tasks</h1>
          <p>The team's shared board. Drag a card between columns as work moves. {isAdmin ? 'Mark a task "Admins only" to keep it off community managers\' boards.' : 'Tasks marked admins-only are hidden from you.'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => openNew('To Do')}><Plus size={16} /> New task</button>
      </div>

      {isMockSession && <div style={{ padding: '10px 14px', marginBottom: '16px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.84rem' }}>Mock Admin: example tasks, nothing is saved.</div>}
      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '10px 18px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        <span>{open.length} open</span>
        <span style={{ color: overdue ? 'var(--danger)' : undefined, fontWeight: overdue ? 700 : 400 }}>{overdue} overdue</span>
        <span>{dueSoon} due in 2 days</span>
        <span>{mine} assigned to you</span>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" aria-label="Search tasks" placeholder="Search tasks" style={{ ...selectStyle, paddingLeft: '30px', width: '100%' }} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <select className="form-input" aria-label="Filter by assignee" style={{ ...selectStyle, width: 'auto' }} value={filters.assignee} onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}>
          <option value="all">Everyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {assignees.filter((a) => a.email !== myEmail).map((a) => <option key={a.email} value={a.email}>{a.fullName || a.email}</option>)}
        </select>
        <select className="form-input" aria-label="Filter by priority" style={{ ...selectStyle, width: 'auto' }} value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="all">Any priority</option>
          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {allLabels.length > 0 && (
          <select className="form-input" aria-label="Filter by label" style={{ ...selectStyle, width: 'auto' }} value={filters.label} onChange={(e) => setFilters({ ...filters, label: e.target.value })}>
            <option value="all">Any label</option>
            {allLabels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        {filtersActive && <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '7px 12px' }} onClick={() => setFilters({ search: '', assignee: 'all', priority: 'all', label: 'all' })}><X size={13} /> Clear</button>}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading tasks...</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(e.active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '10px', alignItems: 'stretch' }}>
            {TASK_STATUSES.map((status) => {
              const visible = visibleIn(status);
              return (
                <Column
                  key={status}
                  status={status}
                  tasks={visible}
                  olderCount={status === 'Done' ? olderDoneCount : 0}
                  showOlder={showOlderDone}
                  onToggleOlder={() => setShowOlderDone((s) => !s)}
                  assignees={assignees}
                  onOpen={openEdit}
                  onAdd={openNew}
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeTask ? <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--border-radius-sm)', padding: '12px', width: '230px', fontWeight: 600, fontSize: '0.86rem', boxShadow: 'var(--glass-shadow)' }}>{activeTask.title}</div> : null}
          </DragOverlay>
        </DndContext>
      )}

      {modal && (
        <TaskModal
          task={modal.task}
          defaults={modal.defaults}
          assignees={assignees}
          isAdmin={isAdmin}
          saving={saving}
          error={modalError}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
