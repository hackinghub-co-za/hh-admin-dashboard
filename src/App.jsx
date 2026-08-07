import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import Login from './views/Login';
import AdminDashboard from './views/Admin/AdminDashboard';
import MemberPortal from './views/Member/MemberPortal';
import { Compass } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [providerToken, setProviderToken] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({
          email: session.user.email,
          user_metadata: session.user.user_metadata,
          role: session.user.email.endsWith('@hackinghub.co.za') ? 'admin' : 'member',
        });
        setProviderToken(session.provider_token || null);
      } else {
        setUser(null);
        setProviderToken(null);
      }
      setLoading(false);
    });

    // Listen for Auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser({
          email: session.user.email,
          user_metadata: session.user.user_metadata,
          role: session.user.email.endsWith('@hackinghub.co.za') ? 'admin' : 'member',
        });
        setProviderToken(session.provider_token || null);
      } else {
        setUser(null);
        setProviderToken(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProviderToken(null);
    setActiveTab('dashboard');
  };

  // Callback to handle quick mock dev login
  const handleMockLogin = (mockUser) => {
    setUser(mockUser);
    setProviderToken(null);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--accent-cyan)' }}>
        <div style={{ textAlign: 'center' }}>
          <Compass className="animate-spin" size={40} style={{ marginBottom: '16px', animation: 'spin 2s linear infinite' }} />
          <div>Initializing Portal...</div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Render sign in screen if no session/user exists
  if (!user) {
    return <Login onLoginSuccess={handleMockLogin} />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      {/* Main Panel View Area */}
      <main className="main-content">
        {/* Localized Floating Header */}
        <header
          style={{
            position: 'absolute',
            top: 0,
            left: 'var(--sidebar-width)',
            right: 0,
            height: 'var(--header-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 32px',
            borderBottom: 'var(--glass-border)',
            background: 'rgba(11, 12, 16, 0.4)',
            backdropFilter: 'var(--backdrop-blur)',
            zIndex: 90,
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Workspace: <strong style={{ color: '#fff' }}>Hacking Hub Portal</strong> | TZ: <strong style={{ color: '#fff' }}>SAST (GMT+2)</strong>
          </div>
        </header>

        {/* Dynamic Dashboard views */}
        {isAdmin ? (
          <AdminDashboard activeTab={activeTab} providerToken={providerToken} />
        ) : (
          <MemberPortal activeTab={activeTab} />
        )}
      </main>
    </div>
  );
}
