import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Plus, Trash2, Pencil, Check, X, ShieldCheck } from 'lucide-react';
import {
  isPasskeySupported,
  isUserCancellation,
  registerPasskey,
  listPasskeys,
  renamePasskey,
  deletePasskey,
} from '../lib/passkeyData';
import { friendlyErrorMessage } from '../lib/errorMessages';
import { formatDate } from '../lib/dateFormat';

// Passkey manager, shown to a signed-in member (Members tab) and to staff
// (sidebar Security button). Google sign-in is unaffected and always
// available - this only adds/removes the optional passkey second way in.
//
// Enrolling needs a real, confirmed Supabase session, so under the Mock
// Admin/Member dev bypass (no session) the panel just explains itself.
export default function SecurityPanel({ isMockSession = false }) {
  const supported = isPasskeySupported();

  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(!isMockSession && supported);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  const refresh = useCallback(async () => {
    try {
      setPasskeys(await listPasskeys());
      setError(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (isMockSession || !supported) return;
    let cancelled = false;
    listPasskeys()
      .then((data) => !cancelled && setPasskeys(data))
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isMockSession, supported]);

  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    try {
      await registerPasskey();
      await refresh();
    } catch (err) {
      if (!isUserCancellation(err)) setError(friendlyErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (pk) => {
    if (!window.confirm(`Remove the passkey "${pk.friendlyName}"? You can still sign in with Google, and add a new passkey any time.`)) return;
    setBusyId(pk.id);
    setError(null);
    // Optimistic - drop it from the list, roll back on failure.
    setPasskeys((cur) => cur.filter((x) => x.id !== pk.id));
    try {
      await deletePasskey(pk.id);
    } catch (err) {
      setError(friendlyErrorMessage(err));
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const startRename = (pk) => {
    setRenamingId(pk.id);
    setRenameDraft(pk.friendlyName);
  };

  const saveRename = async (pk) => {
    const name = renameDraft.trim();
    if (!name || name === pk.friendlyName) { setRenamingId(null); return; }
    setBusyId(pk.id);
    setError(null);
    try {
      await renamePasskey(pk.id, name);
      setPasskeys((cur) => cur.map((x) => (x.id === pk.id ? { ...x, friendlyName: name } : x)));
      setRenamingId(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={18} color="var(--accent-cyan)" />
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Security</h3>
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Add a passkey to sign in with Face ID, Touch ID, Windows Hello, or a
        security key instead of Google. Google always stays available &mdash; a
        passkey is an extra option on the devices you add it to, not a
        replacement.
      </p>

      {isMockSession ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Passkeys need a real sign-in &mdash; not available under the mock dev bypass.
        </p>
      ) : !supported ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          This browser doesn&rsquo;t support passkeys. Try a current version of Chrome, Safari, Edge, or Firefox.
        </p>
      ) : (
        <>
          {error && (
            <p style={{ fontSize: '0.85rem', color: 'var(--danger)', margin: 0 }}>{error}</p>
          )}

          {loading ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading your passkeys&hellip;</p>
          ) : passkeys.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No passkeys yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                    padding: '10px 12px', borderRadius: 'var(--border-radius-sm)',
                    background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)',
                  }}
                >
                  <KeyRound size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flexGrow: 1 }}>
                    {renamingId === pk.id ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          className="form-input"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(pk); if (e.key === 'Escape') setRenamingId(null); }}
                          autoFocus
                          maxLength={60}
                          style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                        />
                        <button onClick={() => saveRename(pk)} disabled={busyId === pk.id} aria-label="Save name" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', display: 'inline-flex' }}><Check size={15} /></button>
                        <button onClick={() => setRenamingId(null)} aria-label="Cancel rename" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }}><X size={15} /></button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{pk.friendlyName}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                          {pk.createdAt ? `added ${formatDate(pk.createdAt)}` : ''}
                          {pk.lastUsedAt ? ` · last used ${formatDate(pk.lastUsedAt)}` : ''}
                        </div>
                      </>
                    )}
                  </div>
                  {renamingId !== pk.id && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => startRename(pk)} disabled={busyId === pk.id} aria-label="Rename passkey" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }}><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(pk)} disabled={busyId === pk.id} aria-label="Remove passkey" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex' }}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleAdd}
            disabled={adding}
            style={{ alignSelf: 'flex-start', fontSize: '0.82rem' }}
          >
            <Plus size={14} /> {adding ? 'Follow your browser’s prompt…' : 'Add a passkey'}
          </button>
        </>
      )}
    </div>
  );
}
