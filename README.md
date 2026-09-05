# Hacking Hub Web Portal & Admin Dashboard

A premium, highly responsive administrative dashboard and member portal designed for managing events, 1on1 sessions, certifications, payments, subscriptions, and financial metrics for the **Hacking Hub** community.

---

## Architecture Overview

This project is built using a modern **Single Page Application (SPA)** model utilizing **React** with **Vite** for optimized, high-performance static asset generation. 

- **Frontend Core**: React (ES6+) with Vite.
- **Styling**: Vanilla CSS with CSS Modules, utilizing custom CSS custom properties (variables) for theme consistency and glassmorphism.
- **Backend & Authentication**: Powered by **Supabase** (PostgreSQL, Supabase Auth, and Row-Level Security).
- **Icons**: Lucide React.

```
┌────────────────────────────────────────────────────────┐
│                      Client App                        │
│  ┌──────────────────────────┐  ┌────────────────────┐  │
│  │     Admin Dashboard      │  │   Member Portal    │  │
│  │ (Metrics, Meetups, etc.) │  │ (1on1s, Roadmaps)  │  │
│  └──────────────────────────┘  └────────────────────┘  │
└──────────────────────────┬─────────────────────────────┘
                           │ Authenticated HTTP / WS
                           ▼
┌────────────────────────────────────────────────────────┐
│                        Supabase                        │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Supabase Auth   │  │  PostgreSQL  │  │ Storage & │  │
│  │ (Google OAuth)  │  │  (RBAC/RLS)  │  │ Functions │  │
│  └─────────────────┘  └──────────────┘  └───────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Events & Meetups Manager (Admin)
- Schedule, edit, and cancel upcoming meetups and tech talks.
- Track member RSVPs and historical attendance.
- Automatically generate calendar links (.ics) and sync with the Hacking Hub public calendar.

### 2. 1on1 Facilitator & Roadmaps (Dual-View)
- **Admin View**: Assign mentors, schedule recurring 1on1 sessions, and update member-specific roadmaps.
- **Member View**: View assigned roadmap documents, submit action items, track milestone progress, and see details for the next 1on1 session.

### 3. Payments & Subscription Tracker (Admin)
- Direct integration dashboard for tracking member plans (e.g., Stripe/Payfast webhooks).
- Automatic metrics collection:
  - **Churn Rate**: Percentage of members leaving month-over-month.
  - **Length of Stay**: Average lifetime duration of an active membership.
  - **ARPU**: Average Revenue Per User/Member.
  - **LTV**: Lifetime Value per member.

### 4. Certification Calendar (Dual-View)
- Maintain and track upcoming cybersecurity/hacking certification exam dates.
- Send automated study reminders and track cohort pass rates.

### 5. Financial Dashboard (Admin)
- Net vs. Gross revenue tracking.
- Operational expenses breakdown.
- Visual charts for cash flow trends and financial health.

---

## Google OAuth & Role-Based Access Control

The app uses **Supabase Auth** to handle sign-ins.
- Users authenticate using their Google accounts.
- Upon first sign-in, a PostgreSQL trigger inserts a profile record defaulting to the `member` role.
- Administrators can elevate roles to `admin` in the database, granting access to the administrative metrics panel.

---

## Infrastructure & Hosting Strategy

### 1. Deployment Platforms
- **Frontend**: Hosted on **Vercel** or **Cloudflare Pages** for global distribution via edge CDN nodes, securing <100ms response times.
- **Database/Auth**: Managed instance on **Supabase** (AWS-backed Postgres).

### 2. CI/CD (GitHub Actions)
- Linting and Formatting: Runs Prettier & ESLint checks on pull requests.
- Build Verification: Performs `npm run build` to ensure production builds succeed before merging.
- Auto-Deploy: Commits merged to the `main` branch trigger webhook deployments straight to the production hosting edge CDN.

### 3. DNS & Security
- Managed via Cloudflare DNS.
- HSTS enabled, with automatic SSL/TLS termination and WAF protection rules against injection/DDoS attacks.

---

## Operational Cost Estimate (in ZAR)

Calculated at an exchange rate of **$1 USD = R18.25 ZAR**.

### Phase 1: Launch / Starter (0 - 500 Members)
*Perfect for initial development and early-stage launch.*

- **Frontend Hosting (Vercel/Cloudflare Pages)**: Free Tier (**R0.00**)
- **Auth & Database (Supabase)**: Free Tier (**R0.00** - includes up to 50k MAUs, 500MB DB)
- **Transactional Email (Resend)**: Free Tier (**R0.00** - up to 3,000 emails/month)
- **Domain Registration (.co.za)**: Approx. **R10.00 / month** (R120/year)
- **Monitoring (Sentry)**: Free Tier (**R0.00**)
- **Total Estimated Cost**: **~R10.00 per month**

### Phase 2: Growth / Scaling
*For higher storage, dedicated support, and advanced monitoring.*

- **Frontend Hosting (Vercel Pro)**: $20.00/mo (**R365.00**)
- **Database & Auth (Supabase Pro)**: $25.00/mo (**R456.25**)
- **Transactional Email (Resend Pro)**: $20.00/mo (**R365.00**)
- **Domain Maintenance**: **R10.00 / month**
- **Total Estimated Cost**: **~R1,196.25 per month**

---

## Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- NPM or Yarn
- A Supabase Project (for database credentials)

### Setup Instructions

1. **Clone and Install Dependencies**:
   ```bash
   git clone <repository-url>
   cd hh-admin-dashboard
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Build for Production**:
   ```bash
   npm run build
   ```

---

## Deploying Database Changes & Edge Functions

The Supabase CLI is already a project devDependency (`npx supabase`), already
logged in, and already linked to the real project (`hh-admin-portal`,
`kveiflphktpvsddhkspz`) - no separate install or database password needed.

**SQL migrations** (`supabase/0NN_*.sql`) - apply one directly to the real
database instead of copy-pasting it into the Supabase Dashboard's SQL
Editor:
```bash
npm run db:apply -- supabase/060_merch_orders.sql
```
Every migration in this repo is written to be safe to re-run (`CREATE TABLE
IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` +
`CREATE POLICY`, etc.), so there's no tracked migration-history table to
manage - `scripts/apply-sql.sh` just runs the file via `supabase db query
--linked --file`.

**Edge Functions** (`supabase/functions/*`) - deploy directly via the CLI,
no wrapper needed:
```bash
npx supabase functions deploy <name>   # one function
npx supabase functions deploy          # every function
```

If the CLI ever reports it's not logged in or not linked (e.g. on a new
machine), fix that once with:
```bash
npx supabase login
npx supabase link --project-ref kveiflphktpvsddhkspz
```

---

## Directory Structure

```
hh-admin-dashboard/
├── .gitignore              # Files/folders to exclude from git
├── eslint.config.js        # Linter configuration
├── index.html              # Core application frame
├── package.json            # Node dependencies and build scripts
├── vite.config.js          # Vite bundler configurations
└── src/
    ├── main.jsx            # Application entry point
    ├── App.jsx             # Main Router and layout controller
    ├── index.css           # Global design system & theme tokens
    ├── components/         # Reusable widgets (Metrics, Scheduler, Charts)
    ├── views/
    │   ├── Admin/          # Admin-only dashboards and tools
    │   ├── Member/         # Member-only dashboard views
    │   └── Login.jsx       # Google Auth sign-in screen
    └── lib/
        └── supabase.js     # Supabase client helper
```
