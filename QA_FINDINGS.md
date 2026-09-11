# QA Findings

A running QA log for hh-admin-dashboard, produced by the `qa-agent` (`.claude/agents/qa-agent.md`). The app is too large to QA in one pass — each invocation claims one or two unchecked areas below, works them to completion, fixes clear-cut bugs directly (committed to `main`), and logs everything else as a finding for a human call.

Started 2026-09-11.

## Coverage checklist

### Member-facing
- [ ] Dashboard (Journey So Far, Getting Started checklist, login streak, survey banner, next 1-on-1, recommended room, community broadcasts, recent wins, suggested content)
- [x] My Roadmap (Core Foundations / Specialization / Projects / Advanced phases, unlock gates, progress logging, LinkedIn weekly-post plan)
- [ ] Matchmaker (opt-in, group formation, wheel reveal, presentation ratings/showcase)
- [ ] Members directory (search, grouped-by-domain view, profile modal, referrals, Security/passkeys panel)
- [ ] 1-on-1 Meetings (booking, CV Review, Interview Prep, other Gemma tools)
- [ ] Events (RSVP, capacity, images, self-submission flow, past-event filtering)
- [ ] Job Board (member view)
- [ ] Resources (Cert Prep guides, LinkedIn Strategy, Podcasts)
- [ ] Breakdowns (archive list, markdown rendering, unsubscribe)
- [ ] Cert Calendar (booking, Exam Readiness tracker, practice quizzes)
- [ ] Competitions (daily room logs, standings + tie-splitting, Head-to-Head Duels, Room Races, Live Buzzer Trivia, rules guide)
- [ ] Reviews (member view)
- [ ] My Subscription & Upgrades (PayFast checkout, EFT details, merch store + orders)
- [ ] Onboarding sequence + Getting Started hard gate (3-day grace)
- [ ] Offboarding sequence (member marked Leaving, exit feedback)
- [ ] Passkey sign-in + Security panel (member and staff sides, Login.jsx)

### Admin/staff-facing
- [ ] Admin Overview (metrics, churn rate, revenue per member)
- [ ] Members management (roster, status transitions, role assignment gating)
- [x] Roadmaps management (approvals, catalog assignment, Projects proof review)
- [x] Room Logs review (approve/reject, standings updates)
- [ ] Meetups & Events admin (approve/reject, image upload, capacity, add-event auto-approve)
- [ ] Job Board admin
- [ ] Merch Orders
- [ ] Payments & Subscriptions
- [ ] Cert Calendar admin (result marking, cert-pass email trigger)
- [ ] Finances
- [ ] Reviews admin
- [ ] Insights
- [ ] Community Content (broadcasts, wins, suggested content, Weekly Breakdowns management)
- [ ] Team & Roles (role assignment, permission-scope correctness per role)

### Cross-cutting / backend
- [ ] Email edge functions (roadmap-reminder, linkedin-post-reminder, cert-pass, matchmaker-group, weekly-breakdown-email/nudge/unsubscribe)
- [ ] Push notification edge functions (1on1 reminder, new job, streak alert)
- [ ] Gemma AI edge functions (chat, CV/LinkedIn review, interview prep)
- [ ] Cron jobs (schedules correct, CRON_SECRET checked, each job idempotent if it fires twice)
- [ ] RLS/permission-scope audit across `067_permission_scopes.sql` (does every widened table/RPC actually match the intended role matrix?)
- [ ] Referral program (Refer a Friend, reward status transitions)

## Findings log

_(newest first)_

### 2026-09-11

Claimed: **My Roadmap** (member) + **Roadmaps management** (admin) - a natural pair since they're two views onto the same `roadmap_items` data and unlock logic (`supabase/028_roadmap.sql`, `035_roadmap_foundations_approval.sql`, `src/lib/memberOptions.js`, `src/lib/roadmapData.js`, `src/views/Member/MemberPortal.jsx`, `src/views/Admin/AdminDashboard.jsx`).

