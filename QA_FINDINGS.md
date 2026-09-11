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
- [ ] Room Logs review (approve/reject, standings updates)
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
