import { useState, useEffect } from 'react';
import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, Pencil, Trash2, Mail, Phone, Tag, Clock } from 'lucide-react';
import { fetchProspects, addProspect, updateProspect, updateProspectPhase, deleteProspect } from '../lib/pipelineData';
import { friendlyErrorMessage } from '../lib/errorMessages';

const PHASES = ['Lead', 'Contacted', 'Interested', 'Ready to Join', 'Joined', 'Not Interested'];

const PHASE_COLORS = {
  Lead: 'var(--text-muted)',
  Contacted: 'var(--accent-cyan)',
  Interested: 'var(--accent-purple)',
  'Ready to Join': 'var(--warning)',
  Joined: 'var(--success)',
  'Not Interested': 'var(--danger)',
};

// Local-only demo board for Mock Admin - same "no real Supabase session"
// fallback every other admin feature uses (MOCK_FOCUS_FIVE, etc.). Drag,
// add, edit, and delete all work against this local state only.
const MOCK_PROSPECTS = [
  { id: 'mock-1', fullName: 'Naledi Mokoena', email: 'naledi@example.com', phone: '', phase: 'Lead', source: 'Instagram DM', notes: '', sortOrder: 0, updatedAt: new Date().toISOString() },
  { id: 'mock-2', fullName: 'Karabo Sithole', email: '', phone: '071 234 5678', phase: 'Contacted', source: 'Referral - Sizwe Zwane', notes: 'Following up next week.', sortOrder: 0, updatedAt: new Date().toISOString() },
  { id: 'mock-3', fullName: 'Refilwe Dlamini', email: 'refilwe@example.com', phone: '', phase: 'Interested', source: 'BSides JHB', notes: '', sortOrder: 0, updatedAt: new Date().toISOString() },
  { id: 'mock-4', fullName: 'Blessing Mahlangu', email: '', phone: '', phase: 'Ready to Join', source: 'Referral - Lesoko', notes: 'Just needs to confirm a payment method.', sortOrder: 0, updatedAt: new Date().toISOString() },
];

const EMPTY_FORM = { fullName: '', email: '', phone: '', source: '', notes: '', phase: 'Lead' };

function relativeTime(iso) {
  if (!iso) return 'just now';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function ProspectCard({ prospect, onEdit, onDelete }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '8px' }}>
        <Clock size={10} /> Updated {relativeTime(prospect.updatedAt)}
      </div>
    </div>
  );
}

function PhaseColumn({ phase, prospects, onEdit, onDelete, onAdd }) {
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
            <ProspectCard key={p.id} prospect={p} onEdit={onEdit} onDelete={onDelete} />
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

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchProspects()
      .then((data) => !cancelled && setProspects(data))
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
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
    const columnCount = prospects.filter((p) => p.phase === form.phase).length;
    try {
      if (isMockSession) {
        setProspects((prev) => [...prev, { id: `mock-${Date.now()}`, ...form, sortOrder: columnCount, updatedAt: new Date().toISOString() }]);
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
        setProspects((prev) => prev.map((p) => (p.id === editingProspect.id ? { ...editingProspect, updatedAt: new Date().toISOString() } : p)));
      } else {
        await updateProspect(editingProspect.id, editingProspect);
        if (phaseChanged) {
          const targetColumnCount = prospects.filter((p) => p.phase === editingProspect.phase && p.id !== editingProspect.id).length;
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

    const activeProspect = prospects.find((p) => p.id === active.id);
    if (!activeProspect) return;

    const overId = over.id;
    const overIsColumn = typeof overId === 'string' && overId.startsWith('column-');
    const targetPhase = overIsColumn ? overId.slice('column-'.length) : (prospects.find((p) => p.id === overId)?.phase || activeProspect.phase);
    const sourcePhase = activeProspect.phase;

    const withoutActive = prospects.filter((p) => p.id !== active.id);
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

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Sales Pipeline</h1>
          <p>People interested in or about to join Hacking Hub - drag a card between phases as they move through.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openAddForm('Lead')}>
          <Plus size={16} /> Add Prospect
        </button>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

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
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
            {PHASES.map((phase) => (
              <PhaseColumn
                key={phase}
                phase={phase}
                prospects={prospects.filter((p) => p.phase === phase).sort((a, b) => a.sortOrder - b.sortOrder)}
                onEdit={(p) => setEditingProspect({ ...p, _originalPhase: p.phase })}
                onDelete={handleDelete}
                onAdd={openAddForm}
              />
            ))}
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
            <input className="form-input" placeholder="Source, e.g. Referral - name, Instagram, an event" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <textarea className="form-input" rows={2} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phase</label>
              <select className="form-input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ justifyContent: 'center', marginTop: '4px' }}>
              {saving ? 'Adding...' : 'Add Prospect'}
            </button>
          </form>
        </div>
      )}

      {editingProspect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditingProspect(null)}>
          <div onClick={(e) => e.stopPropagation()} className="glass-card" style={{ width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ margin: 0 }}>Edit Prospect</h3>
              <button type="button" onClick={() => setEditingProspect(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <input className="form-input" placeholder="Full name" value={editingProspect.fullName} onChange={(e) => setEditingProspect({ ...editingProspect, fullName: e.target.value })} />
            <input className="form-input" type="email" placeholder="Email" value={editingProspect.email || ''} onChange={(e) => setEditingProspect({ ...editingProspect, email: e.target.value })} />
            <input className="form-input" placeholder="Phone" value={editingProspect.phone || ''} onChange={(e) => setEditingProspect({ ...editingProspect, phone: e.target.value })} />
            <input className="form-input" placeholder="Source" value={editingProspect.source || ''} onChange={(e) => setEditingProspect({ ...editingProspect, source: e.target.value })} />
            <textarea className="form-input" rows={2} placeholder="Notes" value={editingProspect.notes || ''} onChange={(e) => setEditingProspect({ ...editingProspect, notes: e.target.value })} />
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phase</label>
              <select className="form-input" value={editingProspect.phase} onChange={(e) => setEditingProspect({ ...editingProspect, phase: e.target.value })}>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSaveEdit} style={{ justifyContent: 'center', marginTop: '4px' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
