import { useState, useEffect, useRef } from 'react';
import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, Pencil, Trash2, Mail, Phone, Tag, Clock, ChevronLeft, ChevronRight, MessageSquare, RotateCcw, Archive, BellRing, Link2 } from 'lucide-react';
import { isSafeUrl } from '../lib/safeUrl';
import PipelineStats from './PipelineStats';
import { fetchProspects, addProspect, updateProspect, updateProspectPhase, deleteProspect, restoreProspect, fetchAllProspectNotes, addProspectNote, deleteProspectNote, daysUntilRemoved, STALE_AFTER_DAYS, FOLLOW_UP_PHASES, followUpStatus, sastToday, fetchPhaseChanges } from '../lib/pipelineData';
import { friendlyErrorMessage } from '../lib/errorMessages';

const PHASES = ['Lead', 'Contacted', 'Ready to Join', 'Joined', 'Not Interested', 'Not Qualified'];

const PHASE_COLORS = {
  Lead: 'var(--text-muted)',
  Contacted: 'var(--accent-cyan)',
  'Ready to Join': 'var(--warning)',
  Joined: 'var(--success)',
  'Not Interested': 'var(--danger)',
  'Not Qualified': 'var(--accent-purple)',
};

// Local-only demo board for Mock Admin - same "no real Supabase session"
// fallback every other admin feature uses (MOCK_FOCUS_FIVE, etc.). Drag,
// add, edit, and delete all work against this local state only.
const MOCK_PROSPECTS = [
  { id: 'mock-1', fullName: 'Naledi Mokoena', email: 'naledi@example.com', phone: '', phase: 'Lead', source: 'Instagram DM', notes: '', sortOrder: 0, createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date().toISOString(), leadChannel: 'Instagram' },
  { id: 'mock-2', fullName: 'Karabo Sithole', email: '', phone: '071 234 5678', phase: 'Contacted', source: 'Referral - Sizwe Zwane', notes: 'Following up next week.', sortOrder: 0, createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), updatedAt: new Date().toISOString(), leadChannel: 'Referral', followUpOn: sastToday(new Date(Date.now() - 2 * 86400000)) },
  { id: 'mock-3', fullName: 'Refilwe Dlamini', email: 'refilwe@example.com', phone: '', phase: 'Ready to Join', source: 'BSides JHB', notes: '', sortOrder: 1, createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), updatedAt: new Date().toISOString(), leadChannel: 'Event', followUpOn: sastToday(), linkedinUrl: 'https://www.linkedin.com/in/example' },
  { id: 'mock-4', fullName: 'Blessing Mahlangu', email: '', phone: '', phase: 'Ready to Join', source: 'Referral - Lesoko', notes: 'Just needs to confirm a payment method.', sortOrder: 0, createdAt: new Date(Date.now() - 20 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 17 * 86400000).toISOString() },
  { id: 'mock-5', fullName: 'Thato Molefe', email: 'thato@example.com', phone: '', phase: 'Contacted', source: 'TikTok', notes: '', sortOrder: 1, createdAt: new Date(Date.now() - 34 * 86400000).toISOString(), leadChannel: 'TikTok', updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(), archivedAt: new Date(Date.now() - 9 * 86400000).toISOString() },
];
const MOCK_NOTES = {
  'mock-2': [
    { id: 'mn-2', prospectId: 'mock-2', body: 'Sent the Permanent Access guide. Will decide after payday.', authorEmail: 'siya@hackinghub.co.za', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'mn-1', prospectId: 'mock-2', body: 'First call. Works in IT support, wants SOC.', authorEmail: 'siya@hackinghub.co.za', createdAt: new Date(Date.now() - 6 * 86400000).toISOString() },
  ],
};

const noteTime = (iso) => new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const EMPTY_FORM = { fullName: '', email: '', phone: '', source: '', notes: '', phase: 'Lead', leadChannel: '', followUpOn: '', linkedinUrl: '' };

const shortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-ZA', { timeZone: 'UTC', day: 'numeric', month: 'short' });
};

// Reach-out date (follow_up_on): only for Contacted and Ready to Join cards.
function FollowUpField({ phase, value, onChange }) {
  if (!FOLLOW_UP_PHASES.includes(phase)) return null;
  return (
    <div>
      <label htmlFor="follow-up-on" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reach out on</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input id="follow-up-on" type="date" className="form-input" value={value || ''} min={sastToday()} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
        {value && <button type="button" onClick={() => onChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.78rem', textDecoration: 'underline', padding: 0 }}>Clear</button>}
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Shows on the card and in your 06:00 daily report when it's due.</p>
    </div>
  );
}

// Where the person first heard about Hacking Hub (lead_channel). Add a new
// channel here; the database has no fixed list.
const LEAD_CHANNELS = ['TikTok', 'YouTube', 'LinkedIn', 'Instagram', 'Facebook', 'X (Twitter)', 'WhatsApp', 'Referral', 'Event', 'Google search', 'Website', 'Other'];

function ChannelPicker({ value, onChange }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Where did they hear about us?</label>
      <div role="group" aria-label="Lead channel" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {LEAD_CHANNELS.map((c) => {
          const on = value === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? '' : c)}
              style={{ fontSize: '0.75rem', fontWeight: 600, padding: '5px 10px', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${on ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: on ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent', color: on ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function relativeTime(iso) {
  if (!iso) return 'just now';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function ProspectCard({ prospect, noteCount, onEdit, onDelete }) {
  const daysLeft = daysUntilRemoved(prospect.updatedAt);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: prospect.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '12px', marginBottom: '8px', cursor: 'grab', touchAction: 'none' }}
      {...attributes}
      {...listeners}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{prospect.fullName}</span>
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(prospect); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
            aria-label="Edit prospect"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(prospect); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
            aria-label="Delete prospect"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {(() => {
        const status = followUpStatus(prospect);
        if (!status) return null;
        const color = status === 'overdue' ? 'var(--danger)' : status === 'today' ? 'var(--warning)' : 'var(--text-secondary)';
        const label = status === 'overdue' ? `Reach out: overdue since ${shortDate(prospect.followUpOn)}` : status === 'today' ? 'Reach out today' : `Reach out ${shortDate(prospect.followUpOn)}`;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color, marginTop: '6px' }}>
            <BellRing size={11} /> {label}
          </div>
        );
      })()}
      {prospect.leadChannel && (
        <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(var(--accent-rgb), 0.12)', color: 'var(--accent-cyan)' }}>
          {prospect.leadChannel}
        </span>
      )}
      {prospect.source && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
          <Tag size={10} /> {prospect.source}
        </div>
      )}
      {prospect.email && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
          <Mail size={10} /> {prospect.email}
        </div>
      )}
      {prospect.phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
          <Phone size={10} /> {prospect.phone}
        </div>
      )}
      {isSafeUrl(prospect.linkedinUrl) && (
        <a
          href={prospect.linkedinUrl}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-cyan)', marginTop: '3px', textDecoration: 'none' }}
        >
          <Link2 size={10} /> LinkedIn profile
        </a>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} /> Updated {relativeTime(prospect.updatedAt)}</span>
        {noteCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title={`${noteCount} progress note${noteCount === 1 ? '' : 's'}`}><MessageSquare size={10} /> {noteCount}</span>}
      </div>
      {daysLeft <= 7 && (
        <div style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--warning)', marginTop: '4px' }}>
          {daysLeft === 0 ? 'Comes off the board tonight' : `Comes off the board in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`} unless updated
        </div>
      )}
    </div>
  );
}

