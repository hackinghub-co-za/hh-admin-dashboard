import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import Login from './views/Login';
import LegalPage from './views/LegalPage';
import AdminDashboard from './views/Admin/AdminDashboard';
import MemberPortal from './views/Member/MemberPortal';
import OnboardingSequence from './components/OnboardingSequence';
import OffboardingSequence from './components/OffboardingSequence';
import GemmaWidget from './components/GemmaWidget';
import { checkOnboardingStatus, markOnboardingComplete, getMyGettingStartedGraceStartedAt, fetchMyOnboardingSteps, ONBOARDING_STEPS } from './lib/onboardingData';
import { checkOffboardingPending, submitExitFeedback } from './lib/offboardingData';
import { Compass } from 'lucide-react';

// Full portal access stays open this long past a member's first-login intro
// (or, for anyone already active before this feature shipped, this long
// past the day it shipped - see getting_started_grace_started_at,
// 006_onboarding.sql PART 3) before the Getting Started checklist becomes a
// hard block instead of a dismissible card.
const GETTING_STARTED_GRACE_DAYS = 3;

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
  // Hard-blocks the member layout down to just Dashboard/Meetings/Members
  // (Sidebar + MemberPortal both read this) once a member is
  // GETTING_STARTED_GRACE_DAYS past their grace start and still hasn't
  // finished the Getting Started checklist. Never true for admins or mock
  // sessions. Unlike needsOnboarding/needsOffboarding this doesn't gate the
  // whole layout pre-render - two of the six steps need the real Meetings
  // and Members tabs to actually complete.
  const [gettingStartedGateActive, setGettingStartedGateActive] = useState(false);
  // One-shot signal: set when a member picks "Set Up My Profile" at the end of
  // onboarding, so the Members tab opens with the edit form already up instead
  // of just landing on the tab. MemberPortal clears it once handled.
  const [autoOpenProfileEdit, setAutoOpenProfileEdit] = useState(false);

  useEffect(() => {
    // Members are only let in if `is_member_allowed` (Supabase RPC) says so - it
    // treats member_profiles as the allow-list: no row, or a row marked 'Left',
    // means access is denied. Admins skip this check (unaffected, same as before).
    // Only a definitive "not allowed" result signs the member out - a failure to
    // even complete the check (network blip, transient Supabase error) does NOT.
    // This function reruns on every background token refresh, not just a fresh
    // login (see onAuthStateChange below), so treating a transient check failure
    // as a denial was signing already-legitimate members out mid-session over
    // nothing, forcing them back through the full Google OAuth screen for no
    // reason - that's the "why do I have to keep signing in" bug.
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
        let allowed = true;
        let checkFailed = false;
        try {
          const { data, error } = await supabase.rpc('is_member_allowed', { check_email: email });
          if (error) throw error;
          allowed = data === true;
        } catch (err) {
          console.error('Membership check failed - not signing out over a transient error:', err.message);
          checkFailed = true;
        }

        if (!checkFailed && !allowed) {
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
        setGettingStartedGateActive(false);
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

        let stillOnboarding = true;
        if (offboarding) {
          setNeedsOnboarding(false);
          setGettingStartedGateActive(false);
        } else {
          try {
            const completed = await checkOnboardingStatus(email);
            stillOnboarding = !completed;
            setNeedsOnboarding(stillOnboarding);
          } catch (err) {
            // If the check itself fails, don't block a legitimate member from
            // getting into the portal over a one-time welcome animation.
            console.error('Onboarding status check failed:', err.message);
            setNeedsOnboarding(false);
          }

          // Getting Started hard gate - only relevant once the one-time
          // intro is done (stillOnboarding false), same "fail open on a
          // transient error" philosophy as is_member_allowed/onboarding
          // above: any check failure here just leaves the gate as it was,
          // never locks someone out over a network blip.
          if (!stillOnboarding) {
            try {
              const [graceStartedAt, steps] = await Promise.all([
                getMyGettingStartedGraceStartedAt(),
                fetchMyOnboardingSteps(),
              ]);
              const allStepsDone = ONBOARDING_STEPS.every((s) => !!steps[s.key]);
              const daysSinceGraceStart = graceStartedAt
                ? (Date.now() - new Date(graceStartedAt).getTime()) / (1000 * 60 * 60 * 24)
                : 0;
              setGettingStartedGateActive(!allStepsDone && daysSinceGraceStart > GETTING_STARTED_GRACE_DAYS);
            } catch (err) {
              console.error('Getting Started gate check failed - not blocking over a transient error:', err.message);
              setGettingStartedGateActive(false);
            }
          } else {
            setGettingStartedGateActive(false);
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

  // A background/inactive tab's session token can go stale past its ~1 hour
  // expiry while the tab isn't focused - supabase-js's own auto-refresh timer
  // can be throttled by the browser while backgrounded. Without this, the
  // member's next click after returning to the tab would be the one that
  // discovers the token is dead, surfacing as a raw "permission denied"
  // error. Calling getSession() on focus proactively refreshes it (supabase-js
  // does this internally when the stored session is expired) before that can
  // happen - onAuthStateChange above then re-runs resolveSession with the
  // refreshed session automatically.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    // Mock Member skips straight to the normal portal rather than auto-showing
    // onboarding every time - it was getting in the way of everyday mock testing.
    // The onboarding sequence still exists and still works under Mock Member;
    // trigger it on demand via the "Replay Intro" button in the sidebar instead.
    // "Mock Member (Leaving)" still shows the farewell screen as before.
    setNeedsOffboarding(!!mockUser.mockLeaving);
    setNeedsOnboarding(false);
    setGettingStartedGateActive(false);
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

  // Fires from MemberPortal the instant a gated member finishes their 6th
  // Getting Started step - unlocks the full sidebar/portal live, same
  // session, no reload or re-login needed.
  const handleGettingStartedComplete = () => setGettingStartedGateActive(false);

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

  // Public, unauthenticated legal pages required for Google OAuth verification -
  // rendered ahead of the session/loading check so they don't wait on Supabase
  // and are reachable with zero auth, for both real visitors and Google's review.
  if (window.location.pathname === '/privacy') {
    return <LegalPage page="privacy" />;
  }
  if (window.location.pathname === '/terms') {
    return <LegalPage page="terms" />;
  }

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
        restrictToOnboarding={!isAdmin && gettingStartedGateActive}
      />

      {/* Main Panel View Area */}
      <main className="main-content">
        {/* Dynamic Dashboard views */}
        {isAdmin ? (
          <AdminDashboard activeTab={activeTab} setActiveTab={setActiveTab} providerToken={providerToken} isMockSession={isMockSession} user={user} />
        ) : (
          <MemberPortal
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            user={user}
            providerToken={providerToken}
            isMockSession={isMockSession}
            autoOpenProfileEdit={autoOpenProfileEdit}
            gettingStartedGateActive={gettingStartedGateActive}
            onGettingStartedComplete={handleGettingStartedComplete}
          />
        )}
      </main>

      {/* Gemma - member-only floating assistant, not shown during onboarding/
          offboarding takeovers (this only renders once those gates have passed) */}
      {!isAdmin && <GemmaWidget user={user} isMockSession={isMockSession} />}
    </div>
  );
}
