// Member-facing release notes - the in-app half of the versioning strategy
// (see CHANGELOG.md for the technical/admin half). Newest release first.
// Add a new entry here whenever a batch of member-visible changes ships;
// keep it in plain, benefit-focused language - no implementation detail.
// Version numbers are CalVer (YYYY.MM.DD), matching CHANGELOG.md.

export const RELEASE_NOTES = [
  {
    version: '2026.09.05',
    date: '2026-09-05',
    headline: 'Duels, races, and a real merch store.',
    intro: "Challenge another member to a quiz duel or a room race, grab HH-branded merch from My Subscription, get a daily recommended TryHackMe room on your Dashboard, and a few smaller wins along the way.",
    groups: [
      {
        label: 'Competition',
        color: '#f5b942',
        items: [
          {
            icon: '⚔️',
            title: 'Quiz Duel',
            body: "Challenge another member straight from their profile to a head-to-head quiz — 10 general cyber questions each, 48 hours to finish. Most correct answers wins; a no-show forfeits to whoever answered more. Win, and it posts straight to Recent Wins.",
            where: 'Competitions → Head-to-Head Duels, or a member\'s profile',
          },
          {
            icon: '🏁',
            title: 'Room Race',
            body: "Race another member to finish the same TryHackMe room — same WhatsApp-proof rule as daily room logging, and whoever's approved first wins.",
            where: 'Competitions → Room Races, or a member\'s profile',
          },
          {
            icon: '🖼️',
            title: 'Leaderboard headshots + clickable profiles',
            body: "Current Standings now shows everyone's headshot next to their name, and clicking a name opens their full profile. Also relabeled \"Updated weekly\" to \"Updated daily\" — because it is.",
            where: 'Competitions',
          },
        ],
      },
      {
        label: 'Merch Store',
        color: '#f472b6',
        items: [
          {
            icon: '🛍️',
            title: 'HH-branded merch, right in the portal',
            body: "Deskpads (R200), Tops (R400, S–XL), and Hoodies (R600, S–XL) — add to cart and check out with a real PayFast payment, then track your order in My Merch Orders.",
            where: 'sidebar → My Subscription',
          },
        ],
      },
      {
        label: 'Growth',
        color: '#5ee37a',
        items: [
          {
            icon: '🧩',
            title: "Today's TryHackMe Room",
            body: "A new Dashboard card recommends one room a day, rotating automatically — an easy default when you're not sure what to work on next.",
            where: 'Dashboard',
          },
        ],
      },
      {
        label: 'Career Prep',
        color: '#c084fc',
        items: [
          {
            icon: '🗂️',
            title: 'Pick your domain for AI interview questions',
            body: "Interview Prep now asks which domain you're actually interviewing for before generating questions, so they're tailored to the real role instead of guessing from your profile.",
            where: '1on1 Meetings → More 1on1 Support → Interview Prep',
          },
        ],
      },
      {
        label: 'Recognition',
        color: '#22d3ee',
        items: [
          {
            icon: '🎉',
            title: 'A congrats email when you pass a cert',
            body: "The moment your coach marks a booked exam \"Passed,\" you'll get a congratulations email automatically — no extra step needed.",
            where: 'your inbox, automatically',
          },
        ],
      },
      {
        label: 'Getting Started',
        color: '#38bdf8',
        items: [
          {
            icon: '✅',
            title: 'External links now tick themselves off',
            body: "Click \"Join\" (WhatsApp) or \"Get It\" (Google Calendar) on your Getting Started checklist and that step is marked done automatically — no separate checkbox click needed.",
            where: 'Dashboard → Getting Started',
          },
        ],
      },
      {
        label: 'Heads Up',
        color: '#94a3b8',
        items: [
          {
            icon: '🖥️',
            title: 'Please use a desktop for now',
            body: "The portal isn't built for phone screens yet, so signing in from a phone or a very narrow window now shows a short message asking you to switch to a laptop or desktop instead of a broken layout.",
            where: 'shown automatically on a phone or narrow window',
          },
        ],
      },
    ],
  },
  {
    version: '2026.09.04',
    date: '2026-09-04',
    headline: 'Your journey, your LinkedIn game, and your team - all leveled up.',
    intro: "A new Dashboard tile telling your story so far, a real 12-week LinkedIn posting plan tailored to your track, proper interview tracking, and your Matchmaker group now emails you and shows real teammate profiles.",
    groups: [
      {
        label: 'Growth',
        color: '#5ee37a',
        items: [
          {
            icon: '📈',
            title: 'My Journey So Far',
            body: "A new Dashboard tile shows your tenure, certs completed, rooms completed, events joined, and interviews had at a glance — click it for the full story on My Roadmap: a real timeline of what you've done since you joined.",
            where: 'Dashboard, or My Roadmap',
          },
          {
            icon: '💼',
            title: 'LinkedIn: a real 12-week posting plan',
            body: "The LinkedIn Playbook now has a full 12-week plan tailored to your specialization — a real example post every week, not just a vague prompt, plus dedicated weeks for growing your network. Your Roadmap's \"Post once a week\" item shows this week's post right there, with a one-click way to mark it done.",
            where: 'My Roadmap, or Resources → LinkedIn Strategy',
          },
        ],
      },
      {
        label: 'Career Prep',
        color: '#c084fc',
        items: [
          {
            icon: '🎤',
            title: 'Real interview tracking',
            body: "Interview Prep now asks where and when your real interview is before generating questions, and lets you log how it actually went afterward — the questions you got asked, whether the playbook helped, and how confident you're feeling. It all counts toward your real Interviews Had number.",
            where: '1on1 Meetings → More 1on1 Support → Interview Prep',
          },
        ],
      },
      {
        label: 'Matchmaker',
        color: '#fb923c',
        items: [
          {
            icon: '📧',
            title: 'Your group now emails you',
            body: "The moment you're assigned a Matchmaker group, you'll get an email with who's on it, what you're building, when it's due, and next steps. Teammate names in the portal are now clickable too, showing their full profile — headshot included.",
            where: 'Matchmaker, or your inbox',
          },
        ],
      },
      {
        label: 'Getting Started',
        color: '#38bdf8',
        items: [
          {
            icon: '✅',
            title: 'Getting Started now has a deadline',
            body: "If it's been 3 days since you joined and you haven't finished the Getting Started checklist yet, the rest of the portal stays locked until you do — Dashboard, 1-on-1 Meetings, and Members stay open the whole time so you can actually finish it.",
            where: 'shown automatically if it applies to you',
          },
        ],
      },
    ],
  },
  {
    version: '2026.09.02',
    date: '2026-09-02',
    headline: 'Your Roadmap now links straight to the source.',
    intro: "Core Foundations items with a real course or exam now link directly to it, CV Review / Interview Prep are working properly again, three new study guides landed in Resources, and Matchmaker groups now get a proper reveal.",
    groups: [
      {
        label: 'Growth',
        color: '#5ee37a',
        items: [
          {
            icon: '🔗',
            title: 'Open Link / Resource on your Roadmap',
            body: "CISCO Junior Cyber Pathway, Immersive Labs, both TryHackMe paths, AZ-900, AI-901, and SC-900 now show a direct link to the real course or exam page — no more hunting for it yourself. CompTIA Security+ opens the existing in-app Study Guide instead.",
            where: 'My Roadmap',
          },
          {
            icon: '📚',
            title: 'Three new study guides: CySA+, Terraform Associate, SC-200',
            body: "Same format as the CompTIA Security+ guide — what it costs, how long to study, and every real resource members actually use (videos, practice tests, and the official docs), all in one place instead of hunting for links.",
            where: 'Resources → Cert Prep',
          },
          {
            icon: '🎧',
            title: 'Recommended podcasts',
            body: "CyberWire Daily for daily news, and The Secure Developer for AI/DevSecOps — an easy way to stay current on a commute. Share your takeaways on LinkedIn once you've listened.",
            where: 'Resources → Podcasts',
          },
        ],
      },
      {
        label: 'Career Prep',
        color: '#c084fc',
        items: [
          {
            icon: '🛠️',
            title: 'CV Review and Interview Prep are working again',
            body: "Both AI tools from last week weren't actually opening for everyone — that's fixed now. Paste your CV/LinkedIn or a job description and give them another go.",
            where: '1on1 Meetings → More 1on1 Support',
          },
        ],
      },
      {
        label: 'Matchmaker',
        color: '#fb923c',
        items: [
          {
            icon: '🎡',
            title: 'Spin the wheel to reveal your group',
            body: "When your group is ready, choose to see it instantly or spin a wheel — one spin per teammate, then a final spin for Project or Presentation. Purely for fun: who you're grouped with is decided the same fair, random way it always was.",
            where: 'Matchmaker',
          },
          {
            icon: '📅',
            title: 'Your group now shows a due date',
            body: "Your group card shows when your Project or Presentation is due, so it's not just \"figure it out eventually.\"",
            where: 'Matchmaker',
          },
        ],
      },
    ],
  },
  {
    version: '2026.09.01',
    date: '2026-09-01',
    headline: "Gemma just got a lot more useful.",
    intro: "Real AI feedback on your CV and LinkedIn, interview questions built from an actual job posting, a real Security+ practice quiz that logs its own score, and the competition RSVP finally has an undo button.",
    groups: [
      {
        label: 'Career Prep',
        color: '#c084fc',
        items: [
          {
            icon: '✨',
            title: 'Gemma reviews your CV and LinkedIn now',
            body: "Paste your CV text and/or LinkedIn profile — Gemma reviews it like a hiring manager would, with a real score and specific, actionable feedback per category, not generic encouragement. Three reviews a week, and your past scores are saved so you can track improvement.",
            where: 'Resources, or 1on1 Meetings → More 1on1 Support',
          },
          {
            icon: '🎤',
            title: 'Interview questions built from the actual job you\'re applying for',
            body: "Paste a job description and your CV — Gemma generates 6-10 tailored questions (technical, behavioral, and scenario-based), each with a tip for answering it well, cross-referenced against that specific posting and your own background.",
            where: '1on1 Meetings → More 1on1 Support → Generate AI Interview Questions',
          },
        ],
      },
      {
        label: 'Growth',
        color: '#5ee37a',
        items: [
          {
            icon: '🧠',
            title: 'Real practice quizzes for Security+',
            body: "30 real questions across every official exam domain, live in the app. Study Mode shows you the answer and explanation right away; Exam Mode holds it back until the end, just like the real thing. Finish one and your score logs itself straight into Exam Readiness — no more typing it in by hand.",
            where: 'Cert Calendar → your own booked exam → Take Practice Quiz',
          },
          {
            icon: '📋',
            title: 'Core Foundations now sets itself up for you',
            body: "Finish the Getting Started checklist and your Core Foundations certs (the standard 8) appear on My Roadmap automatically — no more waiting on a coach to add them by hand before you can start checking things off.",
            where: 'My Roadmap',
          },
        ],
      },
      {
        label: 'Competition',
        color: '#f5b942',
        items: [
          {
            icon: '🔄',
            title: "\"Yes I'm In\" now has an undo",
            body: "Changed your mind about the competition? Click the same button again and you're out. Your row and any progress already logged for you stay exactly as they were, so opting back in later picks up right where you left off instead of restarting at zero.",
            where: 'Competitions',
          },
        ],
      },
      {
        label: 'Refer a Friend',
        color: '#22d3ee',
        items: [
          {
            icon: '🎁',
            title: 'Refer a friend, earn R500',
            body: "Know someone who'd be a good fit for Hacking Hub? Refer them, and once they join, R500 is yours. Your Referrals list shows exactly where each one stands — Pending, Reward Pending once they've joined, then paid.",
            where: 'Members → Refer a Friend',
          },
        ],
      },
    ],
  },
  {
    version: '2026.08.31',
    date: '2026-08-31',
    headline: "Your age and gender - set by you now, not guessed.",
    intro: "Your age range and gender are now yours to set, and Matchmaker groups get a real starting point instead of a blank page.",
    groups: [
      {
        label: 'Your Profile',
        color: '#38bdf8',
        items: [
          {
            icon: '🔒',
            title: 'Set your own age and gender',
            body: "These used to be admin-set guesswork. Now you set them yourself, right on your profile edit form - and like before, they stay private and are never shown to other members.",
            where: 'Members → Edit My Profile',
          },
        ],
      },
      {
        label: 'Community',
        color: '#f5b942',
        items: [
          {
            icon: '💡',
            title: 'Matchmaker now has example ideas',
            body: "Not sure what to build or present with your randomly-matched group? A real list of example cybersecurity projects and tech presentation topics is right there now - a starting point, not a requirement.",
            where: 'Matchmaker',
          },
        ],
      },
    ],
  },
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
