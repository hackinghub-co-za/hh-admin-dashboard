// Guards every place a member-controlled URL (LinkedIn, GitHub, TikTok,
// personal website, a submitted event's link, etc.) gets rendered as a
// clickable <a href>. Without this, a member could set one of those fields to
// a `javascript:` (or `data:`, `vbscript:`) URI and have it execute in
// whoever clicks it - a stored XSS running with that viewer's real session,
// since React does not sanitize href values by scheme. Only http/https URLs
// are ever considered safe to render as a link; anything else is treated as
// absent.
export function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
