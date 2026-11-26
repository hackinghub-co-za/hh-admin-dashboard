// Hacking Hub Admin Dashboard - "Your results are ready" follow-up email
// (shared by pipeline-followup-email).
//
// Sent to a Sales Pipeline lead who came in through the Free CV Review or
// the Role Quiz, asking them to book a 15-minute call to go through their
// results. The role quiz version is tailored to their matched role (a short
// "what the role is" and "where to start"), and mentions their runner-up.
// Everything is read from the card's notes, which the intakes write as
// "Target role: ..." (cv-review-intake) and "Matched role: X (67%)" /
// "Runner-up: Y" (role-quiz-lead). The latest entry wins when someone took
// the quiz more than once.
//
// Plain TypeScript with no Deno APIs, so the same templates can be rendered
// locally for a preview.

export const FROM_ADDRESS = 'Siya from Hacking Hub <siya@hackinghub.co.za>';
export const BOOKING_URL = 'https://cal.com/siya-gladile-yabcoe/15min';

const C = { navy: '#17183c', ink: '#1b1d3a', ink3: '#6b7096', line: '#e3e5f1', soft: '#f4f6fb', green: '#17a856' };

type RoleInfo = { what: string; start: string };

// Keyed by the role names the quiz itself uses.
export const ROLE_INFO: Record<string, RoleInfo> = {
  'SOC Analyst': {
    what: 'SOC Analysts are the first line of defence. They watch security alerts, investigate anything suspicious and escalate real incidents. It’s one of the most common ways into cyber in South Africa, and banks, telcos and managed security providers hire for it all year.',
    start: 'Get your networking and security fundamentals in place, then get hands-on with a SIEM like Microsoft Sentinel or Splunk and practise investigating alerts in blue-team labs.',
  },
  'Digital Forensics (DFIR)': {
    what: 'Digital forensics and incident response (DFIR) is about working out what happened after an attack: collecting evidence, rebuilding the timeline and helping the organisation recover. It suits people who are curious and patient, and who like getting to the bottom of things.',
    start: 'Build strong Windows and Linux fundamentals and learn to read logs, then practise on investigation cases with tools like Autopsy and Volatility. Many people get into DFIR through a SOC role first.',
  },
  'Application Security': {
    what: 'Application security engineers help developers build software that’s hard to break. They review code, test web apps and APIs, and get vulnerabilities fixed before release. Every company that builds software needs this skill.',
    start: 'Learn the OWASP Top 10, get comfortable reading a bit of code (Python or JavaScript), and practise on hands-on web labs like PortSwigger’s free Web Security Academy.',
  },
  'Offensive Security': {
    what: 'Penetration testers and red teamers are paid to break in, legally, and show organisations where they’re exposed before real attackers find it. It’s hands-on, and it rewards people who love solving puzzles.',
    start: 'Get solid on networking, Linux and some scripting first. Then build your skills on hands-on platforms like TryHackMe and Hack The Box, working towards certs like eJPT and, later, OSCP.',
  },
  'Cloud Security': {
    what: 'Cloud security engineers protect what runs on Azure, AWS and Google Cloud: identities, configuration and monitoring, and stopping misconfigurations from turning into breaches. Demand keeps growing as South African companies move to the cloud.',
    start: 'Start with a cloud fundamentals cert like AZ-900 or AWS Cloud Practitioner, then move on to security-focused ones like AZ-500 or SC-200, with plenty of hands-on labs along the way.',
  },
  'AI Security Engineer': {
    what: 'AI security is one of the newest areas in cyber. It covers protecting AI systems from attacks like prompt injection and data poisoning, and helping organisations use AI safely. Few people have these skills yet, so getting in early gives you an edge.',
    start: 'Get your core security fundamentals and some Python in place first. Then learn the OWASP Top 10 for LLM applications and try hands-on AI red-teaming labs.',
  },
  'GRC (Governance, Risk & Compliance)': {
    what: 'GRC professionals make sure an organisation manages its cyber risk properly, through policies, audits, risk assessments and compliance with frameworks like ISO 27001 and POPIA. It suits people who enjoy the business and people side of security.',
    start: 'Build your fundamentals with something like ISC2 CC or Security+, then learn ISO 27001 and POPIA and practise writing a simple risk assessment.',
  },
  DevSecOps: {
    what: 'DevSecOps engineers build security into how software is built and shipped: CI/CD pipelines, infrastructure as code, containers and automated security checks. It sits where development, operations and security meet.',
    start: 'Get comfortable with Linux, Git and a scripting language, then learn Docker, a CI tool like GitHub Actions and one cloud platform, adding security checks as you go.',
  },
  'IAM (Identity & Access)': {
    what: 'Identity and access management (IAM) specialists decide who can get into what, and make sure that stays tight as people join, move and leave. Most breaches involve a stolen or misused identity, so this work matters more every year.',
    start: 'Learn how Active Directory and Microsoft Entra ID work, along with single sign-on and MFA. SC-300 is a good cert to work towards.',
  },
};

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** First word of the name in normal capitalisation, or null if unusable. */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = String(fullName || '').trim().split(/\s+/)[0];
  if (!first || first.includes('@') || first.length < 2) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Last value of "Label: value" in the card's notes, trimmed of any "(67%)". */
