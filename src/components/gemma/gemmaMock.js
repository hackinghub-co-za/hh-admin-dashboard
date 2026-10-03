// Mock Member has no Supabase session, so Gemma answers locally with these
// canned replies. They also double as examples of her voice.

const REPLIES = [
  {
    match: /(how am i|progress|doing|this week)/i,
    reply: "Okay, I see you. **5-day streak** and two roadmap items done since Monday? Sharp sharp.\n\n- Hub Score: **742**, Regular tier\n- Next up on your roadmap: **CompTIA Security+**\n- TryHackMe: nothing logged in **9 days**\n\nThat last one, babe. The competition doesn't care about your vibes. One room tonight and you're back on pace.",
    actions: ['log_rooms', 'roadmap'],
    sources: ['streak', 'roadmap', 'hub_score', 'tryhackme'],
  },
  {
    match: /(tired|overwhelm|stress|burn|give up|can't keep|cant keep|exhausted)/i,
    reply: "That sounds like a lot, and it makes sense you're tired. You don't have to carry work and studying at full speed every single week.\n\nIf you need it, **Take a Break** pauses your nudges, roadmap reminders and streak for 3, 7 or 14 days, and nobody is counting. I can also get someone from the team to check in on you.",
    actions: ['take_a_break'],
    sources: [],
    wellbeing: true,
  },
  {
    match: /(answer|just tell me|which option)/i,
    reply: "Haibo, nice try. I don't even have the answers, they're locked away from me too. What I *can* do is point you at the right evidence. Use the **Ask Gemma for a hint** button on the task, you get three per lab.",
    actions: ['labs'],
    sources: ['knowledge'],
  },
  {
    match: /(price|cost|how much|pay|subscription|owe)/i,
    reply: "Money questions go to the team, babe. I'd rather not quote you a number that's wrong. Your plan and payments are in **My Subscription**, and an admin can sort out anything else.",
    actions: ['billing'],
    sources: ['knowledge'],
  },
  {
    match: /(ignore|system prompt|your instructions|pretend you)/i,
    reply: "Cute. No. 💅 I'm staying exactly who I am. Now, what are we actually working on today?",
    actions: [],
    sources: [],
  },
  {
    match: /(quiz|test me)/i,
    reply: "Ooh, yes. Five questions, no pressure, no marks on your record. Tap **Quiz me** and let's see what stuck.",
    actions: ['quiz'],
    sources: ['roadmap'],
  },
  {
    match: /(hub score|points|tier)/i,
    reply: "You're on **742 points**, which puts you in **Regular**. Most of that is roadmap items and your streak. Certs are where the big points live, so passing Security+ would move you the most.",
    actions: ['hub_score'],
    sources: ['hub_score'],
  },
];

const FALLBACK = {
  reply: "This is Mock Member, so I'm running on demo answers. On a real account I'd answer that using your actual roadmap, scores and streak. Try asking how you're doing, or ask me to quiz you.",
  actions: ['quiz'],
  sources: [],
};

export function mockGemmaReply(message) {
  const hit = REPLIES.find((r) => r.match.test(message)) || FALLBACK;
  return { actions: [], sources: [], wellbeing: false, ...hit };
}

export const MOCK_WEEKLY_NOTE = {
  weekStart: '2026-09-28',
  headline: 'Two roadmap items down last week. Nice.',
  body: "Your Security+ target is in 19 days and Domain 3 is the one you haven't touched. Ten focused minutes a day gets you through it, no all-nighters needed.",
  action: 'roadmap',
  dismissed: false,
};

export const MOCK_QUIZ = {
  topic: 'CompTIA Security+',
  questions: [
    { question: 'Which control type is a security guard at a building entrance?', options: ['Technical', 'Physical', 'Managerial', 'Corrective'], answer_index: 1, why: 'Guards, fences and locks are physical controls. Technical would be things like firewalls.' },
    { question: 'What does the "I" in the CIA triad stand for?', options: ['Identity', 'Integrity', 'Isolation', 'Inspection'], answer_index: 1, why: 'Integrity means data is not altered without authorisation.' },
    { question: 'Which attack tricks a user into revealing credentials through a fake email?', options: ['Phishing', 'Smurfing', 'Pharming', 'Tailgating'], answer_index: 0, why: 'Phishing is the email classic. Pharming redirects DNS instead.' },
    { question: 'Which port does HTTPS use by default?', options: ['80', '22', '443', '3389'], answer_index: 2, why: '443 for HTTPS. 80 is plain HTTP, 22 is SSH, 3389 is RDP.' },
    { question: 'Hashing a password before storing it mainly protects which property?', options: ['Availability', 'Non-repudiation', 'Confidentiality', 'Scalability'], answer_index: 2, why: 'Even if the database leaks, the actual passwords are not exposed directly.' },
  ],
};

export const MOCK_HINT = "Go back to the evidence pack and re-read the part about who can see what. Then ask yourself: if something went wrong here, could anyone prove who did it?";
