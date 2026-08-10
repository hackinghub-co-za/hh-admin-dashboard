import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import Login from './views/Login';
import AdminDashboard from './views/Admin/AdminDashboard';
import MemberPortal from './views/Member/MemberPortal';
import OnboardingSequence from './components/OnboardingSequence';
import OffboardingSequence from './components/OffboardingSequence';
import GemmaWidget from './components/GemmaWidget';
import { checkOnboardingStatus, markOnboardingComplete } from './lib/onboardingData';
import { checkOffboardingPending, submitExitFeedback } from './lib/offboardingData';
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
  // Gates the member layout behind the first-login onboarding sequence. Admins
  // never see this. Doubles as the "Replay Intro" trigger from the sidebar.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // Gates the member layout behind the farewell/exit-feedback screen when an
  // admin has set this member's status to 'Leaving'. Takes priority over the
  // onboarding gate - a departing member doesn't need the welcome animation.
  const [needsOffboarding, setNeedsOffboarding] = useState(false);
  // One-shot signal: set when a member picks "Set Up My Profile" at the end of
  // onboarding, so the Members tab opens with the edit form already up instead
  // of just landing on the tab. MemberPortal clears it once handled.
  const [autoOpenProfileEdit, setAutoOpenProfileEdit] = useState(false);

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

      if (isAdminEmail) {
        setNeedsOnboarding(false);
        setNeedsOffboarding(false);
      } else {
        let offboarding = false;
        try {
          offboarding = await checkOffboardingPending(email);
        } catch (err) {
          // If the check itself fails, don't force a farewell screen on a member
          // who isn't actually leaving.
          console.error('Offboarding status check failed:', err.message);
        }
        setNeedsOffboarding(offboarding);

        if (offboarding) {
          setNeedsOnboarding(false);
        } else {
          try {
            const completed = await checkOnboardingStatus(email);
            setNeedsOnboarding(!completed);
          } catch (err) {
            // If the check itself fails, don't block a legitimate member from
            // getting into the portal over a one-time welcome animation.
            console.error('Onboarding status check failed:', err.message);
            setNeedsOnboarding(false);
          }
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
    // No real Supabase session to check `onboarded_at` against - just show the
    // sequence once per mock session for members, same as every other
    // mock-gated feature in this app. "Mock Member (Leaving)" instead shows the
    // farewell screen, and skips onboarding entirely (same priority as real
    // sessions above).
    setNeedsOffboarding(!!mockUser.mockLeaving);
    setNeedsOnboarding(mockUser.role !== 'admin' && !mockUser.mockLeaving);
  };

  // Fires from the sequence's "Set Up My Profile" / "Enter the Hub" buttons.
  // `shouldEditProfile` is true only for the former - routes straight to the
  // Members tab with the edit form already open instead of the dashboard.
  const handleOnboardingDone = async (shouldEditProfile) => {
    if (!isMockSession) {
      try {
        await markOnboardingComplete();
      } catch (err) {
        console.error('Failed to persist onboarding completion:', err.message);
      }
    }
    setNeedsOnboarding(false);
    if (shouldEditProfile) {
      setActiveTab('members');
      setAutoOpenProfileEdit(true);
    }
  };

  // "Replay Intro" from the sidebar - re-shows the sequence without touching
  // the persisted `onboarded_at` flag.
  const handleReplayIntro = () => setNeedsOnboarding(true);

  // Fires from OffboardingSequence's "Submit & Disconnect" / "Just Disconnect".
  // Finalizes the member's own row to status = 'Left' (or no-ops under a mock
  // session), then signs them out - access is already revoked from this point,
  // so there's nothing left for them to do in the portal.
  const handleExitDone = async ({ rating, feedback }) => {
    if (!isMockSession) {
      await submitExitFeedback({ rating, feedback });
    }
    await handleLogout();
    setNeedsOffboarding(false);
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

  if (!isAdmin && needsOffboarding) {
    return <OffboardingSequence user={user} onDone={handleExitDone} />;
  }

  if (!isAdmin && needsOnboarding) {
    return <OnboardingSequence user={user} onComplete={handleOnboardingDone} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onReplayIntro={!isAdmin ? handleReplayIntro : undefined}
      />

      {/* Main Panel View Area */}
      <main className="main-content">
        {/* Dynamic Dashboard views */}
        {isAdmin ? (
          <AdminDashboard activeTab={activeTab} providerToken={providerToken} isMockSession={isMockSession} />
        ) : (
          <MemberPortal
            activeTab={activeTab}
            user={user}
            isMockSession={isMockSession}
            autoOpenProfileEdit={autoOpenProfileEdit}
          />
        )}
      </main>

      {/* Gemma - member-only floating assistant, not shown during onboarding/
          offboarding takeovers (this only renders once those gates have passed) */}
      {!isAdmin && <GemmaWidget user={user} isMockSession={isMockSession} />}
    </div>
  );
}
