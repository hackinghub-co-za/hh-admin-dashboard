// Shared content for The Hacking Hub LinkedIn Playbook - a 12-week posting
// plan (a full quarter, no fast repeat), one real example post per week per
// specialty track. Pure content + pure helpers, no Supabase calls - read by
// both LinkedInPlaybookModal.jsx (the full guide) and MemberPortal.jsx (the
// inline "This Week" widget on the roadmap's "Post once a week" item), so
// there's exactly one source of truth for what "this week" means and what
// it says. Deliberately duplicated (by hand, not imported) into
// supabase/functions/linkedin-post-reminder-email/index.ts, which can't
// import from src/ - see that file's own header comment.

// Weeks 4, 8, and 11 are dedicated network-growth checkpoints: send 15-20
// PERSONALIZED connection requests to people in your target role/field that
// week. Deliberately not "mass connect everyone" - LinkedIn restricts
// accounts that send bulk unpersonalized invites, and an obviously-spammed
// connection reads badly to the exact recruiters this whole playbook is
// trying to impress. Aggressive and consistent beats reckless.
export const WEEKLY_THEMES = [
  { week: 1, theme: 'Introduce Yourself', isNetworkingWeek: false },
  { week: 2, theme: 'Build in Public', isNetworkingWeek: false },
  { week: 3, theme: 'Skill Spotlight', isNetworkingWeek: false },
  { week: 4, theme: 'Grow Your Network', isNetworkingWeek: true },
  { week: 5, theme: 'Lesson Learned', isNetworkingWeek: false },
  { week: 6, theme: 'Milestone', isNetworkingWeek: false },
  { week: 7, theme: 'Industry News Reaction', isNetworkingWeek: false },
  { week: 8, theme: 'Grow Your Network + Engage', isNetworkingWeek: true },
  { week: 9, theme: 'Deep-Dive', isNetworkingWeek: false },
  { week: 10, theme: 'Opinion / Hot Take', isNetworkingWeek: false },
  { week: 11, theme: 'Grow Your Network + Give Back', isNetworkingWeek: true },
  { week: 12, theme: 'Reflect & Recap', isNetworkingWeek: false },
];

export const THEME_DESCRIPTIONS = {
  'Introduce Yourself': "Say who you are, why this field, and what you're working toward - sets the tone for everything that follows.",
  'Build in Public': 'Show something real you did this week, not just that you studied - a room, a lab, a config, a writeup.',
  'Skill Spotlight': 'Explain one specific tool or technique in plain language - teaching it is the fastest way to prove you understand it.',
  'Grow Your Network': "Send 15-20 personalized connection requests this week to people in your target role - analysts, recruiters, hiring managers. A short, specific note beats a blank request every time.",
  'Lesson Learned': 'Something that tripped you up this week, and what it taught you - more relatable (and more memorable) than a highlight reel.',
  Milestone: 'A cert or course completed, or a competition placement - contextualized with what it actually took, not just a badge screenshot.',
  'Industry News Reaction': "React to real, current news in your field - shows recruiters you're plugged into the industry, not just working through a syllabus.",
  'Grow Your Network + Engage': 'Another 15-20 personalized connection requests, plus 5 genuine comments on other people\'s posts this week - a real question or your own experience, not just "Great post!"',
  'Deep-Dive': 'A longer, detailed technical walkthrough - the most substantial "proof of work" post of the cycle.',
  'Opinion / Hot Take': 'A respectful, informed opinion on a real debate in your field - shows independent thinking, not just information recall.',
  'Grow Your Network + Give Back': "A third round of personalized connection requests, to people at companies/teams you're specifically interested in - paired with sharing a genuinely useful free resource for beginners.",
  'Reflect & Recap': "A \"here's what changed\" post looking back on the last 3 months - closes the arc. Once you finish Week 12, start back at Week 1.",
};