#### [Roadmaps management] Admin checkbox let a Projects item be marked done without going through proof review
- **Severity**: Medium
- **Where**: `src/views/Admin/AdminDashboard.jsx` - `handleToggleRoadmapItemDone` (~line 468) and its checkbox button in the roadmap item list (~line 3557, pre-fix)
- **What's wrong**: The generic "mark done" checkbox rendered for every roadmap item regardless of phase, including Projects. Clicking it for a Projects item called `updateRoadmapItem()` directly, flipping `completed` but never touching `review_status`/`reviewed_at`/`review_note` - completely bypassing `review_project_submission()`. An admin could end up with `completed = true` while `review_status` stayed `'Not Submitted'` or `'Pending'` forever - the exact split state the Projects proof-review system (`028_roadmap.sql`) exists to prevent. `CHANGELOG.md`'s 2026.09.06 entry explicitly promises "a Projects-phase roadmap item no longer self-completes on click... only an approval ever flips the item to done" - this was a real regression against that documented guarantee, reachable from the admin side even though the member side (`handleToggleMyRoadmapItem` in `MemberPortal.jsx`) already had the equivalent guard.
- **Status**: Fixed (commit `b99dca3`) - the checkbox is now disabled for Projects-phase items (with a tooltip pointing at the Approve/Reject controls below), and `handleToggleRoadmapItemDone` bails out early on `phase === 'Projects'` as a defense-in-depth guard in case anything else calls it later.

#### [Roadmaps management] No admin path to approve a Project that was never submitted
- **Severity**: Low
- **Where**: `src/views/Admin/AdminDashboard.jsx` ~line 3570 - the Approve/Reject controls only render `{item.phase === 'Projects' && item.reviewStatus !== 'Not Submitted' && (...)}`
- **What's wrong**: `review_project_submission()` (the SQL function) has no restriction requiring `review_status` to already be `'Pending'` - an admin calling it directly against a `'Not Submitted'` item would work fine (sets `completed = true`, `review_status = 'Approved'`, `reviewed_at` recorded, `proof_url` stays NULL). But the UI never exposes Approve/Reject unless the member has first submitted a proof URL. So today, if an admin wants to manually credit a Project a member already did (e.g. before this feature existed, or proof was shared outside the app), there is no way to do it through the review flow at all - and after my fix above, the checkbox workaround is gone too, so there is now genuinely no UI path for this case.
- **Is this intentional?** Unclear - could be a deliberate "proof is mandatory, no exceptions" stance, or an oversight where the Approve/Reject buttons just weren't hooked up for the not-yet-submitted case. This is a product call (should manual/no-proof approval be possible at all?), not something to decide unilaterally, so it's logged rather than fixed. If the founder wants manual override, the fix is straightforward: drop the `reviewStatus !== 'Not Submitted'` condition (or add an explicit "Mark done without proof" affordance) so Approve/Reject render for `'Not Submitted'` items too.
- **Status**: Logged, needs a product decision.

Everything else read in this pass (unlock math for Specialization/Projects/Advanced, the `SPECIALIZATION_UNLOCK_MIN` vs `CORE_FOUNDATIONS_MIN_REQUIRED` two-tier gate, the foundations-approval RLS boundary on `member_profiles`, the auto-assign-Core-Foundations trigger on onboarding completion, the `enforce_linkedin_post_item_phase` trigger, the "gone quiet" reminder cadence math) matched its own documentation and held up under a skeptical read - no further bugs found there.

