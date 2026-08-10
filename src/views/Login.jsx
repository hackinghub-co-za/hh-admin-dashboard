import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Key, AlertCircle, LogOut } from 'lucide-react';
import logo from '../assets/hacking-hub-logo-sm.png';

export default function Login({ onLoginSuccess, accessDeniedMessage }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const displayMessage = error || accessDeniedMessage;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Developer bypass for quick local testing without real Google credentials.
  // Gated behind import.meta.env.DEV below so Vite strips it out of production
  // builds entirely - it never ships to portal.hackinghub.co.za.
  const handleMockLogin = (role) => {
    const isLeaving = role === 'member-leaving';
    onLoginSuccess({
      email: role === 'admin' ? 'admin@hackinghub.co.za' : 'member@hackinghub.co.za',
      user_metadata: {
        full_name: role === 'admin' ? 'Hacking Hub Admin' : isLeaving ? 'Departing Member' : 'Sanele Khumalo',
        avatar_url: null,
      },
      role: role === 'admin' ? 'admin' : 'member',
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
          maxWidth: '440px',
          padding: '40px 32px',
          textAlign: 'center',
          border: '1px solid rgba(94, 227, 122, 0.15)',
        }}
      >
        <img
          src={logo}
          alt="Hacking Hub"
          style={{
            width: '120px',
            height: '120px',
            objectFit: 'cover',
            borderRadius: 'var(--border-radius-lg)',
            marginBottom: '24px',
            boxShadow: '0 0 30px rgba(94, 227, 122, 0.2)',
          }}
        />

        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>
          HACKING HUB
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>
          Web Portal & Admin Dashboard
        </p>

        {displayMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: 'var(--border-radius-sm)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
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
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', marginBottom: '24px' }}
        >
          {loading ? 'Connecting...' : 'Sign in with Google'}
        </button>

        {import.meta.env.DEV && (
          <>
            <div style={{ position: 'relative', margin: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', background: '#12132b', padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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
