import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Key, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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

  // Developer bypass for quick testing of views without credentials
  const handleMockLogin = (role) => {
    onLoginSuccess({
      email: role === 'admin' ? 'admin@hackinghub.co.za' : 'member@hackinghub.co.za',
      user_metadata: {
        full_name: role === 'admin' ? 'Hacking Hub Admin' : 'Sanele Khumalo',
        avatar_url: null,
      },
      role: role,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
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
          border: '1px solid rgba(0, 242, 254, 0.15)',
        }}
      >
        <div style={{ marginBottom: '24px', display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.1)' }}>
          <Shield size={44} color="#00f2fe" />
        </div>
        
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>
          HACKING HUB
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>
          Web Portal & Admin Dashboard
        </p>

        {error && (
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
            <span>{error}</span>
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

        <div style={{ position: 'relative', margin: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ position: 'absolute', background: '#0b0c10', padding: '0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            DEVELOPER MOCK BYPASS
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
      </div>
    </div>
  );
}
