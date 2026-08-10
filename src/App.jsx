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
  // True only for the Mock Admin/Member dev bypass, which has no real Supabase
  // session - `providerToken` alone isn't reliable for this since Supabase only
  // returns it right after the OAuth redirect, not on session restore.
  const [isMockSession, setIsMockSession] = useState(false);
  // Set when a real (non-mock) sign-in is rejected because the email isn't a
  // recognized active member - shown on the login screen.
  const [accessDeniedMessage, setAccessDeniedMessage] = useState(null);

  useEffect(() => {
    // Members are only let in if `is_member_allowed` (Supabase RPC) says so - it
    // treats member_profiles as the allow-list: no row, or a row marked 'Left',
    // means access is denied. Admins skip this check (unaffected, same as before).
    // Fails closed: any error checking membership results in access being denied,
    // not silently granted.
    const resolveSession = async (session) => {
      setAccessDeniedMessage(null);

      if (!session) {
        setUser(null);
        setProviderToken(null);
        setLoading(false);
        return;
      }

      const email = session.user.email;
      const isAdminEmail = email.endsWith('@hackinghub.co.za');

      if (!isAdminEmail) {
        let allowed;
        try {
          const { data, error } = await supabase.rpc('is_member_allowed', { check_email: email });
          if (error) throw error;
          allowed = data === true;
        } catch (err) {
          console.error('Membership check failed:', err.message);
          allowed = false;
        }

        if (!allowed) {
          await supabase.auth.signOut();
          setAccessDeniedMessage(
            "This Google account isn't recognized as an active Hacking Hub member. If you believe this is a mistake, contact an admin."
          );
          setUser(null);
          setProviderToken(null);
          setLoading(false);
          return;
        }
      }

      setUser({
        email,
        user_metadata: session.user.user_metadata,
        role: isAdminEmail ? 'admin' : 'member',
      });
      setProviderToken(session.provider_token || null);
      setIsMockSession(false);
      setLoading(false);
    };

    // Check initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveSession(session);
    });

    // Listen for Auth changes - this also fires on Supabase's periodic silent token
    // refresh, so a member marked 'Left' while already signed in gets caught here
    // too, not just on their next fresh login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      resolveSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProviderToken(null);
    setIsMockSession(false);
    setActiveTab('dashboard');
  };

  // Callback to handle quick mock dev login
  const handleMockLogin = (mockUser) => {
    setUser(mockUser);
    setProviderToken(null);
    setIsMockSession(true);
    setAccessDeniedMessage(null);
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
    return <Login onLoginSuccess={handleMockLogin} accessDeniedMessage={accessDeniedMessage} />;
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
        {/* Dynamic Dashboard views */}
        {isAdmin ? (
          <AdminDashboard activeTab={activeTab} providerToken={providerToken} isMockSession={isMockSession} />
        ) : (
          <MemberPortal activeTab={activeTab} />
        )}
      </main>
    </div>
  );
}