**Next up**: Nothing else claimed this pass. A good next pick from the checklist: **Competitions** (standings + tie-splitting logic, `031_daily_room_logs.sql`/`015_competition_standings.sql` are dense and haven't been read yet) or **My Subscription & Upgrades** (PayFast checkout money-handling, real financial impact if wrong) - both fit the "complex logic / money-handling" bar this project prioritizes. The RLS/permission-scope audit across `067_permission_scopes.sql` is also still fully unclaimed and cross-cutting.

---

Claimed (second pass, same day): **Competitions - daily room logs, standings + tie-splitting, and the rules guide** (member) + **Room Logs review** (admin), per the pick above. Read `015_competition_standings.sql`, `016_days_logged.sql`, `031_daily_room_logs.sql`, `053_competition_opt_out.sql`, the relevant slice of `067_permission_scopes.sql` (it turned out to own the *live* redefinition of `review_daily_room_log`, superseding 031's copy the same way 053 already superseded 015/016 for `rsvp_for_competition` - worth remembering for any future Competitions pass), `src/lib/competitionData.js`, `src/lib/roomLogData.js`, the Competitions tab + `computeCompetitionPrizes` in `MemberPortal.jsx`, `CompetitionRulesModal.jsx`, and the Room Logs admin tab in `AdminDashboard.jsx`. **Not covered**: Head-to-Head Duels (`062_quiz_duels.sql`), Room Races (`063_room_races.sql`), Live Buzzer Trivia (`066_live_trivia.sql`) - real, separate game systems, out of room for this pass. Leaving the **Competitions** checkbox unchecked for that reason; **Room Logs review** is checked off as fully covered.

#### [Competitions] Room log submitted before RSVPing silently never counted
- **Severity**: Medium
- **Where**: `supabase/031_daily_room_logs.sql` - `submit_daily_room_log()`
- **What's wrong**: The "Log Today's Rooms" form has no RSVP gate, but `review_daily_room_log()` credits `competition_standings` by `UPDATE ... WHERE email = v_member_email` - a silent no-op if that member never RSVP'd (no row to match). A member could submit, get an admin approval, see "Locked for the day", and never appear on the leaderboard, with zero error anywhere telling them why - a classic client-side-gate-missing-its-server-side-mirror bug, just inverted (no gate existed at all, anywhere).
- **Status**: Fixed (commit `c0c2436`) - `submit_daily_room_log()` now raises a clear exception pointing back at the RSVP button if the caller has no `competition_standings` row yet. Applied to the live DB via `npm run db:apply`.

#### [Competitions] Concurrent admin/Community Manager review could double-credit standings
- **Severity**: Medium-High
- **Where**: `supabase/067_permission_scopes.sql` - `review_daily_room_log()` (this file, not `031_daily_room_logs.sql`, owns the live definition - see claim note above)
- **What's wrong**: The function credited `competition_standings.rooms_completed`/`days_logged` on every `p_approved = true` call with no check that the log was still `Pending`. A single reviewer can't double-click into this (the admin UI removes Approve/Reject the moment a log leaves Pending), but two reviewers can - and since 067 widened room-log review to Community Managers alongside admins, two people having the same Pending log open at once and both clicking Approve is a realistic scenario, not a hypothetical. Each call would re-add `room_count` to the leaderboard, inflating a number that determines real prize-voucher money.
- **Status**: Fixed (commit `d95b233`) - the credit UPDATE is now scoped to `status = 'Pending'` with a `FOUND` check, which Postgres's row-level locking makes atomic: the second concurrent call sees the already-changed status, matches zero rows, and gets a clear "already reviewed" error instead of double-crediting. Applied to the live DB.

#### [Competitions] Tied leaderboard rows showed different ranks/medals despite splitting the same prize
- **Severity**: Low-Medium
- **Where**: `src/views/Member/MemberPortal.jsx` - the Current Standings table render (~line 6002-6070) and `computeCompetitionPrizes` (~line 2373)
- **What's wrong**: `computeCompetitionPrizes` correctly groups members with equal `rooms` into one tied group and splits their combined prize money evenly (and labels it "(tied)"). But the Rank column and medal color were driven by raw array index (`i + 1`), not the tie group - two members tied for 1st and literally splitting the same R4,500 showed as `#1` gold and `#2` silver, a ranking difference that didn't exist and directly contradicted the "(tied)" label sitting next to their matching prize amounts.
- **Status**: Fixed (commit `c5d69b8`) - rank is now computed with standard tie-aware ("1224") ranking, and medal color follows both that rank and whether the row actually has a prize (so a 0-room member never gets a trophy from sitting in row 2 of a mostly-empty leaderboard).

#### [Competitions] Rules guide claimed "only one submission per day", contradicting the actual/intended behavior
- **Severity**: Cosmetic
- **Where**: `src/components/CompetitionRulesModal.jsx` (Daily limit section) vs. `submit_daily_room_log()` and the in-app form copy ("You can still update the count below until it's reviewed")
- **What's wrong**: Doc-vs-code mismatch per the QA methodology's own call-out. The rules guide is the one that was wrong - the system deliberately allows updating a Pending submission any number of times before review.
- **Status**: Fixed (commit `238d51a`).

#### [Competitions] RSVP display name was trusted from the client, not resolved server-side
- **Severity**: Medium
- **Where**: `supabase/053_competition_opt_out.sql` - `rsvp_for_competition()` (this file owns the live definition, per its own header note superseding `015`/`016`)
- **What's wrong**: `p_member_name` was written straight onto `competition_standings.member_name` - a public leaderboard tied to real prize money (up to R6,000/quarter). The UI always sends the caller's real Google name, but the RPC itself had no check - a signed-in member calling it directly (browser console, or any API client) could pass any string and impersonate another real member, or post anything, in front of the whole community. The rest of this app already avoids exactly this pattern elsewhere (`challenge_to_room_race()` in `063_room_races.sql`, `notify_admin_of_roadmap_completion()` in `061_admin_notifications.sql` both resolve the caller's name server-side from `member_profiles` instead of trusting a parameter) - this RPC was the one place in the Competitions surface still doing it client-supplied.
- **Status**: Fixed (commit `3f3846f`) - now resolves `full_name` from `member_profiles` server-side (same idiom as the two functions above), with the same `COALESCE`-to-email fallback for a member with no `full_name` set. `p_member_name` stays in the signature so the frontend call needed no change. Applied to the live DB.

#### [Competitions] No reset/archival mechanism between quarterly competitions
- **Severity**: Medium-High (not urgent today, but time-sensitive)
- **Where**: `supabase/015_competition_standings.sql` / `016_days_logged.sql` / `053_competition_opt_out.sql` (schema), `src/views/Member/MemberPortal.jsx` - the hardcoded `currentCompetition` object (~line 2347: title "Q3 2026 Community CTF Sprint", `startDate: '2026-08-31'`, `endDate: '2026-10-23'`)
- **What's wrong**: `competition_standings`/`daily_room_logs` have no notion of a competition period at all - no `competition_id`/season column, no admin "start a new competition" action, no archival step. `currentCompetition` is a plain hardcoded literal in the member portal source with no admin UI backing it - changing quarters means editing this object in a code commit. Room logging is correctly blocked outside the active window (`competitionStatus === 'Upcoming'`/`'Ended'`), but the *standings themselves* never reset - `rooms_completed`/`days_logged` just keep accumulating forever. Searched the whole codebase (SQL, admin dashboard, data layer) for any reset/archive/season concept and found none. Today is 2026-09-11, squarely inside the current Q3 window (ends 2026-10-23) - about six weeks out. Whoever updates `currentCompetition` for Q4 will find the leaderboard still showing every member's all-time cumulative total from Q3 (and beyond), not a fresh Q4 count, silently changing who "wins" each quarter's prize unless someone manually zeroes the table first.
- **Is this intentional?** Almost certainly an oversight rather than a decision, since this appears to be the very first competition run through this system (Q3 2026 is active right now) - the "what happens next quarter" problem hasn't been hit in practice yet. This is a real product/schema design call (per-season table vs. a `competition_id` column vs. a manual archive-then-truncate admin action; whether past winners should stay visible somewhere, e.g. a Hall of Fame), not something to decide unilaterally. Flagging now while there's still ~6 weeks of runway before Q4 needs to start, rather than after.
- **Status**: Logged, needs a product decision.

#### [Competitions] No admin path to correct a mistaken room-log review decision
- **Severity**: Low-Medium
- **Where**: `src/views/Admin/AdminDashboard.jsx` - the "Reviewed" room-log list (~line 4044-4069) renders read-only, no Approve/Reject once a log leaves Pending; `review_daily_room_log()` has no re-review path either (see the concurrency fix above - it now actively *blocks* re-reviewing on purpose).
- **What's wrong**: If an admin/CM approves or rejects the wrong log, or approves with a typo'd rejection note, there is currently no way to undo or correct it - not through the UI, and now not through the RPC either (my concurrency fix makes this explicitly impossible, closing off what little bypass existed). This mirrors the same shape as the "no path to approve a Project that was never submitted" finding from the previous pass: could be a deliberate "review is final, no do-overs" stance (keeps the anti-cheating trail simple and disputes get resolved by an admin manually editing `competition_standings` directly if it ever comes up), or could be an oversight nobody's hit yet.
- **Is this intentional?** Unclear - logged rather than decided. If the founder wants a correction path, the fix is straightforward: a narrow "re-review" RPC that reverses the previous credit before applying the new one (mirrors the credit/reversal logic already in the concurrency-guard fix above, just without the "block a second review" part).
- **Status**: Logged, needs a product decision.

**Next up**: Head-to-Head Duels (`062_quiz_duels.sql`), Room Races (`063_room_races.sql`), and Live Buzzer Trivia (`066_live_trivia.sql`) are the natural continuation of Competitions - same tab, same admin section, unread this pass. Note in particular that `challenge_to_room_race()` trusts `p_opponent_name` from the client for the *other* player's name (only the caller's own name is resolved server-side) - worth a look given the spoofing issue just fixed in `rsvp_for_competition()` was the same shape. Otherwise, **My Subscription & Upgrades** (PayFast) and the **RLS/permission-scope audit** across `067_permission_scopes.sql` remain good, unclaimed picks.
