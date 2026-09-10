import { useState } from 'react';
import { ClipboardList, X, ExternalLink } from 'lucide-react';
import { isSafeUrl } from '../lib/safeUrl';

// Time-boxed "please fill in this form" banner on the member Dashboard.
// Deliberately self-contained and disposable: once SHOW_UNTIL has passed it
// renders nothing, and the whole file can be deleted (plus its one import +
// use in MemberPortal's case 'dashboard').
//
// The PUBLIC Google Form responder link (Send -> link). Set it to '' to
// pull the banner immediately; it also self-retires after SHOW_UNTIL.
const FORM_URL = 'https://forms.gle/Q68Shwk4mKT68nCG6';

// Last day the banner shows, inclusive (YYYY-MM-DD, compared against UTC
// "today" the same way the rest of MemberPortal does). ~5 days from
// 2026-09-10.
const SHOW_UNTIL = '2026-09-15';

const HEADLINE = 'Got two minutes? We need your input.';
const BODY = "We're shaping what comes next for the Hub and your answers steer it. It's short — please fill it in before it closes.";

// Bumping this key (e.g. for a future survey) re-shows the banner to
// everyone who dismissed the previous one.
const STORAGE_KEY = 'hh-survey-banner-2026-09';

const todayISO = () => new Date().toISOString().split('T')[0];

export default function SurveyBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!isSafeUrl(FORM_URL) || todayISO() > SHOW_UNTIL || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* private mode / storage disabled - banner just comes back next load */
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        marginBottom: '24px',
        borderLeft: '3px solid var(--accent-cyan)',
      }}
    >
      <ClipboardList size={22} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{HEADLINE}</div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>{BODY}</p>
        <a
          href={FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ fontSize: '0.82rem', padding: '8px 16px' }}
        >
          <ExternalLink size={14} /> Open the form
        </a>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', flexShrink: 0 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
