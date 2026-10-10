// Where Gemma's reply buttons go. Keys match ACTION_KEYS in
// supabase/functions/_shared/gemma.ts; the server drops anything else.
// `open` is a modal MemberPortal opens when it hears a 'gemma:open' event.
export const GEMMA_ACTIONS = {
  dashboard: { label: 'Go to Dashboard', tab: 'dashboard' },
  roadmap: { label: 'Open My Roadmap', tab: 'roadmap' },
  labs: { label: 'Open Labs', tab: 'labs' },
  certs: { label: 'Open Cert Calendar', tab: 'certs' },
  events: { label: 'See Events', tab: 'events' },
  jobs: { label: 'Open Job Board', tab: 'jobs' },
  resources: { label: 'Open Resources', tab: 'resources' },
  competitions: { label: 'Open Competitions', tab: 'competitions' },
  meetings: { label: 'Book a 1on1', tab: 'meetings' },
  matchmaker: { label: 'Open Matchmaker', tab: 'matchmaker' },
  billing: { label: 'My Subscription', tab: 'billing' },
  hub_score: { label: 'Open Hub Score', tab: 'dashboard', open: 'hub_score' },
  take_a_break: { label: 'Take a Break', tab: 'dashboard', open: 'take_a_break' },
  cv_review: { label: 'Review my CV', tab: 'meetings', open: 'cv_review' },
  interview_prep: { label: 'Practice an interview', tab: 'meetings', open: 'interview_prep' },
  log_rooms: { label: "Log today's rooms", tab: 'competitions' },
  quiz: { label: 'Quiz me', quiz: true },
};

export function runGemmaAction(key, setActiveTab) {
  const action = GEMMA_ACTIONS[key];
  if (!action || action.quiz) return;
  if (action.tab) setActiveTab?.(action.tab);
  if (action.open) {
    // Let the tab render before asking it to open the modal.
    setTimeout(() => window.dispatchEvent(new CustomEvent('gemma:open', { detail: action.open })), 0);
  }
}

export const SOURCE_LABELS = {
  roadmap: 'Roadmap', hub_score: 'Hub Score', streak: 'Streak', certs: 'Cert Calendar', labs: 'Labs',
  study: 'Study time', tryhackme: 'Room logs', quizzes: 'Quizzes', knowledge: 'Hacking Hub info',
};

export const TAB_LABELS = {
  dashboard: 'Dashboard', roadmap: 'My Roadmap', matchmaker: 'Matchmaker', members: 'Members', meetings: '1on1 Meetings',
  events: 'Events', jobs: 'Job Board', resources: 'Resources', labs: 'Labs', certs: 'Cert Calendar',
  competitions: 'Competitions', reviews: 'Reviews', billing: 'My Subscription', gemma: 'Gemma',
};

const BASE_PROMPTS = ['How am I doing this week?', 'What should I focus on next?'];
const TAB_PROMPTS = {
  dashboard: ['Explain my Hub Score'],
  roadmap: ["What's my next roadmap item about?"],
  labs: ['Which lab should I start with?', 'How do Hub Labs work?'],
  certs: ['Help me plan for my next exam'],
  jobs: ['How do I stand out when I apply?'],
  resources: ['What should I read first for my track?'],
  competitions: ['How do I catch up on rooms?'],
  meetings: ['Which mentor should I book?'],
  events: ['Is it worth going to meetups?'],
};

export function promptsForTab(tab) {
  return [...BASE_PROMPTS, ...(TAB_PROMPTS[tab] || ['Explain my Hub Score'])].slice(0, 3);
}
