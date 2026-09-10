import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anonymous Key is missing. Please set them in your .env.local file.'
  );
}

// `experimental.passkey` opts into Supabase Auth's passkey (WebAuthn) API -
// still beta as of 2026, so it's off unless explicitly requested. Powers the
// "Sign in with a passkey" button (src/views/Login.jsx) and the passkey
// manager in src/components/SecurityPanel.jsx. The Relying Party name/ID and
// allowed origins are set in the Supabase dashboard (Auth -> Passkeys), not
// here - the client never passes them. RP ID is effectively permanent once
// members start enrolling: changing it invalidates every existing passkey.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    experimental: { passkey: true },
  },
});
