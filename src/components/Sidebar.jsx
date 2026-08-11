import React from 'react';
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
} from 'lucide-react';
import logo from '../assets/hacking-hub-logo-sm.png';

export default function Sidebar({ user, activeTab, setActiveTab, onLogout, onReplayIntro }) {
  const isAdmin = user?.role === 'admin';

  const menuItems = isAdmin
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'members', label: 'Members', icon: Contact },
        { id: 'meetups', label: 'Meetups & Events', icon: Calendar },
        { id: '1on1s', label: '1on1 Sessions', icon: Users },
        { id: 'payments', label: 'Payments & Subs', icon: CreditCard },
        { id: 'certifications', label: 'Cert Calendar', icon: GraduationCap },
        { id: 'finances', label: 'Finances', icon: DollarSign },
        { id: 'reviews', label: 'Reviews', icon: Star },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
          gap: '12px',
          padding: '0 24px',
          borderBottom: 'var(--glass-border)',
        }}
      >
        <img
          src={logo}
          alt="Hacking Hub"
          style={{
            width: '38px',
            height: '38px',
            objectFit: 'cover',
            borderRadius: 'var(--border-radius-sm)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em' }}>
          HACKING HUB
        </span>
      </div>

      {/* Navigation List */}
      <nav style={{ flexGrow: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--border-radius-sm)',
                background: isActive ? 'rgba(94, 227, 122, 0.08)' : 'transparent',
                border: 'none',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.95rem',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s ease',
              }}
              className="nav-link"
            >
              <Icon size={18} style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Profile Section */}
      <div
        style={{
          padding: '20px 16px',
          borderTop: 'var(--glass-border)',
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
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
              <User size={20} color="var(--text-secondary)" />
            )}
          </div>
          <div style={{ flexGrow: 1, overflow: 'hidden' }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.9rem',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {user?.user_metadata?.full_name || 'HH User'}
            </div>
            <span
              className={`badge ${isAdmin ? 'badge-success' : 'badge-warning'}`}
              style={{ padding: '2px 6px', fontSize: '0.65rem', marginTop: '4px' }}
            >
              {user?.role || 'Member'}
            </span>
          </div>
        </div>

        {onReplayIntro && (
          <button
            onClick={onReplayIntro}
            title="Replay the welcome intro"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px',
              borderRadius: 'var(--border-radius-sm)',
              background: 'rgba(94, 227, 122, 0.06)',
              border: '1px solid rgba(94, 227, 122, 0.15)',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <Terminal size={14} />
            Replay Intro
          </button>
        )}

        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '10px',
            borderRadius: 'var(--border-radius-sm)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--danger)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.2s ease',
          }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
