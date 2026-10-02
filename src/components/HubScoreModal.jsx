import { useState } from 'react';
import { X, Trophy, Award, CheckCircle2, Target, Flame, CalendarClock, Timer, CalendarCheck, Briefcase, Gift, Flag } from 'lucide-react';
import { HUB_SCORE_TIERS } from '../lib/hubScoreTiers';
import { formatDate } from '../lib/dateFormat';

// Tier thresholds/rewards now live in src/lib/hubScoreTiers.js (shared with
// the Leaderboard section and the admin Claims tab) - the RPC is still the
// source of truth for currentTier/nextTier/pointsToNextTier, this just
// drives the ladder's highlight and the reward/claim rows below it.
const TIERS = HUB_SCORE_TIERS;

const CATEGORY_ROWS = [
  { key: 'certs', icon: Award, label: 'Certs Passed', unit: (c) => `${c.count} cert${c.count === 1 ? '' : 's'}` },
  { key: 'roadmap', icon: CheckCircle2, label: 'Roadmap Items Completed', unit: (c) => `${c.count} item${c.count === 1 ? '' : 's'}` },
  { key: 'rooms', icon: Target, label: 'TryHackMe Rooms Approved', unit: (c) => `${c.count} room${c.count === 1 ? '' : 's'}` },
  { key: 'streak', icon: Flame, label: 'Login Streak Milestone', unit: (c) => (c.days > 0 ? `${c.days}-day best streak` : 'Not reached yet') },
  { key: 'tenure', icon: CalendarClock, label: 'Community Tenure', unit: (c) => `${c.months} month${c.months === 1 ? '' : 's'}` },
  { key: 'study', icon: Timer, label: 'Study Sessions Logged', unit: (c) => `${c.count} session${c.count === 1 ? '' : 's'}` },
  { key: 'events', icon: CalendarCheck, label: 'Events Attended', unit: (c) => `${c.count} event${c.count === 1 ? '' : 's'}` },
  { key: 'job', icon: Briefcase, label: 'Job Landed', unit: (c) => (c.landed ? 'Yes' : 'Not yet') },
];

export default function HubScoreModal({ hubScore, claims = [], onClaim, reviewRequest, onRequestReview, onClose }) {
  const { totalPoints, currentTier, nextTier, pointsToNextTier, categories } = hubScore;
  const [reviewNote, setReviewNote] = useState('');

  // Which ladder segment the member is currently progressing through, for
  // the progress bar - the floor they've already cleared and the ceiling
  // they're climbing toward, not just a flat total/4000 ratio.
  const currentIdx = TIERS.reduce((best, t, i) => (totalPoints >= t.min ? i : best), 0);
  const floor = TIERS[currentIdx].min;
  const ceiling = TIERS[currentIdx + 1]?.min ?? floor;
  const segmentPct = ceiling > floor ? Math.min(100, Math.round(((totalPoints - floor) / (ceiling - floor)) * 100)) : 100;

  const claimForTier = (tierName) => claims.find((c) => c.tier === tierName);

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{ width: '100%', maxWidth: '780px', maxHeight: '85vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-purple)', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Trophy size={22} color="var(--accent-purple)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Hub Score</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '24px' }}>
          <span style={{ fontWeight: 800, fontSize: '2.4rem', lineHeight: 1 }}>{totalPoints}</span>
          <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>points &middot; {currentTier}</span>
        </div>

        {/* Tier ladder - five cards, current tier highlighted, with a
            progress bar for the segment between it and the next one. The
            top tier (Legend) has no nextTier/pointsToNextTier - the bar
            just reads as full with no "N points to go" caption. */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {TIERS.map((t, i) => (
            <div
              key={t.name}
              style={{
                flex: '1 1 100px',
                textAlign: 'center',
                padding: '10px 8px',
                borderRadius: 'var(--border-radius-md)',
                background: i === currentIdx ? 'rgba(var(--accent-rgb), 0.12)' : 'var(--bg-tertiary)',
                border: i === currentIdx ? '1px solid var(--accent-purple)' : '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: i === currentIdx ? 700 : 500 }}>{t.name}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.min}+</div>
            </div>
          ))}
        </div>
        <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: '6px' }}>
          <div style={{ height: '100%', width: `${segmentPct}%`, background: 'var(--accent-purple)', transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '28px' }}>
          {nextTier ? `${pointsToNextTier} points to ${nextTier}` : 'Top tier reached - Legend status'}
        </div>

        {/* Rewards - one row per tier that actually has one (Newcomer
            doesn't), with a Claim button once unlocked or a status badge
            once claimed. Eligibility is re-verified server-side by a
            BEFORE INSERT trigger on claim - this button never has to
            guess, it just reflects what the member can see here. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
          {TIERS.filter((t) => t.reward).map((t) => {
            const unlocked = totalPoints >= t.min;
            const claim = claimForTier(t.name);
            return (
              <div
                key={t.name}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  padding: '12px 14px', borderRadius: 'var(--border-radius-md)',
                  background: t.name === currentTier ? 'rgba(var(--accent-rgb), 0.12)' : 'var(--bg-tertiary)',
                  border: t.name === currentTier ? '1px solid var(--accent-purple)' : '1px solid var(--border-color)',
                  opacity: unlocked ? 1 : 0.55,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gift size={14} /> {t.name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({t.min}+)</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t.reward}</div>
                </div>
                {!unlocked ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Locked</span>
                ) : claim ? (
                  <span className={`badge ${claim.status === 'Fulfilled' || claim.status === 'Approved' ? 'badge-success' : claim.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                    {claim.status}
                  </span>
                ) : (
                  <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '6px 14px' }} onClick={() => onClaim?.(t.name)}>
                    Claim Reward
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Points Review Request - low-key by design, this isn't a primary
            action. If the member already has a Pending request, show its
            status instead of the form so they can't spam duplicates (also
            enforced server-side by a partial unique index). */}
        <div style={{ marginBottom: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          {reviewRequest && reviewRequest.status === 'Pending' ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <Flag size={12} style={{ verticalAlign: '-1px', marginRight: '4px' }} />
              Review requested {formatDate(reviewRequest.requestedAt)} - we'll take a look.
            </p>
          ) : (
            <details>
              <summary style={{ fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Think something's off with your score? Request a review
              </summary>
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="What looks wrong? (optional)"
                  rows={2}
                  style={{ fontSize: '0.8rem', padding: '8px 10px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'inherit', resize: 'vertical' }}
                />
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 14px', alignSelf: 'flex-start' }} onClick={() => onRequestReview?.(reviewNote)}>
                  Request a Review
                </button>
              </div>
            </details>
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>How your score breaks down</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {CATEGORY_ROWS.map(({ key, icon: Icon, label, unit }) => {
            const c = categories[key];
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--border-radius-md)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={16} color="var(--text-secondary)" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{unit(c)}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: c.points > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                  +{c.points}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