function PhaseColumn({ phase, prospects, notesById, onEdit, onDelete, onAdd }) {
  const { setNodeRef } = useDroppable({ id: `column-${phase}` });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '260px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '0 2px' }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: PHASE_COLORS[phase], flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{phase}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({prospects.length})</span>
      </div>
      <div
        ref={setNodeRef}
        style={{ flex: 1, minHeight: '80px', padding: '4px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--overlay-rgb), 0.015)', border: '1px dashed var(--border-color)' }}
      >
        <SortableContext items={prospects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {prospects.map((p) => (
            <ProspectCard key={p.id} prospect={p} noteCount={(notesById[p.id] || []).length} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
        <button
          type="button"
          onClick={() => onAdd(phase)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

export default function SalesPipelineBoard({ isMockSession, user }) {
  const [prospects, setProspects] = useState(isMockSession ? MOCK_PROSPECTS : []);
  const [loading, setLoading] = useState(!isMockSession);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingProspect, setEditingProspect] = useState(null);
  const [notesById, setNotesById] = useState(isMockSession ? MOCK_NOTES : {});
  const [noteDraft, setNoteDraft] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [phaseChanges, setPhaseChanges] = useState([]);
  const [channelFilter, setChannelFilter] = useState('All');
  const [dueOnly, setDueOnly] = useState(false);
  // Cards that have been off the board's 21-day clock are kept but hidden.
  const onBoard = prospects.filter((p) => !p.archivedAt);
  const removed = prospects.filter((p) => p.archivedAt).sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  const dueCount = onBoard.filter((p) => ['overdue', 'today'].includes(followUpStatus(p))).length;

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchProspects()
      .then((data) => !cancelled && setProspects(data))
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    fetchAllProspectNotes()
      .then((byId) => !cancelled && setNotesById(byId))
      .catch(() => {});
    fetchPhaseChanges()
      .then((rows) => !cancelled && setPhaseChanges(rows))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isMockSession]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const openAddForm = (phase) => {
    setForm({ ...EMPTY_FORM, phase });
    setFormOpen(true);
  };

  const handleAddProspect = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    setSaving(true);
    setError(null);
    const columnCount = onBoard.filter((p) => p.phase === form.phase).length;
    try {
      if (isMockSession) {
        setProspects((prev) => [...prev, { id: `mock-${Date.now()}`, ...form, sortOrder: columnCount, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
      } else {
        const created = await addProspect(form, user?.email);
        setProspects((prev) => [...prev, created]);
      }
      setForm(EMPTY_FORM);
      setFormOpen(false);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingProspect) return;
    setSaving(true);
    setError(null);
    const phaseChanged = editingProspect.phase !== editingProspect._originalPhase;
    try {
      if (isMockSession) {
        setProspects((prev) => prev.map((p) => (p.id === editingProspect.id ? { ...editingProspect, updatedAt: new Date().toISOString(), archivedAt: null } : p)));
      } else {
        await updateProspect(editingProspect.id, editingProspect);
        if (phaseChanged) {
          const targetColumnCount = onBoard.filter((p) => p.phase === editingProspect.phase && p.id !== editingProspect.id).length;
          await updateProspectPhase(editingProspect.id, editingProspect.phase, targetColumnCount, true);
        }
        setProspects(await fetchProspects());
      }
      setEditingProspect(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (prospect) => {
    if (!window.confirm(`Remove ${prospect.fullName} from the pipeline?`)) return;
    setError(null);
    const previous = prospects;
    setProspects((prev) => prev.filter((p) => p.id !== prospect.id));
    if (isMockSession) return;
    try {
      await deleteProspect(prospect.id);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setProspects(previous);
    }
  };

  const handleDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeProspect = onBoard.find((p) => p.id === active.id);
    if (!activeProspect) return;

    const overId = over.id;
    const overIsColumn = typeof overId === 'string' && overId.startsWith('column-');
    const targetPhase = overIsColumn ? overId.slice('column-'.length) : (onBoard.find((p) => p.id === overId)?.phase || activeProspect.phase);
    const sourcePhase = activeProspect.phase;

    const withoutActive = onBoard.filter((p) => p.id !== active.id);
    const targetColumnItems = withoutActive.filter((p) => p.phase === targetPhase);
    const overIndex = overIsColumn ? -1 : targetColumnItems.findIndex((p) => p.id === overId);
    const insertAt = overIndex === -1 ? targetColumnItems.length : overIndex;

    const newTargetColumnItems = [...targetColumnItems];
    newTargetColumnItems.splice(insertAt, 0, { ...activeProspect, phase: targetPhase });

    const updates = newTargetColumnItems.map((p, i) => ({
      id: p.id,
      phase: targetPhase,
      sortOrder: i,
      phaseChanged: p.id === active.id && targetPhase !== sourcePhase,
    }));
    if (targetPhase !== sourcePhase) {
      withoutActive.filter((p) => p.phase === sourcePhase).forEach((p, i) => updates.push({ id: p.id, phase: sourcePhase, sortOrder: i, phaseChanged: false }));
    }

    const byId = Object.fromEntries(updates.map((u) => [u.id, u]));
    const nowIso = new Date().toISOString();
    const previous = prospects;
    setProspects((prev) => prev.map((p) => (byId[p.id] ? { ...p, phase: byId[p.id].phase, sortOrder: byId[p.id].sortOrder, updatedAt: byId[p.id].phaseChanged ? nowIso : p.updatedAt } : p)));

    if (isMockSession) return;
    try {
      await Promise.all(updates.map((u) => updateProspectPhase(u.id, u.phase, u.sortOrder, u.phaseChanged)));
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setProspects(previous);
    }
  };

  const activeProspect = prospects.find((p) => p.id === activeId);

  const handleAddNote = async () => {
    const body = noteDraft.trim();
    if (!body || !editingProspect) return;
    const id = editingProspect.id;
    setAddingNote(true);
    setError(null);
    try {
      const note = isMockSession
        ? { id: `mn-${Date.now()}`, prospectId: id, body, authorEmail: user?.email || '', createdAt: new Date().toISOString() }
        : await addProspectNote(id, body, user?.email);
      setNotesById((prev) => ({ ...prev, [id]: [note, ...(prev[id] || [])] }));
      // A note counts as an update: resets the 21 days and brings a removed card back.
      setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, updatedAt: note.createdAt, archivedAt: null } : p)));
      setNoteDraft('');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (prospectId, noteId) => {
    setError(null);
    try {
      if (!isMockSession) await deleteProspectNote(noteId);
      setNotesById((prev) => ({ ...prev, [prospectId]: (prev[prospectId] || []).filter((n) => n.id !== noteId) }));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleRestore = async (prospect) => {
    setError(null);
    const previous = prospects;
    const nowIso = new Date().toISOString();
    setProspects((prev) => prev.map((p) => (p.id === prospect.id ? { ...p, archivedAt: null, updatedAt: nowIso } : p)));
    if (isMockSession) return;
    try {
      await restoreProspect(prospect.id);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setProspects(previous);
    }
  };

  // The board (6 phase columns, 260px each) is wider than most laptop
  // screens fit - overflow-x: auto alone technically supports scrolling it,
  // but on a trackpad/mouse a plain vertical wheel gesture does nothing
  // here (macOS hides an idle scrollbar entirely), which reads as "stuck",
  // especially once a click lands you scrolled toward the right-hand
  // phases with no obvious way back to Lead/Contacted on the left. A wheel
  // handler that redirects vertical scroll into horizontal scroll while
  // hovering the board, plus explicit arrow buttons, makes "how do I get
  // back to the left" always answerable regardless of input device.
  const boardScrollRef = useRef(null);
  const handleBoardWheel = (e) => {
    const el = boardScrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already a horizontal gesture - let it through natively
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };
  const scrollBoardBy = (amount) => {
    boardScrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Sales Pipeline</h1>
          <p>People interested in or about to join Hacking Hub - drag a card between phases as they move through. A card not updated for {STALE_AFTER_DAYS} days comes off the board; open a card to add a progress note.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setDueOnly((v) => !v)} aria-pressed={dueOnly} style={dueOnly ? { borderColor: 'var(--warning)', color: 'var(--warning)' } : undefined}>
            <BellRing size={16} /> {dueOnly ? 'Showing reach-outs due' : `Reach out due (${dueCount})`}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowRemoved((v) => !v)} aria-pressed={showRemoved}>
            <Archive size={16} /> Removed ({removed.length})
          </button>
          <button className="btn btn-primary" onClick={() => openAddForm('Lead')}>
            <Plus size={16} /> Add Prospect
          </button>
        </div>
      </div>

      {!loading && <PipelineStats prospects={prospects} changes={phaseChanges} />}

      {showRemoved && (
        <div className="glass-card" style={{ marginBottom: '20px', padding: '18px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Removed from the board</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>Not updated for {STALE_AFTER_DAYS} days. Kept here, not deleted. Any update, a new note, or the person booking or applying again puts them back on the board.</p>
          {removed.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Nothing has been removed.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {removed.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PHASE_COLORS[p.phase], flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.fullName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.phase} · last updated {relativeTime(p.updatedAt)}{p.source ? ` · ${p.source}` : ''}</div>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingProspect({ ...p, _originalPhase: p.phase })}>Open</button>
                  <button type="button" className="btn btn-secondary" onClick={() => handleRestore(p)}><RotateCcw size={14} /> Put back</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

      {!loading && (
        <div role="group" aria-label="Filter by where they heard about us" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px' }}>Heard about us on:</span>
          {['All', ...LEAD_CHANNELS.filter((c) => onBoard.some((p) => p.leadChannel === c)), 'Not tagged'].map((c) => {
            const n = c === 'All' ? onBoard.length : onBoard.filter((p) => (c === 'Not tagged' ? !p.leadChannel : p.leadChannel === c)).length;
            const on = channelFilter === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setChannelFilter(c)}
                style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${on ? 'var(--accent-cyan)' : 'var(--border-color)'}`, background: on ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent', color: on ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}
              >
                {c} ({n})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading pipeline...</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => scrollBoardBy(-280)}
              aria-label="Scroll pipeline left"
              className="hover-glow"
              style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', boxShadow: 'var(--glass-shadow)' }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scrollBoardBy(280)}
              aria-label="Scroll pipeline right"
              className="hover-glow"
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', boxShadow: 'var(--glass-shadow)' }}
            >
              <ChevronRight size={18} />
            </button>
            <div ref={boardScrollRef} onWheel={handleBoardWheel} style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px', paddingInline: '48px', scrollBehavior: 'smooth' }}>
              {PHASES.map((phase) => (
                <PhaseColumn
                  key={phase}
                  phase={phase}
                  prospects={onBoard.filter((p) => p.phase === phase && (channelFilter === 'All' || (channelFilter === 'Not tagged' ? !p.leadChannel : p.leadChannel === channelFilter)) && (!dueOnly || ['overdue', 'today'].includes(followUpStatus(p)))).sort((a, b) => a.sortOrder - b.sortOrder)}
                  notesById={notesById}
                  onEdit={(p) => setEditingProspect({ ...p, _originalPhase: p.phase })}
                  onDelete={handleDelete}
                  onAdd={openAddForm}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeProspect ? (
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--border-radius-sm)', padding: '12px', width: '250px', fontWeight: 600, fontSize: '0.86rem', boxShadow: 'var(--glass-shadow)' }}>
                {activeProspect.fullName}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setFormOpen(false)}>
          <form
            onSubmit={handleAddProspect}
            onClick={(e) => e.stopPropagation()}
            className="glass-card"
            style={{ width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ margin: 0 }}>Add Prospect</h3>
              <button type="button" onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <input className="form-input" placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required autoFocus />
            <input className="form-input" type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="form-input" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="form-input" type="url" placeholder="LinkedIn profile link (optional)" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
            <ChannelPicker value={form.leadChannel} onChange={(v) => setForm({ ...form, leadChannel: v })} />
            <input className="form-input" placeholder="Source details (optional), e.g. referred by Sizwe, TikTok live" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <textarea className="form-input" rows={2} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phase</label>
              <select className="form-input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <FollowUpField phase={form.phase} value={form.followUpOn} onChange={(v) => setForm({ ...form, followUpOn: v })} />
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ justifyContent: 'center', marginTop: '4px' }}>
              {saving ? 'Adding...' : 'Add Prospect'}
            </button>
          </form>
        </div>
      )}

      {editingProspect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { setEditingProspect(null); setNoteDraft(''); }}>
          <div onClick={(e) => e.stopPropagation()} className="glass-card" style={{ width: '480px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ margin: 0 }}>Edit Prospect</h3>
              <button type="button" onClick={() => setEditingProspect(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <input className="form-input" placeholder="Full name" value={editingProspect.fullName} onChange={(e) => setEditingProspect({ ...editingProspect, fullName: e.target.value })} />
            <input className="form-input" type="email" placeholder="Email" value={editingProspect.email || ''} onChange={(e) => setEditingProspect({ ...editingProspect, email: e.target.value })} />
            <input className="form-input" placeholder="Phone" value={editingProspect.phone || ''} onChange={(e) => setEditingProspect({ ...editingProspect, phone: e.target.value })} />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input className="form-input" type="url" placeholder="LinkedIn profile link" value={editingProspect.linkedinUrl || ''} onChange={(e) => setEditingProspect({ ...editingProspect, linkedinUrl: e.target.value })} style={{ flex: 1 }} />
              {isSafeUrl(editingProspect.linkedinUrl) && <a href={editingProspect.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-cyan)', whiteSpace: 'nowrap' }}>Open</a>}
            </div>
            <ChannelPicker value={editingProspect.leadChannel || ''} onChange={(v) => setEditingProspect({ ...editingProspect, leadChannel: v })} />
            <input className="form-input" placeholder="Source details" value={editingProspect.source || ''} onChange={(e) => setEditingProspect({ ...editingProspect, source: e.target.value })} />
            <textarea className="form-input" rows={2} placeholder="Notes" value={editingProspect.notes || ''} onChange={(e) => setEditingProspect({ ...editingProspect, notes: e.target.value })} />
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phase</label>
              <select className="form-input" value={editingProspect.phase} onChange={(e) => setEditingProspect({ ...editingProspect, phase: e.target.value })}>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <FollowUpField phase={editingProspect.phase} value={editingProspect.followUpOn} onChange={(v) => setEditingProspect({ ...editingProspect, followUpOn: v })} />
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSaveEdit} style={{ justifyContent: 'center', marginTop: '4px' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem' }}>
                <MessageSquare size={15} /> Progress notes
              </div>
              <textarea
                className="form-input"
                rows={2}
                placeholder="What happened? e.g. Called, will pay on Friday"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 2000))}
                aria-label="New progress note"
              />
              <button type="button" className="btn btn-secondary" disabled={!noteDraft.trim() || addingNote} onClick={handleAddNote} style={{ justifyContent: 'center' }}>
                {addingNote ? 'Adding...' : 'Add note'}
              </button>
              {(notesById[editingProspect.id] || []).length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No notes yet. Each note is saved with the date and time, and counts as an update.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(notesById[editingProspect.id] || []).map((n) => (
                    <div key={n.id} style={{ background: 'rgba(var(--overlay-rgb), 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{noteTime(n.createdAt)}{n.authorEmail ? ` · ${n.authorEmail}` : ''}</span>
                        <button type="button" onClick={() => handleDeleteNote(editingProspect.id, n.id)} aria-label="Delete note" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><Trash2 size={12} /></button>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