function lastNoteValue(notes: string, label: string): string | null {
  const re = new RegExp(`^${label}:\\s*(.+)$`, 'gim');
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = re.exec(notes)) !== null) last = match[1];
  return last ? last.replace(/\s*\(\d+%\)\s*$/, '').trim() : null;
}

export type LeadKind = 'cv_review' | 'role_quiz';

export type LeadForEmail = { full_name: string | null; source: string | null; notes: string | null };

/** Which email this lead gets, or null if it isn't a CV review or role quiz lead. */
export function leadKindOf(lead: LeadForEmail): LeadKind | null {
  if (lead.source === 'Free CV review') return 'cv_review';
  if (lead.source === 'Role quiz') return 'role_quiz';
  return null;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:${C.green};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">${label}</a>`;

const p = (html: string) => `<p style="margin:0 0 12px;font-size:15px;">${html}</p>`;

function shell(eyebrow: string, heading: string, body: string): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:${C.ink};line-height:1.6;padding:26px;">
    <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.green};">${eyebrow}</p>
    <h2 style="font-size:23px;line-height:1.25;color:${C.navy};margin:6px 0 16px;">${heading}</h2>
    ${body}
    <p style="margin:18px 0 0;font-size:15px;">Speak soon,<br>Siya Gladile<br>Founder, Hacking Hub</p>
  </div>`;
}

const bookingBlock = `
    <p style="margin:6px 0 10px;">${button(BOOKING_URL, 'Book your 15-minute call')}</p>
    <p style="margin:0 0 12px;font-size:13px;color:${C.ink3};">Pick any time that suits you. If none of the slots work, just reply to this email and we’ll find one that does.</p>`;

/** Builds the email for one lead, or null when it isn't a CV review or role quiz lead. */
export function buildLeadResultsEmail(lead: LeadForEmail): { kind: LeadKind; subject: string; html: string; role: string | null } | null {
  const kind = leadKindOf(lead);
  if (!kind) return null;
  const notes = lead.notes || '';
  const first = firstNameOf(lead.full_name);
  const hi = p(first ? `Hi ${esc(first)},` : 'Hi there,');

  if (kind === 'cv_review') {
    const target = lastNoteValue(notes, 'Target role');
    const goal = target ? ` with your goal of a <strong>${esc(target)}</strong> role in mind` : '';
    const body = `${hi}
      ${p(`Thank you for sending your CV through our free CV review. I’ve gone through it${goal}, and your results are ready.`)}
      ${p('Rather than send a long list of notes over email, I’d like to walk you through them on a quick 15-minute call. That way you can ask questions as we go and leave with clear next steps for your CV.')}
      ${bookingBlock}`;
    return {
      kind,
      role: target,
      subject: first ? `Your CV review is ready, ${first}` : 'Your CV review is ready',
      html: shell('Hacking Hub · Free CV Review', 'Your CV review is ready', body),
    };
  }

  const role = lastNoteValue(notes, 'Matched role');
  const runnerUp = lastNoteValue(notes, 'Runner-up');
  const info = role ? ROLE_INFO[role] : undefined;
  const roleName = role ? esc(role) : 'your matched role';
  const runnerUpLine = runnerUp && runnerUp !== role
    ? ` Your runner-up was <strong>${esc(runnerUp)}</strong>, so we can look at that too.`
    : '';
  const infoBlock = info ? `
      <div style="background:${C.soft};border:1px solid ${C.line};border-radius:10px;padding:14px 16px;margin:4px 0 16px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.navy};">What the role is</p>
        <p style="margin:0 0 12px;font-size:15px;">${info.what}</p>
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.navy};">Where to start</p>
        <p style="margin:0;font-size:15px;">${info.start}</p>
      </div>` : '';
  const body = `${hi}
      ${p(`Thank you for taking our cyber role quiz. Your best match was <strong>${roleName}</strong>.${runnerUpLine}`)}
      ${infoBlock}
      ${p(`A quiz can only tell you so much. I’d love to go through your results with you on a quick 15-minute call: what ${role ? 'this role' : 'the role'} looks like day to day, how people in South Africa are getting into it, and what your first steps should be from where you are now.`)}
      ${bookingBlock}`;
  return {
    kind,
    role,
    subject: role ? `Your role quiz result: ${role}` : 'Your role quiz result',
    html: shell('Hacking Hub · Role Quiz', role ? `Your match: ${roleName}` : 'Your role quiz result', body),
  };
}
