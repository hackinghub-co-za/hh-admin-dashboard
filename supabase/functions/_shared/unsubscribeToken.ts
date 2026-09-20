// Hacking Hub Admin Dashboard - Unsubscribe Link Signing
//
// Every "unsubscribe from these emails" link (job recommendations, roadmap
// reminders, LinkedIn reminders, weekly breakdowns) is clicked from an email
// client with no Supabase session, so the unsubscribe edge functions run
// with --no-verify-jwt and can't check auth.uid() - the only proof that the
// clicker is actually that member is a token only this project could have
// produced. Signs/verifies email addresses with HMAC-SHA256 over a secret
// that never leaves the edge function environment (same shape as
// GOOGLE_TOKEN_ENCRYPTION_KEY in store-google-refresh-token).
//
// Requires this secret set once:
//   supabase secrets set UNSUBSCRIBE_TOKEN_SECRET=<a long random string you make up>

function base64UrlEncode(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signUnsubscribeToken(email: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email.trim().toLowerCase()));
  return base64UrlEncode(signature);
}

// Constant-time by construction - crypto.subtle.verify, not a manual ===
// comparison of the recomputed token.
export async function verifyUnsubscribeToken(email: string, token: string, secret: string): Promise<boolean> {
  if (!email || !token) return false;
  const key = await hmacKey(secret);
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = Uint8Array.from(atob(padded + padding), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  return crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(email.trim().toLowerCase()));
}
