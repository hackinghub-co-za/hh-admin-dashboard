import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate from vite.config.js (kept minimal/production-only) rather than
// merging test config into it - a config-mismatch pattern this codebase has
// hit before (031_daily_room_logs.sql, 024_cert_calendar.sql: an earlier
// file's stale definition silently winning over a later one). Keeping test
// config in its own file means running the app and running the tests can
// never accidentally diverge in confusing ways.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
  },
});