// Keyed by the exact ROADMAP_TRACKS values (memberOptions.js) minus 'Not
// Assigned' - 12 real example posts per domain, same order as
// WEEKLY_THEMES. Written to be adapted, not copied - see the standing "in
// your own words" reminder in the UI (LinkedInPlaybookModal.jsx).
export const DOMAIN_CONTENT = {
  SOC: {
    hashtags: '#SOCAnalyst #BlueTeam #ThreatDetection #SIEM #CyberSecurity',
    posts: [
      "Started my journey into SOC analysis a few months ago - drawn to the puzzle-solving of triaging alerts and figuring out what's actually a threat vs. noise. Currently working through TryHackMe's SOC Level 1 path and loving how hands-on it is. If you're a SOC analyst open to a quick chat about what a day in the role actually looks like, I'd love to connect.",
      "Spent this week triaging simulated alerts in LetsDefend - walked through a suspicious PowerShell execution alert, pulled the process tree, and traced it back to a phishing payload. Wrote up my full investigation steps and what I'd flag for escalation. Link to the writeup in the comments 👇",
      'Today I learned how to build a Sigma rule to detect a specific living-off-the-land technique (LOLBins abusing certutil.exe for downloads). Broke down exactly what the rule does and why it matters for cutting false positives. Detection engineering is quickly becoming my favorite part of this field.',
      "Grateful for how open the SOC/blue team community is on here - in the last few weeks I've had some great conversations with analysts who took the time to answer my questions about their day-to-day. If you're a SOC analyst willing to share what surprised you most about the role, I'd love to hear it in the comments.",
      "Mistake I made this week: chased a false positive for way too long because I didn't check the asset's baseline behavior first. Lesson learned - always pull context (normal behavior, criticality, ownership) before diving deep into an alert. Small habit, big time saver.",
      'Just passed my SC-200 (Security Operations Analyst) exam! 🎉 It pushed me to actually understand Microsoft Sentinel\'s KQL queries instead of memorizing syntax - genuinely leveled up how I think about detection logic. On to the next one.',
      "This week's headline breach is a good reminder of why log retention and alert tuning matter so much - a SOC with the right detections in place could have caught this at initial access. What would you have flagged first?",
      "Been learning a ton from other analysts' breakdowns of real-world incident response on here - if you're trying to break into SOC, following people who share their actual process is worth more than another course. Who else should I be learning from?",
      "Full writeup: how I investigated a simulated ransomware precursor alert from initial detection to containment recommendation - the SIEM query I used, the process tree analysis, and the exact escalation criteria I applied. Closest I've gotten to what a real SOC shift feels like. Link below.",
      "Unpopular opinion: alert fatigue isn't a tooling problem, it's a tuning problem. Most SOCs already have the tools to reduce noise - what's missing is the discipline to actually tune detections instead of adding more alerts. Curious what working analysts think.",
      "Free resource that's been huge for my SOC prep: TryHackMe's SOC Level 1 path. If you're starting out in blue team and don't know where to begin, start there. Happy to share my study plan if it'd help anyone else.",
      "3 months into focused SOC analyst prep: 4 certs down, dozens of simulated investigations completed, and a network of analysts I never would have met otherwise. Biggest lesson - consistency beats intensity. Thank you to everyone who's engaged with my posts and offered advice along the way.",
    ],
  },
  'Offensive Security': {
    hashtags: '#OffSec #RedTeam #Pentesting #CTF #EthicalHacking',
    posts: [
      "Diving into offensive security because I love thinking like an attacker to help build better defenses. Currently working through TryHackMe and HackTheBox boxes, chasing my OSCP. If you're in red teaming or pentesting and open to sharing what got you into it, I'd love to connect.",
      'Rooted a HackTheBox machine this week using a chained privilege escalation - a misconfigured sudo permission into a SUID binary exploit. Documented my full methodology, tools, and thought process (flag redacted, obviously). Link to the writeup below.',
      "Spent this week going deep on Kerberoasting - how it works, why weak service account passwords make it so effective, and how to actually detect it as a defender too. Understanding the attack makes you better at explaining the fix.",
      "The offensive security community here has been incredibly generous with knowledge - CTF writeups, tool breakdowns, real talk about what pentest reports actually look like. If you're a pentester or red teamer willing to share war stories, I'd love to connect and learn from your experience.",
      "Spent 3 hours stuck on a box because I skipped basic enumeration and jumped straight to exploitation. Lesson relearned the hard way: recon thoroughly before you get clever. Slow is smooth, smooth is fast.",
      'Passed eJPT this week! 🎉 It forced me to actually understand the full pentest methodology end-to-end, not just memorize exploit commands. Next stop: OSCP.',
      "This week's disclosed RCE in a widely-used tool is a good reminder of how much impact a single unauthenticated endpoint can have. Read through the technical writeup - the root cause was a classic deserialization flaw. What's the best public vuln writeup you've read recently?",
      "Been learning a ton from other offensive security folks' CTF writeups and methodology breakdowns here - way more valuable than another course module. If you write up your boxes/CTFs publicly, drop a link, I'd love to read more.",
      "Full writeup: how I compromised a HackTheBox machine from initial foothold to full domain admin - enumeration, exploitation of a vulnerable web app, lateral movement, and privilege escalation via a misconfigured GPO. Every step documented, flags redacted. Closest thing to a real internal pentest I've done.",
      "Hot take: OSCP being 'hard' isn't really about the exploits - it's about forcing you to be methodical under pressure, which is the actual skill that transfers to real engagements. Curious if working pentesters agree.",
      "Free resource that's leveled up my offensive security skills more than anything paid: HackTheBox's free-tier boxes + writing my own reports for every one. If you're starting out, do that before spending money on courses. Happy to share my note-taking template.",
      "3 months deep into offensive security prep: dozens of boxes rooted, eJPT passed, and OSCP prep underway. The biggest shift wasn't technical - it was learning to document everything like I'm writing a real client report. Grateful for everyone in this community who's pointed me toward better resources.",
    ],
  },
  'Cloud Security': {
    hashtags: '#CloudSecurity #AWS #Azure #GCP #CyberSecurity',
    posts: [
      "Getting into cloud security because so much of what we build now lives in AWS/Azure/GCP, and most breaches these days start with a misconfiguration, not a zero-day. Working through cloud security fundamentals right now. If you work in cloud security and are open to sharing what a typical day looks like, I'd love to connect.",
      "Built and then deliberately broke a small AWS environment this week - a public S3 bucket, an over-permissive IAM role, an exposed access key - then wrote up how I'd find and fix each one as a security review. Screenshots and remediation steps below.",
      'Today I learned how to write a proper least-privilege IAM policy instead of reaching for AdministratorAccess out of convenience. Broke down the difference between identity-based and resource-based policies and when each actually applies.',
      "The cloud security community here shares more real, practical config advice than most paid courses I've seen. If you work in cloud security/DevSecOps and are open to connecting, I'd love to learn from your experience with real-world environments.",
      "Spent an embarrassing amount of time debugging an IAM policy that wasn't working - turned out I'd misunderstood how explicit Deny statements override Allow. Small detail, big consequence if you get it backwards in production.",
      'Passed my AWS/Azure security cert this week! 🎉 It pushed me past theory into actually configuring real controls - security groups, KMS key policies, CloudTrail logging. Feeling a lot more confident reading real cloud architecture diagrams now.',
      "This week's cloud misconfiguration story (a publicly exposed storage bucket exposing sensitive data) is such a familiar pattern - it's almost never a sophisticated attack, just a default that was never locked down. What's the cloud misconfiguration you see most often?",
      "Learning a ton from cloud security practitioners sharing real remediation stories here, not just theory. If you've got a cloud security war story worth sharing, I'd genuinely love to hear it.",
      "Full writeup: hardening a vulnerable-by-design AWS environment start to finish - locked down the S3 bucket policy, tightened IAM to least privilege, enabled GuardDuty and CloudTrail, and rotated exposed credentials. Every step, every command, documented below.",
      "Unpopular opinion: most cloud breaches aren't a 'cloud security' problem, they're an IAM problem wearing a cloud costume. Get identity and access right and half the horror stories disappear. Curious if cloud practitioners agree.",
      "Free resource that's been huge for my cloud security prep: AWS's own Well-Architected Security Pillar docs - more practical than most paid courses. If you're starting out, read that first. Happy to share my study notes.",
      "3 months into cloud security prep: a cert down, several hands-on hardening labs completed, and a much clearer mental model of how cloud breaches actually happen. Biggest lesson - the fundamentals (IAM, logging, least privilege) matter more than any fancy tool. Thanks to everyone who's shared real-world advice along the way.",
    ],
  },
  DevSecOps: {
    hashtags: '#DevSecOps #AppSec #CICD #ShiftLeft #CyberSecurity',
    posts: [
      "Getting into DevSecOps because I want security to be baked into how software gets built, not bolted on at the end. Working through CI/CD security and container hardening right now. If you work in DevSecOps or AppSec and are open to sharing your day-to-day, I'd love to connect.",
      'Added a security gate to a sample CI/CD pipeline this week - dependency scanning, SAST, and secrets scanning, all failing the build on a critical finding instead of just warning. Wrote up exactly how I wired it in and what it caught.',
      "Today I learned the real difference between SAST and DAST and when you actually need both, not just one for a checkbox. Broke down what each catches that the other misses.",
      "The DevSecOps community here shares more real pipeline configs than most paid courses. If you work in DevSecOps/AppSec and are open to connecting, I'd love to learn from how you've actually implemented 'shift-left' on a real team.",
      "Spent way too long debugging why my pipeline's secrets scanner wasn't catching an obvious hardcoded key - turned out the scan was running before the commit that introduced it, not after. Order of operations matters more than I expected.",
      'Finished a container security course this week! 🎉 Genuinely changed how I think about image hardening - minimal base images, non-root users, scanning before pushing to a registry. Small changes, real risk reduction.',
      "This week's supply-chain compromise (a popular open-source package with malicious code slipped into an update) is a good reminder of why dependency pinning and SBOM tracking actually matter, not just theoretical best practice. What's your team's approach to dependency risk?",
      "Learning a lot from DevSecOps practitioners sharing real pipeline failures and fixes here, way more useful than another 'shift-left' buzzword post. If you've got a real pipeline security story, I'd love to hear it.",
      "Full writeup: building a security-gated CI/CD pipeline from scratch - dependency scanning, SAST, container image scanning, and secrets detection, each with the exact tool and config I used. Every stage, every failure mode I hit, documented below.",
      "Hot take: 'shift-left' fails on most teams not because the tooling is bad, but because developers get flooded with low-priority findings and tune it all out. Fixing signal-to-noise matters more than adding another scanner.",
      "Free resource that's been huge for my DevSecOps prep: OWASP's DevSecOps guideline docs - way more practical than most paid content. If you're starting out, read that first. Happy to share my pipeline template.",
      "3 months into DevSecOps prep: a container security course done, a working security-gated pipeline built from scratch, and a much better sense of where security actually fits in the SDLC. Biggest lesson - security that developers don't fight is security that actually gets adopted. Thanks to everyone who shared real pipeline advice along the way.",
    ],
  },
  IAM: {
    hashtags: '#IAM #IdentitySecurity #ZeroTrust #AccessManagement',
    posts: [
      "Getting into Identity and Access Management because so many breaches trace back to identity, not malware. Working through SC-300 material right now. If you work in IAM and are open to sharing what a typical week looks like, I'd love to connect.",
      'Ran a full access review on a lab Azure AD tenant this week - found and fixed several over-permissioned accounts and set up conditional access policies requiring MFA for admin roles. Wrote up my full process below.',
      "Today I learned how conditional access policies in Azure AD actually evaluate (and can conflict) - broke down a real scenario where two policies interacted in a way I didn't expect. IAM logic gets subtle fast.",
      "The IAM community here has taught me more about real-world identity architecture than any course so far. If you work in IAM/identity security and are open to connecting, I'd love to learn from how you've handled real access reviews.",
      "Spent an hour confused why a user still had access after I removed them from a group - turned out they also had a direct role assignment I'd missed. Lesson: always check both group-based AND direct assignments during a review.",
      'Passed SC-300 (Identity and Access Administrator) this week! 🎉 It pushed me to actually understand hybrid identity and federation, not just the Azure AD basics. On to hands-on labs next.',
      "This week's credential-stuffing-driven breach is such a familiar pattern - MFA alone would likely have stopped it. What IAM control do you think gets underestimated most often?",
      "Learning a lot from IAM practitioners sharing real access-review horror stories here - way more useful than theory alone. If you've got a real IAM lesson worth sharing, I'd love to hear it.",
      "Full writeup: running a least-privilege access review on a lab tenant end-to-end - identifying over-permissioned accounts, tightening role assignments, enabling conditional access and MFA enforcement, and documenting the before/after risk posture. Every step below.",
      "Unpopular opinion: most orgs don't have an IAM tooling problem, they have an IAM ownership problem - nobody's actually accountable for reviewing access regularly. Tools don't fix that, process does.",
      "Free resource that's been huge for my IAM prep: Microsoft Learn's free Identity and Access Administrator learning path. If you're starting out, that's the place to begin. Happy to share my study notes.",
      "3 months into IAM prep: SC-300 passed, several access-review labs completed, and a much sharper eye for spotting over-permissioned accounts. Biggest lesson - identity truly is the new perimeter. Thanks to everyone who shared real access-review advice along the way.",
    ],
  },
  'AI Security': {
    hashtags: '#AISecurity #LLMSecurity #PromptInjection #AIRedTeam',
    posts: [
      "Getting into AI security because as fast as AI is being adopted, the security thinking is playing catch-up. Working through prompt injection and LLM red-teaming fundamentals right now. If you work in AI security and are open to sharing your perspective, I'd love to connect.",
      "Ran a safe, disclosed prompt injection test against an open-source LLM demo this week - tried to get it to ignore its system prompt via an indirect injection in a document it summarized. Documented what worked, what didn't, and why.",
      "Today I learned the real difference between prompt injection and jailbreaking - they get used interchangeably but they're different attack classes with different mitigations. Broke down both with real examples.",
      "The AI security space is moving so fast that the community here is honestly one of my best sources of real information, faster than most papers. If you work in AI security/ML safety and are open to connecting, I'd love to learn from your perspective.",
      "Assumed a model's system prompt was 'safe' because it wasn't visible in the UI - learned the hard way that a determined indirect injection can still extract it. Never assume obscurity is protection.",
      'Finished an AI security fundamentals course this week! 🎉 Genuinely reframed how I think about the AI attack surface - it\'s not just the model, it\'s the whole pipeline (data, prompts, tools, outputs). More to learn.',
      "This week's disclosed AI security research (a real prompt injection chain against a production LLM tool) is a good reminder that this attack surface is very real, not hypothetical. What's the most interesting AI security research you've read recently?",
      "Learning a lot from AI security researchers sharing real disclosed findings here - the field moves faster than any course can keep up with. If you're doing AI red-teaming work, I'd love to hear what you're seeing.",
      "Full writeup: a structured AI red-teaming exercise against an open-source LLM demo - the injection techniques I tried, which succeeded, which the model's guardrails caught, and what that tells you about designing safer prompts and system architecture. All in a safe, disclosed test environment.",
      "Hot take: most 'AI security' right now is really just prompt engineering wearing a security hat - the field needs a lot more focus on the surrounding system (data pipelines, tool access, output handling), not just the model itself.",
      "Free resource that's been huge for my AI security prep: OWASP's Top 10 for LLM Applications - clearest framework I've found for this space. If you're starting out, read that first. Happy to share my notes.",
      "3 months into AI security prep: a fundamentals course done, several safe red-teaming exercises completed, and a much clearer mental model of the real AI attack surface. Biggest lesson - this field is being defined right now, which makes it a genuinely exciting time to be learning it. Thanks to everyone who shared research and perspective along the way.",
    ],
  },
  GRC: {
    hashtags: '#GRC #RiskManagement #Compliance #ISO27001',
    posts: [
      "Getting into GRC because I like the side of security that's about building systems and accountability, not just finding bugs. Working through ISO 27001 and NIST CSF fundamentals right now. If you work in GRC and are open to sharing what a typical week looks like, I'd love to connect.",
      'Mapped a fictional company\'s security controls to NIST CSF this week as a practice exercise - identified real gaps in their Detect and Respond functions. Wrote up my full control-mapping process and reasoning.',
      "Today I learned the actual difference between a risk assessment and a risk register - they get used interchangeably but serve different purposes in a real GRC program. Broke down both with a simple example.",
      "The GRC community here has taught me more about how real risk programs actually run than any textbook. If you work in GRC/compliance and are open to connecting, I'd love to learn from your experience with real audits.",
      "Assumed a control being 'documented' meant it was actually implemented - learned that a real audit tests evidence, not just policy documents. Big gap between 'written down' and 'actually happening'.",
      'Passed a GRC fundamentals cert this week! 🎉 It pushed me to actually understand how frameworks like ISO 27001 map to real operational controls, not just memorize clause numbers. Next stop: a deeper compliance cert.',
      "This week's regulatory fine (a company penalized for a data protection failure) is a good case study in what happens when governance gaps turn into real financial and reputational risk. What's the compliance failure you find most instructive?",
      "Learning a lot from GRC practitioners sharing real audit and risk-assessment stories here - way more useful than the framework docs alone. If you've got a real governance lesson worth sharing, I'd love to hear it.",
      "Full writeup: a complete risk assessment exercise for a fictional company - identified assets, mapped threats and controls to NIST CSF, scored risk likelihood/impact, and proposed a remediation roadmap. Every step of the methodology documented below.",
      "Unpopular opinion: GRC gets dismissed as 'paperwork security' by technical folks, but a genuinely good risk program prevents more real incidents than most point-in-time technical controls. Curious what practitioners think.",
      "Free resource that's been huge for my GRC prep: NIST's own CSF 2.0 documentation - clearer and more practical than most paid courses. If you're starting out, read that first. Happy to share my control-mapping template.",
      "3 months into GRC prep: a fundamentals cert passed, a full risk assessment exercise completed, and a much better sense of how governance actually connects to real security outcomes. Biggest lesson - GRC isn't the boring side of security, it's the side that makes everything else sustainable. Thanks to everyone who shared real audit and risk advice along the way.",
    ],
  },
};

