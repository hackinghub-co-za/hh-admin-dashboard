import { X, ShieldCheck, Ban } from 'lucide-react';

// In-app competition rules for the Competitions tab's "Learn More" button -
// replaces an external Google Doc link with a real, always-in-sync guide,
// same move SecurityPlusGuideModal/LinkedInPlaybookModal already made for
// their own content. Wording here is the actual rule the founder dictated,
// not paraphrased into something looser.
const SECTIONS = [
  {
    heading: 'What counts',
    body: 'Only TryHackMe rooms count - and only once you\'ve posted a screenshot proving it in the WhatsApp group chat. No screenshot, no credit.',
  },
  {
    heading: 'Daily limit',
    body: 'Up to 5 rooms per day, and only one submission per day. Extra rooms beyond 5 on a given day don\'t carry over or add up.',
  },
  {
    heading: 'No blackout days',
    body: 'Every day counts toward the competition, including weekends and public holidays - there\'s no day you\'re locked out of logging.',
  },
  {
    heading: 'Screenshot requirements',
    body: 'Your screenshot must include a visible timestamp. A screenshot with no timestamp can\'t be verified and won\'t be counted.',
  },
  {
    heading: 'Admin verification',
    body: 'Nothing counts until an admin - including Siya himself - has actually reviewed and verified it. A submission sits as Pending until then.',
  },
  {
    heading: 'Zero tolerance for cheating',
    body: 'Caught cheating - a faked screenshot, a room you didn\'t actually complete, anything dishonest - results in a permanent ban from the community. No warnings, no exceptions.',
    danger: true,
  },
];

export default function CompetitionRulesModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 30px rgba(94, 227, 122, 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>Competition Rules</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          How rooms get counted, verified, and disputed - read this before you start logging.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SECTIONS.map((s) => (
            <div
              key={s.heading}
              style={{
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
                ...(s.danger
                  ? { background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--border-radius-sm)', padding: '14px', marginBottom: '-2px' }
                  : {}),
              }}
            >
              <h4
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: s.danger ? 'var(--danger)' : 'var(--accent-cyan)',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {s.danger && <Ban size={14} />} {s.heading}
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={onClose}>Got It</button>
        </div>
      </div>
    </div>
  );
}
