import { useState, useEffect } from 'react';
import GemmaAvatar from './gemma/GemmaAvatar';
import GemmaChat from './gemma/GemmaChat';
import { MOCK_WEEKLY_NOTE } from './gemma/gemmaMock';
import { fetchWeeklyNote } from '../lib/gemmaData';
import { logPortalEvent } from '../lib/portalEventsData';

const PILL_DAYS = 7;
const FIRST_SEEN_KEY = 'gemma-first-seen';

// Labelled "Ask Gemma" pill for a member's first week, then just her face.
function shouldShowPill() {
  try {
    const now = Date.now();
    const stored = Number(localStorage.getItem(FIRST_SEEN_KEY));
    if (!stored) {
      localStorage.setItem(FIRST_SEEN_KEY, String(now));
      return true;
    }
    return now - stored < PILL_DAYS * 86400000;
  } catch {
    return true;
  }
}

export default function GemmaWidget({ user, isMockSession, activeTab, setActiveTab }) {
  const [open, setOpen] = useState(false);
  const [pill] = useState(shouldShowPill);
  const [note, setNote] = useState(isMockSession ? MOCK_WEEKLY_NOTE : null);

  useEffect(() => {
    if (isMockSession) return;
    fetchWeeklyNote().then(setNote).catch(() => {});
  }, [isMockSession]);

  useEffect(() => {
    const onDismiss = () => setNote((n) => (n ? { ...n, dismissed: true } : n));
    window.addEventListener('gemma:note-dismissed', onDismiss);
    return () => window.removeEventListener('gemma:note-dismissed', onDismiss);
  }, []);

  if (activeTab === 'gemma') return null;

  const badge = note && !note.dismissed ? 1 : 0;

  return (
    <>
      <button
        className="gemma-launcher"
        data-pill={pill && !open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !isMockSession) logPortalEvent('gemma_opened', { tab: activeTab }).catch(() => {});
        }}
        aria-label={open ? 'Close Gemma' : 'Ask Gemma'}
        aria-expanded={open}
      >
        <GemmaAvatar size={pill && !open ? 36 : 44} online badge={open ? 0 : badge} ring={false} />
        {pill && !open && <span>Ask Gemma</span>}
      </button>

      {open && (
        <div className="gemma-panel" role="dialog" aria-label="Gemma chat">
          <GemmaChat
            user={user}
            isMockSession={isMockSession}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            variant="panel"
            onClose={() => setOpen(false)}
            weeklyNote={note}
            onWeeklyNoteDismissed={() => window.dispatchEvent(new Event('gemma:note-dismissed'))}
          />
        </div>
      )}
    </>
  );
}
