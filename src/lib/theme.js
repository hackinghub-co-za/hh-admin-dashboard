// Theme preference (dark/light) - same localStorage convention as
// LAST_SEEN_RELEASE_KEY in Sidebar.jsx: a module-level, hh_-prefixed key,
// plain functions each wrapped in their own try/catch (private
// browsing/storage-unavailable degrades harmlessly rather than throwing).
// Dark is the default look for this app - light is an explicit opt-in,
// never auto-applied from prefers-color-scheme, so an existing user never
// sees a surprise theme change they didn't ask for.

const THEME_KEY = 'hh_theme';

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable - the choice just won't persist across reloads,
    // harmless.
  }
}

/** Applies the theme to the document root - covers every screen (Login,
 * Legal pages, the loading spinner) since those render outside
 * .app-container, not just the post-auth app shell. */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}
