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

## 2026.08.20

### Added
- **Community Content tab** — Community Broadcast and Recent Wins were
  hardcoded arrays in `MemberPortal.jsx`; every update needed a code change
  and a deploy. Both are real tables now (`community_broadcasts`,
  `community_wins`), with full admin CRUD from a new "Community Content"
  tab - members only ever see active rows. Recent Wins also gained a real
  `achieved_date` instead of a static "Today"/"Recently" label - the member
  Dashboard now computes a live relative label from it ("Today", "3 days
  ago", "1 week ago"...), so it stays honest as time passes instead of
  going stale the moment it's written. (`044_community_content.sql`)
- **Cert Calendar member email** — `cert_calendar.member` was always a
  free-text name, so Insights' "time to first cert" had to match it against
  each member's roster display name - approximate, and it undercounts
  anyone whose name is formatted differently between the two tables. A
  member's own self-submitted entry now records their real email
  automatically (enforced server-side, same as `created_by`); admins get an
  optional "Member Email" field on the Add/Edit Cert forms for entries added
  on someone else's behalf. Insights now matches by email first wherever
  it's on file, falling back to name-matching only for older entries
  without one, and the Insights card states exactly how many of each it
  used. Backfilled from `created_by` for existing self-submitted rows.
  (`024_cert_calendar.sql`)

### Changed
- Member Cert Calendar: removed the "Cohort" field from the "Add to Cert
  Calendar" form - new entries default to "General" instead. Existing
  entries with a real cohort are untouched.
- **Room Logs stats** — five stat cards on the admin Room Logs tab, scoped to
  Approved logs only (Pending/Rejected haven't actually been credited, so
  counting them would overstate real activity): total rooms completed and
  avg rooms per member, most active day of the week, who's logged the most
  distinct days (consistency, not just volume), and the best single-day
  room count on record.
- **Manually-set member Start Date** — a member's "Start Date" was always
  just their first PayFast payment, with no way to correct it for anyone
  who joined before ever paying or whose real start date differs. Admins
  can now set it directly on the Members tab; it defaults to the real first
  payment date (still shown separately as "First Payment") but is a true
  override. Insights prefers this manual date first, ahead of the real
  onboarding timestamp and first payment, for every tenure and
  time-to-outcome stat. Members can see their own start date ("Member
  since..." on the Dashboard) but can't edit it themselves - confirmed
  deliberately, so it stays trustworthy for the Insights stats it feeds.
  (`042_manual_start_date.sql`)
- **Insights tab** — replaces "1on1 Session Facilitator" (a read-only Google
  Calendar mirror with no analytics value of its own; the same live 1on1
  data is still available via "Sync Last 1on1 Dates" on the Members tab).
  Real, computed-not-modeled stats: avg tenure for current members vs. avg
  tenure before leaving for departed members (measured separately - blending
  them would understate how long current members have already stuck
  around), avg time from join date to employment, avg time to first
  certification (approximate - matched by name against Cert Calendar, since
  that table stores a free-text name rather than an email), and breakdowns
  by age/gender/location. Every stat states its sample size and shows "—"
  rather than a misleading number when there's not enough real data to
  compute it. Join date prefers the real onboarding timestamp, falling back
  to first PayFast payment for members who joined before onboarding
  existed.
- **Roadmaps: filter by track, and see each member's % complete + job
  readiness** — the "Active Members by Track" chips are now clickable and
  filter the member picker down to just that track; a dropdown does the
  same. Every member in the picker now shows their live checklist
  completion percentage, computed from a single bulk fetch of every
  member's roadmap items (not a per-member query), plus their job
  readiness stage (Not Started / In Progress / Interview Ready / Job
  Placed), same badge as the Members tab - all visible without opening
  each person's checklist first.

### Changed
- **Admin Meetups & Events: mock data replaced with the real Events tab** —
  the "Create Event" form and "Event List" were 100% local, hardcoded state
  (three fake meetups, never touching `community_events`). Replaced with a
  read-only "Live Events" list showing the exact same approved rows the
  member-side Events tab shows, right above the existing (already real)
  Pending Community Events review section. Admins create events the same
  way members do now, from the Events tab; this page is for seeing what's
  live and approving/rejecting what's waiting.

### Added
- **Active Members by Track breakdown, and Active-only Roadmaps picker** — the
  Roadmaps tab's member picker now only lists members whose status is
  Active (Lapsed/Leaving/Left drop out of the list, though a member already
  mid-track keeps their existing roadmap data untouched if their status
  later changes). A new summary card shows how many active members are on
  each track (Not Assigned, SOC, Offensive Security, Cloud Security,
  DevSecOps, IAM, AI Security) at a glance.
- **Manual refresh on Admin Overview** — every tab's data was a one-time
  fetch on mount with no polling or live subscription anywhere, so nothing
  updated without a full page reload. A "Refresh" button now re-runs every
  data fetch across the whole admin dashboard (Members, Payments, Reviews,
  Room Logs, Events, Referrals, Expenses, Cert Calendar, Matchmaker), not
  just the Overview tab's own numbers.
- Meetups & Events: admins can now Reject a pending member-submitted event,
  not just Approve it - permanently removes the submission, from both the
  pending list and its details modal. Open to any admin, unlike Approve
  (still restricted to siya@hackinghub.co.za), since removing an unpublished
  submission is lower-stakes than publishing one community-wide.
- **Delete Permanently for 'Left' members** — a new button on a member's
  profile (only shown once their status is 'Left') permanently deletes their
  profile and hides them from every roster in the admin dashboard (Members,
  Roadmaps, Matchmaker, Room Logs, Referrals), even though the Members list
  is actually built from PayFast payment history and wouldn't otherwise drop
  them. Deliberately scoped to just their profile - payment history,
  reviews, cert calendar entries, room logs, roadmap, and referrals stay
  intact as real records, just no longer linked to a live profile. Requires
  a confirmation dialog; there's no undo once it runs.
  (`040_deleted_members.sql`)
- **Refer a Friend** — members can refer someone to the community from the
  Members tab (name, LinkedIn profile, optional phone number). They can see
  their own past referrals; admins see and manage every referral submitted,
  with the referrer's own name/email alongside it, from a new Referrals
  section at the bottom of the admin Members tab. (`039_referrals.sql`)
- **Business Expenses** — new admin-only log on the Finances tab for money
  going out (tools, coach pay, hosting, marketing, events, other), separate
  from the existing PayFast revenue tracking. Add/edit/delete, standalone
  total — not blended into the PayFast net-margin figures.
  (`037_expenses.sql`)
- Resources: added PortSwigger Web Security Academy and the HH Interview
  Playbook. (`026_resources.sql`)
- Resources: added CompTIA Security+ prep - the official overview,
  Professor Messer's free video course, and ExamCompass practice tests.
  (`026_resources.sql`)
- **Cloud Security Specialization catalog** — AZ-104, SC-200, SC-500,
  Terraform Associate, SC-100, AZ-305. Retrofitted the 2 members already on
  the Cloud Security track onto it (real progress preserved where an old
  item's title matched exactly; non-matching items dropped, same accepted-
  loss pattern as SOC/Offensive Security). Cloud Security now gets the admin
  "Add Standard Specialization" quick-fill too. (`029_member_roadmaps.sql`)
- **DevSecOps Specialization catalog** — Linux Essentials, GH-900, GH-500,
  KCNA, KCSA, Terraform Associate, AZ-104, AZ-400, SC-500, and Python (or any
  programming language, marked optional). No existing members were on the
  DevSecOps track yet, so there was nothing to retrofit - DevSecOps now gets
  the admin "Add Standard Specialization" quick-fill too, closing out the
  last track that didn't have a defined catalog.

### Changed
- Events: added a 4th "Add Event" type, Study Session, alongside HH Meetup,
  Industry Event, and Sunday Catchup. (`019_events.sql`)
- Dashboard: "Recent Certification Victories" renamed to "Recent Wins" and
  broadened beyond certs - added Kiolin's Software Developer internship.
- Dashboard "Upcoming Event" now pulls the real next approved event from
  `community_events` instead of a hardcoded placeholder.
- Events: removed 6 fabricated placeholder events seeded into the live
  `community_events` table on day one. Corrected BSides Cape Town's date
  (was the wrong `2026-09-05`, now the real `2026-12-05`) and added its real
  Quicket registration link. (`019_events.sql`)

### Fixed
- **PayFast checkout was completely broken, and leaking the passphrase to
  every visitor** — checkout URL signing happened client-side in
  `src/lib/payfast.js`, which required `VITE_PAYFAST_PASSPHRASE` to be
  bundled into the browser JS (readable by anyone via devtools - and since
  the webhook trusts that same passphrase to verify a payment is real,
  exposing it would let someone forge a fake "payment succeeded" call).
  Separately, and independently, the hand-rolled client-side MD5
  implementation was actually broken - it called `add32`/`md5cycle`,
  neither ever defined in the file - so the "Upgrade" button has been
  throwing a `ReferenceError` on click regardless. Checkout-URL signing now
  happens entirely server-side in a new `payfast-checkout` Edge Function
  (reusing the same tested `js-md5` library `payfast-webhook` already
  relies on), using the member's own verified session for name/email rather
  than a client-supplied value. The passphrase, merchant ID, and merchant
  key are no longer in any `VITE_*` env var or the client bundle at all.
  (`supabase/functions/payfast-checkout/`)
- **Allowlisted members with no PayFast payment were invisible everywhere**
  — every admin member list (Members, Roadmaps, Matchmaker, Room Logs,
  Referrals) was built only from PayFast payment history plus manually-added
  members, so a real member with real portal access but no payment on
  record (e.g. [REDACTED]) never showed up to assign a track to or
  manage at all. The roster now also includes anyone with a real
  member_profiles row, showing "No Payment Yet" instead of fabricated
  numbers for their payment fields. Chioma is now assigned the DevSecOps
  track. (`029_member_roadmaps.sql`)
- **"Active Members" on Admin Overview didn't match the Members tab** — the
  Overview tile counted distinct PayFast payers in the trailing 35 days,
  completely ignoring `member_profiles.status` - so it excluded
  "Active (Permanent)" members who don't pay recurring dues, manually-added
  members with no PayFast history, and used a different lapse window (35
  days vs the Members tab's 45). Now shows the same status-based count as
  the Members tab's "Active" filter, with a lapsed/leaving breakdown instead
  of the mismatched growth trend.
- **Specialty terminology no longer diverges from Roadmap Track** — the
  "Specialty" dropdown (member's self-described badge) used Red Team/Blue
  Team/Cloud Security/GRC while "Roadmap Track" (coach-assigned) used
  SOC/Offensive Security/Cloud Security/DevSecOps - same concept, two
  different vocabularies, no DevSecOps option at all on the Specialty side.
  Specialty now uses the same names as Roadmap Track (Not Set, SOC,
  Offensive Security, Cloud Security, DevSecOps, IAM, AI Security, GRC), so
  assigning one actually matches the other. Any member already stored as
  'Red Team' or 'Blue Team' was renamed to 'Offensive Security'/'SOC'
  respectively so their profile doesn't silently show an invalid value.
  IAM and AI Security were added as two new options to both lists.
  (`028_roadmap.sql`)

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
