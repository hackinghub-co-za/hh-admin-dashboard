import React, { useState } from 'react';
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
function TooltipButton({ id, icon: Icon, label, active, danger, badge, hoveredId, onHover, onLeave, onClick }) {
  const isHovered = hoveredId === id;
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => onHover(id)} onMouseLeave={onLeave}>
      <button
        onClick={onClick}
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
      <span
        role="tooltip"
        style={{
          position: 'absolute',
          left: 'calc(100% + 10px)',
          top: '50%',
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
      </span>
    </div>
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
