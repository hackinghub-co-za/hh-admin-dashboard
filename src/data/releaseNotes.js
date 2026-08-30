// Member-facing release notes - the in-app half of the versioning strategy
// (see CHANGELOG.md for the technical/admin half). Newest release first.
// Add a new entry here whenever a batch of member-visible changes ships;
// keep it in plain, benefit-focused language - no implementation detail.
// Version numbers are CalVer (YYYY.MM.DD), matching CHANGELOG.md.

export const RELEASE_NOTES = [
  {
    version: '2026.08.30',
    date: '2026-08-30',
    headline: "Know exactly how ready you are before exam day.",
    intro: "A real readiness score for six certs, GRC is now a full specialization track, a fairer prize rule if the competition ends in a tie, and the competition's actual rules are finally in the app instead of a Google Doc.",
    groups: [
      {
        label: 'Growth',
        color: '#5ee37a',
        items: [
          {
            icon: '🎯',
            title: 'Exam Readiness',
            body: "See a real readiness percentage for Security+, AZ-900, SC-200, SC-900, CySA+, and eJPT — built from a real prep checklist and your latest practice test score, not a guess. Tap the badge on your own exam to check off milestones and log a score.",
            where: 'Cert Calendar → your own booked exam',
          },
          {
            icon: '🛡️',
            title: 'GRC is now a full specialization track',
            body: "Governance, Risk & Compliance now has its own Roadmap track with real certs (ISO 27001, NIST CSF, ISC2 CGRC, ISACA CRISC, POPIA/GDPR, ITIL 4) — ask your coach to move you onto it if it's the right fit. It also has its own section in the Members directory now.",
            where: 'My Roadmap · Members → By Domain',
          },
        ],
      },
      {
        label: 'Competition',
        color: '#f5b942',
        items: [
          {
            icon: '🏅',
            title: 'Ties now split the prize fairly',
            body: "Standings are ranked by rooms completed. If two or more members tie for a prize-winning spot, they now split that prize money evenly instead of it coming down to chance — see the live split on the standings table.",
            where: 'Competitions',
          },
          {
            icon: '📖',
            title: 'Competition rules, right in the app',
            body: "What counts, the daily limit, screenshot requirements, and what happens if you cheat — the real rules now live in an in-app guide instead of an external Google Doc, so they can never go stale or get lost.",
            where: 'Competitions → Learn More',
          },
        ],
      },
    ],
  },
  {
    version: '2026.08.27',
    date: '2026-08-27',
    headline: "Your roadmap now has your back.",
    intro: "Three new things watching your Roadmap progress — a real celebration when you clear Core Foundations, a gentle nudge if it's been a while, and an email from Gemma if you've been away for good.",
    groups: [
      {
        label: 'Growth',
        color: '#5ee37a',
        items: [
          {
            icon: '🏆',
            title: 'Clearing Core Foundations now feels like it',
            body: "Check off your 5th Core Foundations cert and you'll get a real moment for it — a sound, a message, and confirmation you've qualified for Specialization.",
            where: 'My Roadmap',
          },
          {
            icon: '👋',
            title: "\"It's been a while\" nudge",
            body: "Haven't touched your Roadmap in 2 weeks? A quiet, dismissible reminder shows up on your Dashboard — no judgment, just a nudge back to where you left off.",
            where: 'Dashboard',
          },
          {
            icon: '📬',
            title: 'Gemma checks in by email',
            body: "If your Roadmap goes quiet for a month, Gemma sends a short, encouraging email nudging you back — with a one-click unsubscribe if you'd rather not get them.",
            where: 'your inbox, only if it applies to you',
          },
        ],
      },
    ],
  },
  {
    version: '2026.08.22',
    date: '2026-08-22',
    headline: "Your subscription page is finally real.",
    intro: "The big one — see your actual plan and next payment date, pay by EFT if you'd rather, two new ways to request coaching outside your scheduled sessions, real LinkedIn and Security+ guides in Resources, and a smoother first day in the Hub.",
    groups: [
      {
        label: 'Money & Billing',
        color: '#60a5fa',
        items: [
          {
            icon: '💳',
            title: 'Current Active Clearance is no longer "Under Construction"',
            body: "My Subscription & Upgrades now shows your real plan, rate, and next payment date instead of a blurred placeholder.",
            where: 'sidebar → My Subscription',
          },
          {
            icon: '🏦',
            title: 'Pay via EFT',
            body: "Prefer a direct bank transfer over PayFast? Full account details are right there on the subscription page — just use your full name as the payment reference.",
            where: 'sidebar → My Subscription',
          },
          {
            icon: '✨',
            title: 'Suggested Content',
            body: "The Dashboard's old billing stub is now a real feed of recommended videos, articles, and other content, curated for you.",
            where: 'Dashboard',
          },
        ],
      },
      {
        label: 'Career Prep',
        color: '#c084fc',
        items: [
          {
            icon: '📄',
            title: 'Request a CV Review or Interview Prep',
            body: "Two new cards on the 1on1 booking page let you request a CV review or a mock interview session outside your regular coaching slot.",
            where: 'sidebar → 1on1 Meetings',
          },
          {
            icon: '💼',
            title: 'LinkedIn Strategy guide',
            body: "A full checklist for a LinkedIn profile that actually gets you noticed — photo, banner, headline, posting cadence, and what to avoid.",
            where: 'Resources → LinkedIn Strategy',
          },
          {
            icon: '🎓',
            title: 'CompTIA Security+ Study Guide',
            body: "Every free resource members actually use for Security+ — official overview, Professor Messer's video course, ExamCompass, and PocketPrep — consolidated into one guide.",
            where: 'Resources → Cert Prep',
          },
        ],
      },
      {
        label: 'Recognition',
        color: '#f5b942',
        items: [
          {
            icon: '🏆',
            title: 'Passing a cert now posts a Recent Win automatically',
            body: "The moment your coach marks a cert as Passed, it shows up as a Recent Win on the Dashboard — no extra step needed.",
            where: 'Dashboard → Recent Wins',
          },
        ],
      },
      {
        label: 'Getting Started',
        color: '#5ee37a',
        items: [
          {
            icon: '👋',
            title: 'A better first day',
            body: "The welcome sequence now nudges you to join the WhatsApp community, get Google Calendar, create a TryHackMe account and follow SiyaCybersecurity, and add a headshot to your profile.",
            where: 'shown on first sign-in, or sidebar → Replay Intro',
          },
        ],
      },
    ],
  },
  {
    version: '2026.08.19',
    date: '2026-08-19',
    headline: "Specialization now means something.",
    intro: "Your Roadmap's Core Foundations now follows one standard set of certs across every track, and Specialization is something you unlock rather than see from day one.",
    groups: [
      {
        label: 'Growth',
        color: '#5ee37a',
        items: [
          {
            icon: '🔓',
            title: 'Specialization is now unlocked, not just available',
            body: "Core Foundations now draws from one standard list of 8 certs (CISCO Junior Cyber Pathway, Immersive Labs, TryHackMe Pre-Security, TryHackMe Cyber 101, AZ-900, AI-901, SC-900, CompTIA Security+) — the same 8 for everyone, whatever your track. Get 5 of them done and your coach signs off on it, and your Specialization section unlocks. Two people on the same track can still end up with a different Specialization list, but Core Foundations is now the same starting line for everyone.",
            where: 'My Roadmap',
          },
        ],
      },
    ],
  },
  {
    version: '2026.08.17',
    date: '2026-08-17',
    headline: "Your path just got a lot more real.",
    intro: "Four things shipped to your portal this week — a coach-built roadmap instead of a placeholder, a way to get randomly teamed up with other members, credit for the rooms you actually finish, and a reason to show up daily.",
    groups: [
      {
        label: 'Growth',
        color: '#5ee37a',
        items: [
          {
            icon: '🧭',
            title: 'My Roadmap',
            body: "The \"My Roadmap\" tile isn't a placeholder anymore — it's a real, coach-built checklist for your track, split into Core Foundations and Specialization. Tick items off as you finish them and watch your progress bar move.",
            where: 'sidebar → My Roadmap, or the preview tile on your Dashboard',
          },
        ],
      },
      {
        label: 'Connection',
        color: '#f5b942',
        items: [
          {
            icon: '🤝',
            title: 'Matchmaker',
            body: "Opt in and you'll be randomly grouped with 1–3 other members to work on a project or presentation together. Groups are fully random — nobody hand-picks who you get, not even the coaches.",
            where: 'sidebar → Matchmaker → Count Me In',
          },
        ],
      },
      {
        label: 'Momentum',
        color: '#ff8a5c',
        items: [
          {
            icon: '🎯',
            title: "Room Logs → real leaderboard credit",
            body: "Log how many TryHackMe rooms you finished today (up to 5) and confirm you've posted proof in the WhatsApp group. Once approved, it counts straight toward your spot on the Competitions leaderboard.",
            where: "Competitions → Log Today's Rooms",
          },
          {
            icon: '🔥',
            title: 'Login Streak',
            body: "Show up two days in a row and you'll see a 🔥 badge next to your name on the Dashboard, counting how many days running you've logged in.",
            where: 'top of your Dashboard, once your streak starts',
          },
        ],
      },
    ],
  },
];

export const LATEST_RELEASE_VERSION = RELEASE_NOTES[0]?.version || null;
