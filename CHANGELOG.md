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
language in the member-facing release notes (published as an Artifact,
redeployed each time a new batch ships).

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

---

<!--
Adding the next entry:
1. New `## YYYY.MM.DD` section, newest at the top.
2. Added / Changed / Fixed - skip a heading if there's nothing under it.
3. Note the migration file(s) a change shipped with, if any.
4. If members would notice or care, also update the member-facing release
   notes artifact and redeploy it to the same URL.
-->
