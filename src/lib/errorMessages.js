// Turns raw Supabase/Postgres errors into clear, actionable text. Without
// this, members and admins see things like "permission denied for function
// get_member_directory" or "JWT expired" straight from Postgres - technically
// accurate, but meaningless to read and gives no hint of what to actually do.
// Anything not matched below is assumed to already be a real, human-written
// message (e.g. our own RAISE EXCEPTION text like "Only siya@hackinghub.co.za
// can approve events", or a plain validation message) and is passed through
// unchanged.
export function friendlyErrorMessage(error) {
  const raw = (error?.message || (typeof error === 'string' ? error : '') || '').toLowerCase();

  if (!raw) return 'Something went wrong. Please try again.';

  // "permission denied for function/table X" - the RPC/table itself rejected
  // an unauthenticated or session-less caller. In practice this almost always
  // means the browser's session token went stale (e.g. the tab sat in the
  // background past the token's expiry) rather than a real access problem,
  // since the app already gates every real screen behind a valid sign-in.
  if (
    raw.includes('permission denied') ||
    raw.includes('jwt expired') ||
    raw.includes('invalid jwt') ||
    raw.includes('row-level security policy')
  ) {
    return "Your session may have expired. Try refreshing the page - if that doesn't help, sign out and sign back in.";
  }

  // PostgREST rejects a token whose "issued at" claim looks later than the
  // server's own clock - in practice this is the signed-in device's system
  // clock being wrong (set manually, or drifted), not a real session
  // problem. Signing out and back in won't fix it (a fresh token has the
  // same "iat" issue if the clock is still wrong), so this needs its own
  // message rather than folding into the session-expired case above.
  if (raw.includes('issued at future') || raw.includes('issued in the future')) {
    return "This device's clock looks out of sync with the real time, which is blocking sign-in. Check your computer's date & time settings (set to automatic/network time), then refresh the page.";
  }

  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
    return "Couldn't reach the server. Check your connection and try again.";
  }

  return error?.message || 'Something went wrong. Please try again.';
}

// Signatures of a genuinely raw database/driver error slipping through
// unmatched above - Postgres constraint/syntax jargon, PostgREST error
// codes, or a raw JS exception - as opposed to one of our own RAISE
// EXCEPTION messages (plain English, written to be read by a member, e.g.
// "You can log between 1 and 5 rooms per day"). Checked as a blocklist
// rather than trying to enumerate every friendly message we've ever
// written, since that list only grows and would be easy to forget to update.
const RAW_ERROR_SIGNATURES = [
  'violates', // constraint violations (unique/check/foreign key/not-null)
  'duplicate key',
  'null value in column',
  'syntax error',
  'relation "',
  "relation '",
  'does not exist',
  'invalid input syntax',
  'pgrst',
  'typeerror',
  'is not a function',
  "cannot read propert",
  'unexpected token',
];

/**
 * The member-facing variant: still gives the specific, actionable text for
 * a session/connectivity problem or one of our own RAISE EXCEPTION
 * messages, but collapses anything that looks like a raw database/driver
 * error into a single friendly line instead of leaking Postgres internals.
 */
export function friendlyMemberErrorMessage(error) {
  const friendly = friendlyErrorMessage(error);
  const lower = friendly.toLowerCase();
  const looksRaw = RAW_ERROR_SIGNATURES.some((sig) => lower.includes(sig));
  return looksRaw ? 'Oops, something is wrong here. Please try again in a moment.' : friendly;
}
