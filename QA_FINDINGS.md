# QA Findings

A running QA log for hh-admin-dashboard, produced by the `qa-agent` (`.claude/agents/qa-agent.md`). The app is too large to QA in one pass — each invocation claims one or two unchecked areas below, works them to completion, fixes clear-cut bugs directly (committed to `main`), and logs everything else as a finding for a human call.

Started 2026-09-11.

## Coverage checklist

### Member-facing
- [ ] Dashboard (Journey So Far, Getting Started checklist, login streak, survey banner, next 1-on-1, recommended room, community broadcasts, recent wins, suggested content)
- [ ] My Roadmap (Core Foundations / Specialization / Projects / Advanced phases, unlock gates, progress logging, LinkedIn weekly-post plan)
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
- [ ] Roadmaps management (approvals, catalog assignment, Projects proof review)
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

_(newest first; nothing logged yet - the checklist above is the starting point for the first pass)_
