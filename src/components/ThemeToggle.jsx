import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getStoredTheme, storeTheme, applyTheme } from '../lib/theme';

// Standalone icon-button version of the theme toggle - lives on the
// member Dashboard, next to the streak badge. The admin sidebar keeps its
// own TooltipButton instance (Sidebar.jsx) since there's no equivalent
// dashboard-header spot on the admin side; both just call the same
// src/lib/theme.js helpers, so either one flipping the theme is
// consistent regardless of which a given session ever sees (a user is
// only ever one role at a time, so the two are never visible together).
export default function ThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    storeTheme(next);
  };

  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        borderRadius: 'var(--border-radius-md)',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
      }}
    >
      <Icon size={19} />
    </button>
  );
}
