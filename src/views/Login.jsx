import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { friendlyErrorMessage } from '../lib/errorMessages';
import { isPasskeySupported, isUserCancellation, signInWithPasskey } from '../lib/passkeyData';
import { Key, KeyRound, AlertCircle, LogOut, Users, Award, Trophy, CalendarDays } from 'lucide-react';
import logo from '../assets/hacking-hub-logo-sm.png';

const FEATURES = [
  { icon: Users, label: '1-on-1 Mentoring' },
  { icon: Award, label: 'Certification Tracking' },
  { icon: Trophy, label: 'TryHackMe Competitions' },
  { icon: CalendarDays, label: 'Community Events' },
];

export default function Login({ onLoginSuccess, accessDeniedMessage }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const displayMessage = error || accessDeniedMessage;
  const passkeysAvailable = isPasskeySupported();

  // Passkey sign-in: no email typed, the authenticator picks the account.
  // On success supabase-js dispatches SIGNED_IN and App.jsx's
  // onAuthStateChange runs the same membership + role checks as a Google
  // sign-in, so there's nothing to do here but trigger it and surface errors.
  // A member only has a passkey to use here if they added one first from the
  // Security panel after signing in with Google.
  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError(null);
    try {
      await signInWithPasskey();
    } catch (err) {
      if (!isUserCancellation(err)) setError(friendlyErrorMessage(err));
      setPasskeyLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
          // No prompt: 'consent' - that forces Google's full permission-grant
          // screen on every single sign-in, not just the first. This app
          // never persists/uses a Google refresh token server-side (calendar
          // access is only ever the short-lived provider_token from the most
          // recent OAuth redirect - see App.jsx), so there's nothing here
          // that actually needs the forced re-consent; access_type: 'offline'
          // alone is enough to get a fresh token each time a member does
          // need to sign in again.
          queryParams: {
            access_type: 'offline',
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setLoading(false);
    }
  };

  // Developer bypass for quick local testing without real Google credentials.
  // Gated behind import.meta.env.DEV below so Vite strips it out of production
  // builds entirely - it never ships to portal.hackinghub.co.za. Four real
  // roles now (supabase/067_permission_scopes.sql), plus the member-leaving
  // variant - role is passed straight through as the actual role string
  // AdminDashboard/Sidebar key off (`user.role`), not translated through an
  // admin/member boolean the way it used to be.
  const MOCK_IDENTITIES = {
    admin: { email: 'admin@hackinghub.co.za', fullName: 'Hacking Hub Admin' },
    community_manager: { email: 'cm@hackinghub.co.za', fullName: 'Mock Community Manager' },
    mentor: { email: 'mentor@hackinghub.co.za', fullName: 'Mock Mentor' },
    member: { email: 'member@hackinghub.co.za', fullName: 'Sanele Khumalo' },
    'member-leaving': { email: 'member@hackinghub.co.za', fullName: 'Departing Member' },
  };

  const handleMockLogin = (role) => {
    const isLeaving = role === 'member-leaving';
    const identity = MOCK_IDENTITIES[role];
    onLoginSuccess({
      email: identity.email,
      user_metadata: { full_name: identity.fullName, avatar_url: null },
      role: isLeaving ? 'member' : role,
      mockLeaving: isLeaving,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at center, #1c1e42 0%, #0a0b1c 100%)',
        padding: '20px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '40px 32px',
          textAlign: 'center',
          border: '1px solid rgba(var(--accent-rgb), 0.15)',
        }}
      >
        <img
          src={logo}
          alt="Hacking Hub"
          style={{
            width: '96px',
            height: '96px',
            objectFit: 'cover',
            borderRadius: 'var(--border-radius-lg)',
            marginBottom: '20px',
            boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)',
          }}
        />

        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>
          Hacking Hub Portal
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem', lineHeight: 1.6 }}>
          The private membership dashboard for Hacking Hub, a cybersecurity coaching community.
          Members use it to track 1-on-1 mentor sessions, certification progress, TryHackMe
          competitions, and connect with the rest of the community. Sign in below with the Google
          account tied to your membership.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '28px',
          }}
        >
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-sm)',
                background: 'rgba(var(--overlay-rgb), 0.02)',
                border: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                textAlign: 'left',
              }}
            >
              <Icon size={15} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>

        {displayMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: 'var(--border-radius-sm)',
              background: 'rgba(var(--danger-rgb), 0.1)',
              border: '1px solid rgba(var(--danger-rgb), 0.2)',
              color: 'var(--danger)',
              marginBottom: '20px',
              textAlign: 'left',
              fontSize: '0.85rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{displayMessage}</span>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleGoogleLogin}
          disabled={loading || passkeyLoading}
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', marginBottom: passkeysAvailable ? '12px' : '24px' }}
        >
          {loading ? 'Connecting...' : 'Sign in with Google'}
        </button>

        {passkeysAvailable && (
          <button
            className="btn btn-secondary"
            onClick={handlePasskeyLogin}
            disabled={loading || passkeyLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.95rem', marginBottom: '24px' }}
          >
            <KeyRound size={16} />
            {passkeyLoading ? 'Follow your browser’s prompt…' : 'Sign in with a passkey'}
          </button>
        )}

        {import.meta.env.DEV && (
          <>
            <div style={{ position: 'relative', margin: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', background: 'var(--bg-primary)', padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                DEVELOPER MOCK BYPASS (LOCAL DEV ONLY)
              </span>
              <hr style={{ width: '100%', border: 'none', borderTop: '1px solid var(--border-color)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleMockLogin('admin')}
                style={{ fontSize: '0.8rem', justifyContent: 'center', padding: '10px' }}
              >
                <Key size={14} /> Mock Admin
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleMockLogin('member')}
                style={{ fontSize: '0.8rem', justifyContent: 'center', padding: '10px' }}
              >
                <Key size={14} /> Mock Member
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleMockLogin('community_manager')}
                style={{ fontSize: '0.8rem', justifyContent: 'center', padding: '10px' }}
              >
                <Key size={14} /> Mock Community Manager
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleMockLogin('mentor')}
                style={{ fontSize: '0.8rem', justifyContent: 'center', padding: '10px' }}
              >
                <Key size={14} /> Mock Mentor
              </button>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => handleMockLogin('member-leaving')}
              style={{ fontSize: '0.8rem', justifyContent: 'center', padding: '10px', width: '100%', marginTop: '12px' }}
            >
              <LogOut size={14} /> Mock Member (Leaving)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
