import { useRef, useState } from 'react';
import { X, FileText, Upload, Trash2, ExternalLink } from 'lucide-react';
import { uploadOrgChartDocument, getOrgChartDocumentUrl, deleteOrgChartDocument } from '../lib/orgChartData';
import { friendlyErrorMessage } from '../lib/errorMessages';

// A staff member's documents (contracts and the like) from the Org Chart's
// Documents button. Founder only, files private (lib/orgChartData.js). The
// parent owns the list so the row's document count stays in step. Mock
// Admin lists and "uploads" locally only; opening needs a real session.
export default function StaffDocumentsModal({ member, documents, isMockSession, user, onChange, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const fileRef = useRef(null);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return setError('Files can be up to 20 MB.');
    setBusy(true);
    setError('');
    try {
      const doc = isMockSession
        ? { id: `mock-${Date.now()}`, memberId: member.id, name: file.name, storagePath: '', uploadedBy: user?.email || '', createdAt: new Date().toISOString() }
        : await uploadOrgChartDocument(member.id, file, user?.email);
      onChange([doc, ...documents]);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const open = async (doc) => {
    setError('');
    if (isMockSession) return setError('Mock Admin: documents can only be opened in a real session.');
    // Opened in a tab first, then pointed at the signed link, so the browser
    // doesn't treat it as a pop-up.
    const tab = window.open('', '_blank');
    try {
      const url = await getOrgChartDocumentUrl(doc.storagePath);
      if (tab) tab.location.replace(url);
      else window.location.assign(url);
    } catch (err) {
      if (tab) tab.close();
      setError(friendlyErrorMessage(err));
    }
  };

  const remove = async (doc) => {
    setBusy(true);
    setError('');
    try {
      if (!isMockSession) await deleteOrgChartDocument(doc);
      onChange(documents.filter((d) => d.id !== doc.id));
      setConfirmId(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} color="var(--accent-cyan)" /> Documents</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{member.fullName} · {member.jobTitle}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>Contracts and other staff documents. Only you can see them.</p>

        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={upload} style={{ display: 'none' }} />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()} style={{ width: '100%', justifyContent: 'center', marginBottom: '14px' }}>
          <Upload size={14} /> {busy ? 'Working...' : 'Upload a document'}
        </button>

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0 0 12px' }}>{error}</p>}

        {documents.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No documents yet. PDF, Word or image files, up to 20 MB.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {documents.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                <FileText size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>{d.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Added {new Date(d.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                {confirmId === d.id ? (
                  <>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => remove(d)} style={{ color: 'var(--danger)', padding: '6px 10px', fontSize: '0.75rem' }}>Delete</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setConfirmId(null)} style={{ padding: '6px 10px', fontSize: '0.75rem' }}>Keep</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => open(d)} style={{ padding: '6px 10px', fontSize: '0.75rem' }}><ExternalLink size={12} /> Open</button>
                    <button type="button" onClick={() => setConfirmId(d.id)} aria-label={`Delete ${d.name}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
