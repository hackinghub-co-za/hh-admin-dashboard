import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Users,
  CreditCard,
  GraduationCap,
  DollarSign,
  LogOut,
  User,
  Contact,
  Trophy,
  Briefcase,
  Library,
  Star,
  Terminal,
  Milestone,
  Handshake,
  ListChecks,
  Megaphone,
  BarChart3,
} from 'lucide-react';
import logo from '../assets/hacking-hub-logo-sm.png';
import ReleaseNotesModal from './ReleaseNotesModal';
import { LATEST_RELEASE_VERSION } from '../data/releaseNotes';

const LAST_SEEN_RELEASE_KEY = 'hh_last_seen_release';

// Icon-only rail - every interactive item reveals its label as a tooltip on
// hover rather than showing text inline, so the sidebar stays a fixed narrow
// width instead of pushing page content around.
//
// The tooltip renders through a portal into document.body rather than as a
// normal absolutely-positioned child here - the nav list below sets
// overflowY: 'auto' (needed so a long list of items scrolls instead of
// overflowing the screen on shorter viewports), and per the CSS spec,
// setting only one overflow axis forces the other axis to behave as 'auto'
// too rather than staying 'visible'. That silently clipped every tooltip
// the moment it tried to extend past the ~76px sidebar width, well before
// this had any text visible - a real, confirmed bug, not a hypothetical
// one. Rendering into document.body via a portal sidesteps that clipping
// entirely; position is computed from the button's own screen position on
// hover instead of relying on a CSS-relative ancestor.
function TooltipButton({ id, icon: Icon, label, active, danger, badge, hoveredId, onHover, onLeave, onClick }) {
  const isHovered = hoveredId === id;
  const buttonRef = useRef(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const measure = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 10 });
  };

  const handleEnter = () => {
    onHover(id);
    measure();
  };

  // The nav list scrolls (overflowY: 'auto', for a list long enough to
  // outgrow a short viewport) - without this, hovering a button then
  // scrolling the list without moving the mouse leaves the portaled
  // tooltip anchored to where the button used to be, no longer where it
  // now is. Capture-phase listening on window catches the nav's internal
  // scroll even though scroll events don't normally bubble.
  useEffect(() => {
    if (!isHovered) return undefined;
    window.addEventListener('scroll', measure, true);
    return () => window.removeEventListener('scroll', measure, true);
  }, [isHovered]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={handleEnter}
        onMouseLeave={onLeave}
        aria-label={label}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          margin: '0 auto',
          borderRadius: 'var(--border-radius-sm)',
          background: active ? 'rgba(94, 227, 122, 0.08)' : isHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
          border: 'none',
          color: danger ? 'var(--danger)' : active ? 'var(--accent-cyan)' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        }}
      >
        <Icon size={18} />
        {badge && (
          <span
            style={{
              position: 'absolute',
              top: '7px',
              right: '7px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent-cyan)',
              boxShadow: '0 0 0 2px var(--bg-secondary)',
            }}
          />
        )}
      </button>
      {createPortal(
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: isHovered ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(-6px)',
            whiteSpace: 'nowrap',
            padding: '6px 12px',
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--glass-shadow)',
            color: danger ? 'var(--danger)' : 'var(--text-primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            pointerEvents: 'none',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.15s ease, transform 0.15s ease',
            zIndex: 200,
          }}
        >
          {label}
        </span>,
        document.body
      )}
    </>
  );
}

