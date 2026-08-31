import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ROADMAP_TRACKS, TEAM_MEMBERS, TRACK_COLORS, OTHER_GROUP_COLOR, TEAM_GROUP_COLOR, groupMembersByDomain } from '../lib/memberOptions';

function initialsFor(name) {
  return (name || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Avatar({ name, imageUrl, size, color }) {
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: size * 0.36,
    color: imageUrl ? undefined : 'var(--accent-ink)',
    background: imageUrl ? 'var(--bg-tertiary)' : `linear-gradient(135deg, ${color || 'var(--accent-cyan)'}, var(--accent-purple))`,
    border: imageUrl ? '1px solid var(--border-color)' : 'none',
  };
  if (imageUrl) {
    return (
      <div style={style}>
        <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return <div style={style}>{initialsFor(name)}</div>;
}

/**
 * The "grouped by domain" alternative to a flat member grid - a Team
 * section (founder + mentors, per TEAM_MEMBERS in memberOptions.js) above a
 * grid of track groups (every real ROADMAP_TRACKS value, plus "Other" for
 * anyone with no track assigned). Each track group starts collapsed to a
 * compact avatar-stack preview and expands to the same full member card
 * `renderCard` already renders in that side's flat grid - no second card
 * design to maintain.
 *
 * Shared between the admin Members tab and the member-facing directory,
 * which is why every field access goes through the getX props instead of
 * assuming a shape - the two rosters use different field names for the
 * same underlying data.
 */
export default function GroupedMemberDirectory({ members, getEmail, getName, getTrack, getAvatarImage, onSelectMember, renderCard }) {
  const [openGroups, setOpenGroups] = useState({});
  const { team, tracks, other } = groupMembersByDomain(members, getEmail, getTrack);

  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const groups = [
    ...ROADMAP_TRACKS.filter((t) => t !== 'Not Assigned').map((name) => ({ key: name, name, color: TRACK_COLORS[name], list: tracks[name] })),
    { key: 'other', name: 'Other', color: OTHER_GROUP_COLOR, list: other },
  ];

  return (
    <div>
      {team.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
            The Team
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {team.map((m) => {
              const email = (getEmail(m) || '').toLowerCase();
              const role = TEAM_MEMBERS.find((t) => t.email.toLowerCase() === email)?.role || 'Team';
              return (
                <div
                  key={email}
                  onClick={() => onSelectMember(m)}
                  className="hover-glow"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 20px',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'rgba(var(--overlay-rgb), 0.02)',
                    border: '1px solid var(--border-color)',
                    borderTop: `2px solid ${TEAM_GROUP_COLOR}`,
                    cursor: 'pointer',
                  }}
                >
                  <Avatar name={getName(m)} imageUrl={getAvatarImage?.(m)} size={44} color={TEAM_GROUP_COLOR} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{getName(m)}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: TEAM_GROUP_COLOR, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '2px' }}>
                      {role}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
        By Domain
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {groups.map((g) => {
          const isOpen = !!openGroups[g.key];
          const sample = g.list.slice(0, 4);
          const overflow = g.list.length - sample.length;

          return (
            <div
              key={g.key}
              onClick={() => toggleGroup(g.key)}
              style={{
                background: 'rgba(var(--overlay-rgb), 0.02)',
                border: '1px solid var(--border-color)',
                borderTop: `2px solid ${g.color}`,
                borderRadius: 'var(--border-radius-md)',
                padding: '18px 20px',
                cursor: 'pointer',
                // Open cards span the full grid width - without this, the
                // roster grid below is stuck rendering inside this card's
                // normal ~280px column and collapses to one narrow stacked
                // column for however many people are in the group, instead
                // of actually laying out as a grid.
                gridColumn: isOpen ? '1 / -1' : 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{g.name}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: g.color,
                    background: `${g.color}26`,
                    border: `1px solid ${g.color}4d`,
                    padding: '3px 9px',
                    borderRadius: '9999px',
                  }}
                >
                  {g.list.length}
                </span>
              </div>

              {g.list.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '14px' }}>Nobody here yet.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', margin: '16px 0 12px' }}>
                    {sample.map((m, i) => (
                      <div key={getEmail(m)} style={{ marginLeft: i === 0 ? 0 : '-10px', border: '2px solid #191b38', borderRadius: '50%' }}>
                        <Avatar name={getName(m)} imageUrl={getAvatarImage?.(m)} size={32} color={g.color} />
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div style={{ marginLeft: '-10px', width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '2px solid #191b38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        +{overflow}
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                    {sample.map((m) => getName(m)).join(', ')}{overflow > 0 ? `, +${overflow} more` : ''}
                  </p>
                </>
              )}

              {g.list.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                  {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  <span>{isOpen ? 'Hide roster' : 'Click to see full roster'}</span>
                </div>
              )}

              {isOpen && g.list.length > 0 && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}
                >
                  {g.list.map((m) => (
                    <div key={getEmail(m)}>{renderCard(m)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
