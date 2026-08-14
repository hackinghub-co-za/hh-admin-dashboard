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

  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
    return "Couldn't reach the server. Check your connection and try again.";
  }

  return error?.message || 'Something went wrong. Please try again.';
}
