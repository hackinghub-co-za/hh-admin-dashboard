# Changelog

Every entry here is dated `YYYY.MM.DD` — CalVer, not SemVer. This is an
internal member portal with no external API consumers depending on
major/minor/patch compatibility guarantees, so a date tells you what you
actually want to know: how recent is this, and what shipped around then.
Release tags line up with the Supabase migration files that shipped in the
same batch, so you can always find the corresponding schema changes under
`supabase/0NN_*.sql`.

Not every commit gets an entry — only a batch of changes worth telling
either an admin or a member about. Entries are grouped `Added` / `Changed` /
`Fixed`; anything a member would notice is also written up in plainer
language as a new entry in `src/data/releaseNotes.js`, which powers the
in-app "What's New" panel (the megaphone icon in the sidebar, on both
portals) - that's the real member-facing surface now, not a one-off
Artifact link nobody would think to check. A member sees an unread-badge
dot on that icon whenever `LATEST_RELEASE_VERSION` is newer than what's
saved in their browser's `localStorage`.

## 2026.08.19

### Added
- **Standard Core Foundations catalog** — every assigned roadmap now draws
  its Core Foundations certs from one 8-item list (`CORE_FOUNDATIONS_CATALOG`
  in `src/lib/memberOptions.js`), 4 of 8 required to count as met. Retrofitted
  all 14 existing member roadmaps onto it (real progress on matching items
  preserved, non-matching items dropped - deliberate, explicitly confirmed).
  Admin gets an "Add Standard Foundations" quick-fill.
- **Specialization catalogs + unlock gate** — SOC and Offensive Security now
  have a defined Specialization catalog too. A member's Specialization stays
  hidden until they've completed 5 of the 8 Core Foundations certs *and* an
  admin has explicitly approved that progress - the count alone only makes
  them eligible, since a member can toggle their own items done and nothing
  stopped them from rushing past Core Foundations dishonestly before this.
  Admin gets an "Approve Foundations" / "Revoke Approval" toggle and an "Add
  Standard Specialization" quick-fill. (`035_roadmap_foundations_approval.sql`)
- **Live PayFast payments** — `payfast-webhook` Edge Function actually exists
  now. `notify_url` has pointed at it since day one, but nothing was there to
  receive it - "recent payments" was a manually-regenerated JSON snapshot,
  last updated 2026-08-05. Validates PayFast's signature and confirms with
  PayFast's own `/eng/query/validate` endpoint server-to-server before
  recording anything. (`033_payfast_transactions.sql`)
- Cert Calendar: admins can now edit and delete any entry, not just flip
  Pending/Passed/Failed.

### Changed
- Room Log submissions only accepted while the Competitions cycle is
  actually `Active` - no submitting before kickoff or after it ends.
- Removed the fake "Dashboard Bookings List" from the admin 1on1 Sessions
  tab (four hardcoded fictional members, never wired to anything real) -
  redundant with the genuine Google Calendar sync already in that tab.
- Removed the "Simulate PayFast ITN Transaction" button now that real
  payments record automatically.
- Cert Calendar: removed 7 placeholder entries that were seeded into the
  live table on day one and never real member exam dates.

## 2026.08.17

### Added
- **My Roadmap** — real, coach-authored per-member checklists (Core
  Foundations + Specialization phases), replacing the static "Under
  Construction" tile. Admin authors/edits via a new Roadmaps tab; members
  toggle their own items done. (`028_roadmap.sql`, `029_member_roadmaps.sql`)
- **Matchmaker** — opt-in pool + randomized grouping (2-4 members per group,
  coin-flipped Project/Presentation assignment). Replaces the earlier
  admin-hand-picked-pairs design. (`030_matchmaker.sql`)
- **Daily Room Logs** — members self-report TryHackMe rooms completed today
  (capped at 5, requires confirming WhatsApp proof was posted), pending
  admin approval. Approved logs credit `competition_standings` automatically
  instead of an admin retyping numbers. (`031_daily_room_logs.sql`)
- **Login Streak** — `🔥 N days in a row` badge on the member Dashboard,
  tracked server-side via `record_daily_login()`. (`032_login_streak.sql`)
- **Versioning & release notes strategy** — this file, plus
  `src/data/releaseNotes.js` and the in-app "What's New" panel
  (`ReleaseNotesModal.jsx`) it powers. Members no longer have to be told
  about a separate link - the megaphone icon in the sidebar shows an
  unread dot whenever there's a release they haven't opened yet.

### Changed
- Sidebar collapsed to an icon-only rail with hover tooltips, on both the
  member and admin portals.
- Community allowlist (`021_sync_community_allowlist.sql`) updated: several
  real members restored from the earlier CSV-only revoke list.
- "Recent Certification Victories" on the member Dashboard now shows real
  achievements only (mock entries removed).

### Fixed
- Sidebar nav could get clipped at the bottom on shorter viewports/larger
  menus - now scrolls internally while the header and sign-out stay pinned.
- Members were being force-signed-out mid-session and having to re-auth
  with Google far more often than necessary: the membership check that
  reruns on every background token refresh was treating a transient
  network/RPC error the same as a genuine "not allowed" and signing out
  either way. Now only a definitive denial signs someone out. Also dropped
  `prompt: 'consent'` from the Google OAuth call, which forced the full
  permission-grant screen on every sign-in for no reason this app actually
  needed.

---

<!--
Adding the next entry:
1. New `## YYYY.MM.DD` section, newest at the top.
2. Added / Changed / Fixed - skip a heading if there's nothing under it.
3. Note the migration file(s) a change shipped with, if any.
4. If members would notice or care, add an entry to
   src/data/releaseNotes.js too - that's what the in-app "What's New" panel
   reads from, and it's what actually reaches members, unlike this file.
-->
