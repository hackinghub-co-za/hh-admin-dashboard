// The motivational quote under "Welcome back, <name>!" on the member
// dashboard. It changes once a day at midnight South African time, and every
// member sees the same quote on the same day. The list is gone through in
// order, so no quote repeats until every one has been shown.
//
// Attributions are kept only where the source is well documented. Commonly
// misattributed lines (the "Einstein said..." kind) are left unattributed
// rather than credited to someone who never said them.

export const QUOTES = [
  { text: 'Education is the most powerful weapon which you can use to change the world.', author: 'Nelson Mandela' },
  { text: 'One lab a day beats ten videos a week.' },
  { text: 'Security is a process, not a product.', author: 'Bruce Schneier' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'If you want to go fast, go alone. If you want to go far, go together.', author: 'African proverb' },
  { text: 'Nobody is born knowing Linux. Open the terminal anyway.' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'Try harder.', author: 'OffSec motto' },
  { text: 'Every action you take is a vote for the type of person you wish to become.', author: 'James Clear' },
  { text: 'Consistency beats intensity. Show up today, even for 30 minutes.' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese proverb' },
  { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
  { text: 'Your future employer is looking for proof. Build some today.' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'Hard work beats talent when talent doesn’t work hard.', author: 'Tim Notke' },
  { text: 'Smooth seas do not make skilful sailors.', author: 'African proverb' },
  { text: 'The roadmap only works if you open it.' },
  { text: "You don't have to be great to start, but you have to start to be great.", author: 'Zig Ziglar' },
  { text: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma' },
  { text: 'I am because we are.', author: 'Ubuntu' },
  { text: 'Every expert was once a beginner who refused to quit.' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Book the exam. A date on the calendar turns "one day" into a plan.' },
  { text: "I am not afraid of storms, for I am learning how to sail my ship.", author: 'Louisa May Alcott' },
  { text: 'What you do today can improve all your tomorrows.', author: 'Ralph Marston' },
  { text: 'Comparison steals progress. Focus on your own roadmap.' },
  { text: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.', author: 'Stephen King' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { text: 'A failed exam is feedback, not a verdict. Read the report and go again.' },
  { text: 'Opportunities don’t happen. You create them.', author: 'Chris Grosser' },
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'Ask the question. Someone in the community has been exactly where you are.' },
  { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
  { text: 'Courage doesn’t always roar. Sometimes courage is the quiet voice at the end of the day saying, “I will try again tomorrow.”', author: 'Mary Anne Radmacher' },
  { text: 'Progress, not perfection. Tick off one roadmap item today.' },
  { text: 'The more that you read, the more things you will know. The more that you learn, the more places you’ll go.', author: 'Dr. Seuss' },
  { text: 'Small wins count. Celebrate the one you get today.' },
  { text: 'Discipline is choosing between what you want now and what you want most.' },
  { text: 'Your background is not a barrier. It’s the perspective the industry is missing.' },
];

// 'YYYY-MM-DD' for the given moment in South Africa (UTC+2, no daylight saving).
export function sastDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function quoteForDate(now = new Date(), quotes = QUOTES) {
  const [y, m, d] = sastDateKey(now).split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return quotes[((dayNumber % quotes.length) + quotes.length) % quotes.length];
}