export const DOMAINS = Object.keys(DOMAIN_CONTENT);

// Standard ISO-8601 week number (1-53), UTC-based - matches Postgres's
// EXTRACT(week FROM ...), which is also ISO-8601. Both sides land on the
// same "which of the 12 weeks is it" answer without needing any per-member
// anchor date.
export function getIsoWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/** 0-11, index into WEEKLY_THEMES / DOMAIN_CONTENT[*].posts for "this week". */
export function getCurrentWeekIndex(date = new Date()) {
  return (getIsoWeekNumber(date) - 1) % 12;
}

/** Resolves a roadmapTrack (possibly null/'Not Assigned'/unrecognized) to a
 * valid DOMAIN_CONTENT key, falling back to 'SOC'. */
export function resolveDomain(roadmapTrack) {
  return roadmapTrack && DOMAIN_CONTENT[roadmapTrack] ? roadmapTrack : 'SOC';
}

/** This week's theme + example post + hashtags for a given track. */
export function getCurrentWeekContent(roadmapTrack, date = new Date()) {
  const idx = getCurrentWeekIndex(date);
  const domain = resolveDomain(roadmapTrack);
  const { week, theme, isNetworkingWeek } = WEEKLY_THEMES[idx];
  return {
    week,
    theme,
    isNetworkingWeek,
    description: THEME_DESCRIPTIONS[theme],
    post: DOMAIN_CONTENT[domain].posts[idx],
    hashtags: DOMAIN_CONTENT[domain].hashtags,
    domain,
  };
}
