// Passkey (WebAuthn) sign-in and management, on top of Supabase Auth's
// experimental passkey API (enabled in src/lib/supabase.js). Passkeys are a
// SECOND way into the portal - Google OAuth stays exactly as it is. A member
// signs in with Google once, adds a passkey from the Security panel, and can
// then sign in with just the passkey on that device afterward.
//
// A passkey resolves to the same auth.users row (and therefore the same
// verified email) as that member's Google identity, so nothing downstream -
// is_member_allowed, profiles.role, every RLS policy keyed on the email -
// needs to know or care which method was used.
//
// The API is beta; keeping every passkey call in this one module means a
// signature change on Supabase's side is a one-file fix.

import { supabase } from './supabase';

/** True if this browser can do WebAuthn at all. Both the login button and the
 *  "Add a passkey" control hide/disable themselves when this is false rather
 *  than letting a member click into a guaranteed failure. */
export function isPasskeySupported() {
  return typeof window !== 'undefined'
    && typeof window.PublicKeyCredential === 'function';
}

/** A user aborting the OS passkey prompt (Esc, "Cancel", closing the sheet)
 *  comes back as a DOMException - it's not an error worth showing. Callers use
 *  this to swallow the cancel and just re-enable their button. */
export function isUserCancellation(err) {
  const name = err?.name || '';
  const msg = (err?.message || '').toLowerCase();
  return name === 'NotAllowedError'
    || name === 'AbortError'
    || msg.includes('cancel')
    || msg.includes('timed out')
    || msg.includes('not allowed');
}

/** Discoverable-credential sign-in: no email typed, the authenticator shows
 *  the account picker. On success supabase-js dispatches SIGNED_IN and
 *  App.jsx's onAuthStateChange takes over (membership + role checks), same as
 *  after a Google redirect. Throws on real failure; the caller checks
 *  isUserCancellation() first. */
export async function signInWithPasskey() {
  const { data, error } = await supabase.auth.signInWithPasskey();
  if (error) throw error;
  return data;
}

/** Enrol a passkey for the already-signed-in member. Requires a confirmed,
 *  non-anonymous session - which a Google sign-in already is. Runs the full
 *  WebAuthn create() ceremony and verifies it with Supabase Auth. */
export async function registerPasskey() {
  const { data, error } = await supabase.auth.registerPasskey();
  if (error) throw error;
  return data;
}

/** The current member's enrolled passkeys, for the Security panel list. */
export async function listPasskeys() {
  const { data, error } = await supabase.auth.passkey.list();
  if (error) throw error;
  return (data || []).map((p) => ({
    id: p.id,
    friendlyName: p.friendly_name || 'Unnamed passkey',
    createdAt: p.created_at || null,
    lastUsedAt: p.last_used_at || null,
  }));
}

/** Rename a passkey - members end up with "Work laptop", "MacBook", "YubiKey"
 *  once they have more than one and need to tell them apart. */
export async function renamePasskey(passkeyId, friendlyName) {
  const { error } = await supabase.auth.passkey.update({ passkeyId, friendlyName });
  if (error) throw error;
}

/** Remove a passkey. Safe to remove the last one - Google is still there. */
export async function deletePasskey(passkeyId) {
  const { error } = await supabase.auth.passkey.delete({ passkeyId });
  if (error) throw error;
}