export default function Sidebar({ user, activeTab, setActiveTab, onLogout, onReplayIntro }) {
  const isAdmin = user?.role === 'admin';
  const [hoveredId, setHoveredId] = useState(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const hasUnseenRelease = LATEST_RELEASE_VERSION && (() => {
    try {
      return localStorage.getItem(LAST_SEEN_RELEASE_KEY) !== LATEST_RELEASE_VERSION;
    } catch {
      return false;
    }
  })();

  const openReleaseNotes = () => {
    setShowReleaseNotes(true);
    try {
      localStorage.setItem(LAST_SEEN_RELEASE_KEY, LATEST_RELEASE_VERSION);
    } catch {
      // Storage unavailable (private browsing, etc.) - the badge just won't
      // remember it's been seen next time, which is harmless.
    }
  };

  const menuItems = isAdmin
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'members', label: 'Members', icon: Contact },
        { id: 'roadmaps', label: 'Roadmaps', icon: Milestone },
        { id: 'matchmaker', label: 'Matchmaker', icon: Handshake },
        { id: 'roomlogs', label: 'Room Logs', icon: ListChecks },
        { id: 'meetups', label: 'Meetups & Events', icon: Calendar },
        { id: 'payments', label: 'Payments & Subs', icon: CreditCard },
        { id: 'certifications', label: 'Cert Calendar', icon: GraduationCap },
        { id: 'finances', label: 'Finances', icon: DollarSign },
        { id: 'reviews', label: 'Reviews', icon: Star },
        { id: 'insights', label: 'Insights', icon: BarChart3 },
        { id: 'community-content', label: 'Community Content', icon: Megaphone },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'roadmap', label: 'My Roadmap', icon: Milestone },
        { id: 'matchmaker', label: 'Matchmaker', icon: Handshake },
        { id: 'members', label: 'Members', icon: Users },
        { id: 'meetings', label: '1on1 Meetings', icon: Users },
        { id: 'events', label: 'Events', icon: CalendarDays },
        { id: 'jobs', label: 'Job Board', icon: Briefcase },
        { id: 'resources', label: 'Resources', icon: Library },
        { id: 'certs', label: 'Cert Calendar', icon: GraduationCap },
        { id: 'competitions', label: 'Competitions', icon: Trophy },
        { id: 'reviews', label: 'Reviews', icon: Star },
        { id: 'billing', label: 'My Subscription', icon: CreditCard },
      ];

  return (
    <>
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: 'var(--sidebar-width)',
        background: 'var(--bg-secondary)',
        backdropFilter: 'var(--backdrop-blur)',
        borderRight: 'var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: 'var(--glass-border)',
        }}
      >
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredId('brand')}
          onMouseLeave={() => setHoveredId(null)}
        >
          <img
            src={logo}
            alt="Hacking Hub"
            style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: 'var(--border-radius-sm)' }}
          />
          <span
            role="tooltip"
            style={{
              position: 'absolute',
              left: 'calc(100% + 10px)',
              top: '50%',
              transform: hoveredId === 'brand' ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(-6px)',
              whiteSpace: 'nowrap',
              padding: '6px 12px',
              borderRadius: 'var(--border-radius-sm)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--glass-shadow)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-sans)',
              pointerEvents: 'none',
              opacity: hoveredId === 'brand' ? 1 : 0,
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              zIndex: 200,
            }}
          >
            HACKING HUB
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {menuItems.map((item) => (
          <TooltipButton
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onLeave={() => setHoveredId(null)}
            onClick={() => setActiveTab(item.id)}
          />
        ))}
      </nav>

      {/* Profile Section */}
      <div
        style={{
          padding: '20px 16px',
          borderTop: 'var(--glass-border)',
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredId('profile')}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--bg-tertiary)',
              border: `1px solid ${isAdmin ? 'var(--success)' : 'var(--warning)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User size={18} color="var(--text-secondary)" />
            )}
          </div>
          <span
            role="tooltip"
            style={{
              position: 'absolute',
              left: 'calc(100% + 10px)',
              top: '50%',
              transform: hoveredId === 'profile' ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(-6px)',
              whiteSpace: 'nowrap',
              padding: '6px 12px',
              borderRadius: 'var(--border-radius-sm)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--glass-shadow)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-sans)',
              pointerEvents: 'none',
              opacity: hoveredId === 'profile' ? 1 : 0,
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.user_metadata?.full_name || 'HH User'}</span>
            <span className={`badge ${isAdmin ? 'badge-success' : 'badge-warning'}`} style={{ padding: '2px 6px', fontSize: '0.65rem', width: 'fit-content' }}>
              {user?.role || 'Member'}
            </span>
          </span>
        </div>

        <TooltipButton
          id="whats-new"
          icon={Megaphone}
          label="What's New"
          badge={hasUnseenRelease}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onLeave={() => setHoveredId(null)}
          onClick={openReleaseNotes}
        />

        {onReplayIntro && (
          <TooltipButton
            id="replay-intro"
            icon={Terminal}
            label="Replay Intro"
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onLeave={() => setHoveredId(null)}
            onClick={onReplayIntro}
          />
        )}

        <TooltipButton
          id="sign-out"
          icon={LogOut}
          label="Sign Out"
          danger
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onLeave={() => setHoveredId(null)}
          onClick={onLogout}
        />
      </div>
    </aside>
    {showReleaseNotes && <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />}
    </>
  );
}
