// Kept in the same vocabulary as ROADMAP_TRACKS below so a member's
// self-described specialty badge and their coach-assigned roadmap track
// always mean the same thing - these used to diverge (Red Team/Blue Team
// here vs Offensive Security/SOC there, DevSecOps missing entirely), which
// made it easy to assign a specialty that didn't match the actual roadmap
// track. GRC now has a roadmap track counterpart too (see ROADMAP_TRACKS
// and SPECIALIZATION_CATALOGS.GRC below).
export const SPECIALTIES = ['Not Set', 'SOC', 'Offensive Security', 'Cloud Security', 'DevSecOps', 'IAM', 'AI Security', 'GRC'];
export const JOB_READINESS_STAGES = ['Not Started', 'In Progress', 'Interview Ready', 'Job Placed'];
export const GENDERS = ['Male', 'Female'];
export const LOCATIONS = [
  'Cape Town',
  'Johannesburg',
  'Durban',
  'Pretoria',
  'Other (SA)',
  'Other (Rest of the World)',
];
export const AGES = ['16-18', '18-21', '21-24', '24-27', '27-30', '30-35', '35-40', '40+'];
// 'Active' is auto-flagged "Lapsed" after LAPSED_AFTER_DAYS with no payment.
// 'Active (Permanent)' is exempt from that check entirely - for members who've paid
// in full or are otherwise not expected to pay again. 'Leaving' is a grace period -
// access control still lets them sign in (only 'Left' actually blocks), but they see
// a farewell/exit-feedback screen instead of the normal portal; submitting or
// skipping that finalizes them to 'Left'. 'Left' can also be set directly for an
// immediate cutoff with no grace period.
export const MEMBERSHIP_STATUSES = ['Active', 'Active (Permanent)', 'Leaving', 'Left'];

export const OFFBOARDING_REASONS = [
  'Financial constraints',
  'Time constraints',
  'Achieved goals / graduated',
  'Not engaging',
  'Found opportunities elsewhere',
  'Other',
];
export const EMPLOYMENT_STATUSES = ['Not Set', 'Employed', 'Unemployed', 'Student'];
export const MEMBERSHIP_TIERS = ['Basic Access', 'Monthly Operative', 'Elite Operative', 'Permanent Access', 'Custom Plan', 'Maintenance Fee'];

// The learning path a coach assigns a member to - drives which checklist shows
// up under "My Roadmap". Distinct from SPECIALTIES above (that's the member's
// own self-described directory badge); this one is coach-assigned.
export const ROADMAP_TRACKS = ['Not Assigned', 'SOC', 'Offensive Security', 'Cloud Security', 'DevSecOps', 'IAM', 'AI Security', 'GRC'];
export const ROADMAP_PHASES = ['Core Foundations', 'Specialization', 'Projects'];

// A member only sees their Projects section once they've completed this
// share of their own track's Specialization catalog (PROJECT_CATALOGS
// below) - same "earned, not available from day one" reasoning as
// SPECIALIZATION_UNLOCK_MIN, just percentage-based since Specialization
// catalogs vary in length by track (4 to 10 items) where a fixed count
// wouldn't scale fairly across tracks.
export const PROJECTS_UNLOCK_PERCENT = 50;

// The standard Core Foundations "Certifications" catalog every assigned
// roadmap draws from, regardless of track - a member needs at least
// CORE_FOUNDATIONS_MIN_REQUIRED of these done before their Core Foundations
// certs count as complete. Specialization stays fully track-specific beyond
// this, with its own courses/certs.
export const CORE_FOUNDATIONS_CATALOG = [
  { title: 'CISCO Junior Cyber Pathway', defaultDetail: '6/6 courses' },
  { title: 'Immersive Labs', defaultDetail: '20 collections' },
  { title: 'TryHackMe Pre-Security', defaultDetail: '' },
  { title: 'TryHackMe Cyber 101', defaultDetail: '' },
  { title: 'AZ-900', defaultDetail: '' },
  { title: 'AI-901', defaultDetail: '' },
  { title: 'SC-900', defaultDetail: '' },
  { title: 'CompTIA Security+', defaultDetail: '' },
];
export const CORE_FOUNDATIONS_MIN_REQUIRED = 4;

// External course links for select Core Foundations catalog items, shown as
// an "Open Link / Resource" action wherever a roadmap checklist renders
// (My Roadmap, and the admin Roadmaps tab). Keyed by title so it applies to
// any existing roadmap_items row matching a catalog title, not just newly
// auto-assigned ones. Same URLs already used for these in the Resources tab
// (supabase/026_resources.sql) rather than new ones.
export const ROADMAP_ITEM_LINKS = {
  'CISCO Junior Cyber Pathway': 'https://www.netacad.com/career-paths/cybersecurity?courseLang=en-US',
  'Immersive Labs': 'https://www.immersivelabs.com/resources/cybermillion',
  'TryHackMe Pre-Security': 'https://tryhackme.com/paths',
  'TryHackMe Cyber 101': 'https://tryhackme.com/paths',
  'AZ-900': 'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/?practice-assessment-type=certification',
  'AI-901': 'https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-fundamentals/',
  'SC-900': 'https://learn.microsoft.com/en-us/credentials/certifications/security-compliance-and-identity-fundamentals/?practice-assessment-type=certification',
  // IAM specialization (SPECIALIZATION_CATALOGS.IAM below)
  'SC-300': 'https://learn.microsoft.com/en-us/credentials/certifications/identity-and-access-administrator/',
  'THM Active Directory Basics': 'https://tryhackme.com/room/winadbasics',
  'Okta Certified Professional': 'https://certification.okta.com/',
  'CyberArk Defender': 'https://www.credly.com/org/cyberark/badge/cyberark-defender-privileged-access-management-pam',
  'SailPoint Certified Identity Security Administrator': 'https://university.sailpoint.com/sailpoint-certified-identity-security-administrator',
  // AI Security specialization (SPECIALIZATION_CATALOGS['AI Security'] below)
  'AI-103': 'https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-apps-and-agents-developer-associate/',
  'CompTIA SecAI+': 'https://www.comptia.org/en/certifications/secai/',
  'OWASP Top 10 for LLM Applications': 'https://genai.owasp.org/initiatives/top-10-for-llm-and-genai/',
  'THM AI Security': 'https://tryhackme.com/paths',
};

// Short "what is this" line shown under every roadmap item's title (Core
// Foundations, Specialization, and Projects alike), on both My Roadmap and
// the admin Roadmaps tab - title-keyed like ROADMAP_ITEM_LINKS above, and
// deliberately separate from defaultDetail (which seeds a member's own
// editable progress text, e.g. "6/6 courses"), since this is fixed
// reference copy, not something a member fills in. One flat, phase-agnostic
// map works cleanly here because every catalog above uses unique titles.
export const ROADMAP_ITEM_DESCRIPTIONS = {
  // Core Foundations
  'CISCO Junior Cyber Pathway': 'Networking & Cybersecurity Fundamentals',
  'Immersive Labs': 'Hands-on Cyber Skills Across Foundational Topics',
  'TryHackMe Pre-Security': 'Intro to Networking, Web & Security Basics',
  'TryHackMe Cyber 101': 'Practical Intro to Common Cyber Attacks & Tools',
  'AZ-900': 'Azure Fundamentals',
  'AI-901': 'AI Fundamentals',
  'SC-900': 'Security, Compliance & Identity Fundamentals',
  'CompTIA Security+': 'Core Security Principles & Best Practices',
  // Specialization - SOC
  'CySA+': 'Threat Detection & Analysis',
  'SC-200': 'Microsoft Sentinel & Threat Hunting',
  'THM SOC Level 1': 'Guided, Hands-On SOC Analyst Path',
  'Blue Team Level 1': 'Practical Defensive Security Certification',
  // Specialization - Offensive Security
  'eJPT': 'Entry-Level, Practical Pentesting Cert',
  'THM Junior Pentester': 'Guided Path to Your First Pentest Skills',
  'THM Offensive Pentesting': 'Advanced, Realistic Attack Simulation Path',
  'Burp Suite Certified Practitioner': 'Official Web App Testing Certification',
  'OSCP': 'The Industry-Standard Practical Pentesting Cert',
  // Specialization - Cloud Security
  'AZ-104': 'Hands-On Azure Administration',
  'SC-500': 'Cloud & AI Security Engineering',
  'Terraform Associate': 'Infrastructure as Code Fundamentals',
  'SC-100': 'Security Architecture Design',
  'AZ-305': 'Expert-Level Cloud Solutions Architecture',
  // Specialization - DevSecOps
  'Linux Essentials': 'Linux Fundamentals Certification',
  'GH-900': 'GitHub Fundamentals',
  'GH-500': 'Securing Code in the CI/CD Pipeline',
  'KCNA': 'Kubernetes & Cloud Native Fundamentals',
  'KCSA': 'Kubernetes Security Fundamentals',
  'AZ-400': 'DevOps Engineering on Azure',
  'Python (or any programming language)': 'Optional - Scripting & Automation',
  // Specialization - IAM
  'SC-300': 'Identity & Access Administration',
  'THM Active Directory Basics': 'Hands-On Active Directory Fundamentals',
  'Okta Certified Professional': 'Enterprise Identity Platform Certification',
  'CyberArk Defender': 'Privileged Access Management (PAM)',
  'SailPoint Certified Identity Security Administrator': 'Identity Governance & Administration',
  // Specialization - AI Security
  'AI-103': 'Building AI Apps & Agents on Azure',
  'CompTIA SecAI+': 'Security Fundamentals for AI Systems',
  'OWASP Top 10 for LLM Applications': 'The Standard Reference for LLM Vulnerabilities',
  'THM AI Security': 'Hands-On AI Attack & Defense Labs',
  // Specialization - GRC
  'ISO/IEC 27001 Foundation': 'Information Security Management Systems',
  'NIST Cybersecurity Framework (CSF)': "The US Government's Risk Framework",
  'ISC2 CGRC': 'Full Professional GRC Certification',
  'ISACA CRISC': 'Risk Management for IT Systems',
  'ISACA IT Risk Fundamentals': 'Entry-Level IT Risk Certificate',
  'POPIA/GDPR Practitioner': 'Data Protection & Privacy Compliance',
  'ITIL 4 Foundation': 'IT Service Management Fundamentals',
  // Projects - SOC
  'Cloud SIEM Detection Lab': 'Build & Prove Real Detection Skills',
  'Incident Response Write-Up': 'Practice the Full IR Lifecycle',
  // Projects - Offensive Security
  'Full Pentest Report': "Prove You Can Deliver Client-Ready Work",
  'Custom Offensive Tool Build': 'Show You Understand the Tools, Not Just Use Them',
  // Projects - Cloud Security
  'Secure a Cloud Environment': 'Harden Real Infrastructure, Not a Slide Deck',
  'Cloud Security Posture Audit': 'Practice Real Cloud Security Auditing',
  // Projects - DevSecOps
  'Secure CI/CD Pipeline': 'Build Security Into the Pipeline Itself',
  'IaC Security Review': 'Find and Fix Real Infrastructure Misconfigurations',
  // Projects - IAM
  'Zero Trust Access Design': 'Design a Real Identity Architecture',
  'Active Directory Hardening Lab': 'Apply Real AD Security Best Practices',
  // Projects - AI Security
  'Red Team an LLM App': 'Practice Real AI Attack Techniques',
  'AI Risk Assessment Write-Up': 'Connect AI Risk to Real Business Impact',
  // Projects - GRC
  'Mock Risk Assessment': 'Run a Real Risk Assessment Process',
  'Compliance Gap Analysis': 'Practice Real Regulatory Compliance Work',
};

// The longer "what does this actually teach me, and why am I doing it"
// explanation shown in CoreFoundationInfoModal when a member clicks an
// item - ROADMAP_ITEM_DESCRIPTIONS above stays the short one-line tag shown
// inline on the checklist itself. Covers every Core Foundations,
// Specialization, and Projects item across all 7 tracks.
export const ROADMAP_ITEM_INFO = {
  // ---- Core Foundations ----
  'CISCO Junior Cyber Pathway': {
    teaches: "How data actually moves across a network - IP addressing, routing, switching - plus a first pass at core cybersecurity concepts, through Cisco's free, self-paced NetAcad courses.",
    journey: "Almost every cybersecurity role assumes you already understand networking. This is the \"learn to read the map before you defend the territory\" step - usually the very first thing to work through, before certs like Security+ or SC-900 make full sense.",
  },
  'Immersive Labs': {
    teaches: "Hands-on, browser-based labs spanning dozens of foundational topics - from basic Linux commands to intro malware analysis - no local lab setup required.",
    journey: "This is where theory turns into muscle memory. Instead of just reading about a concept, you're actually doing it in a real (safe) environment - exactly what technical interviews and real SOC/analyst work expect from you.",
  },
  'TryHackMe Pre-Security': {
    teaches: "The absolute basics: how networks work, what a web request actually is, and core security terminology - aimed at someone with zero technical background.",
    journey: "If cybersecurity is a completely new field for you, this is the true starting line. It exists specifically so nobody gets lost in jargon before they've even had a chance to get curious about the field.",
  },
  'TryHackMe Cyber 101': {
    teaches: "A hands-on, guided tour through common attacker tools and techniques - your first real look at things like Nmap, Metasploit, or a phishing simulation - inside a safe lab environment.",
    journey: "This is usually the first time it \"clicks\" that cybersecurity is something you do, not just something you read about. It's the on-ramp to thinking like both an attacker and a defender, whichever track you end up specializing in.",
  },
  'AZ-900': {
    teaches: "Core cloud concepts - what Azure actually is, its main services, how pricing works, and basic governance - with zero prior cloud experience assumed.",
    journey: "The overwhelming majority of companies you'll interview at run at least part of their infrastructure on a cloud platform. This is a fast, cheap way to speak that language credibly in an interview, no matter which of the 7 specializations you end up on.",
  },
  'AI-901': {
    teaches: "What AI and machine learning actually are, common AI workloads, and responsible AI principles - no coding or data science background needed.",
    journey: "AI is already showing up inside the tools you'll use day to day - SOC copilots, AI-assisted code review - and AI Security is one of the 7 specialization tracks here. This gives you the vocabulary to understand what you're securing before you ever specialize in securing it.",
  },
  'SC-900': {
    teaches: "The building blocks of identity, access management, and compliance in a Microsoft cloud environment - Zero Trust, MFA, and the reasoning behind access controls.",
    journey: "This maps most directly onto real analyst work of any Core Foundations item. Identity and access sit at the center of almost every major breach you'll ever read about, so this gives you real, working vocabulary for it early.",
  },
  'CompTIA Security+': {
    teaches: "The industry-standard baseline for cybersecurity knowledge - threats, cryptography, risk management, and security operations - vendor-neutral and globally recognized.",
    journey: "This is the one cert almost every entry-level cybersecurity job posting names outright. It's the last Core Foundations item on purpose - it pulls together everything the others introduced, and it's usually the credential that gets your CV past the first filter.",
  },

  // ---- Specialization: SOC ----
  'CySA+': {
    teaches: "Behavioral threat detection, log/SIEM analysis, vulnerability management, and incident response - the practical, day-to-day skills of a SOC analyst, building directly on what Security+ introduced.",
    journey: "This is the specialization-level cert that actually matches the job title you're chasing on the SOC track. Where Security+ proves you know the concepts, CySA+ proves you can apply them to real alerts and real incidents.",
  },
  'SC-200': {
    teaches: "How to investigate, respond to, and hunt for threats using Microsoft Sentinel, Defender XDR, and Kusto Query Language (KQL) - the actual tools a SOC analyst uses in a Microsoft shop.",
    journey: "A huge share of real SOC jobs run on Microsoft's security stack. This is the cert that proves you can operate the specific tools you'll be handed on day one, not just the theory behind them.",
  },
  'THM SOC Level 1': {
    teaches: "A structured TryHackMe path covering the full SOC analyst toolkit hands-on - SIEM triage, phishing analysis, log analysis, and endpoint detection - through real guided labs.",
    journey: "This is where the SOC track stops being theoretical. It's the practical rehearsal for the exact kind of alert triage you'd be doing in a junior SOC analyst seat.",
  },
  'Blue Team Level 1': {
    teaches: "A practical, exam-based certification covering security fundamentals, phishing analysis, digital forensics, SIEM, and incident response - built entirely around real defensive work, not multiple-choice theory.",
    journey: "BTL1's exam is a practical investigation, not a quiz - it's often cited by hiring managers as genuine proof you can actually do defensive work, which makes it a strong complement to the more theory-heavy certs on this track.",
  },

  // ---- Specialization: Offensive Security ----
  'eJPT': {
    teaches: "Core penetration testing methodology - reconnaissance, scanning, exploitation, and reporting - validated through a genuinely hands-on practical exam rather than multiple-choice questions.",
    journey: "This is usually the first real proof-of-skill cert on the Offensive Security track - affordable, genuinely practical, and a common first rung before something like OSCP.",
  },
  'THM Junior Pentester': {
    teaches: "A structured TryHackMe learning path covering the fundamentals of penetration testing - web app attacks, network exploitation, and privilege escalation - through guided, hands-on rooms.",
    journey: "This is the practical on-ramp for the whole track: it takes the concepts from Pre-Security/Cyber 101 and turns them into an actual, repeatable pentesting workflow.",
  },
  'THM Offensive Pentesting': {
    teaches: "A harder, more realistic TryHackMe path simulating full attack chains against more complex, less guided environments - closer to what a real engagement actually looks like.",
    journey: "This is the step up in difficulty right before OSCP - it's where members build the independence and troubleshooting stamina that a real, unguided exam like OSCP actually demands.",
  },
  'Burp Suite Certified Practitioner': {
    teaches: "Rigorous, exam-based validation of web application penetration testing skills, using Burp Suite - the industry-standard tool - set and administered by PortSwigger themselves.",
    journey: "Web apps are still one of the most common entry points in real engagements, and BSCP is the one credential that specifically proves you can find and exploit real web vulnerabilities, not just recite the OWASP Top 10.",
  },
  'OSCP': {
    teaches: "A grueling, fully hands-on 24-hour practical exam - compromise real machines, escalate privileges, and write a professional-grade report, with zero multiple-choice questions anywhere in the process.",
    journey: "This is the single most recognized credential in offensive security hiring, full stop. It's deliberately the hardest, most expensive item on this track - everything else here exists to get you ready for this one.",
  },

  // ---- Specialization: Cloud Security ----
  'AZ-104': {
    teaches: "Day-to-day Azure administration - managing identities, storage, virtual networks, and compute resources - the practical skills behind actually running an Azure environment, not just knowing what it is.",
    journey: "AZ-900 proved you know the concepts; this proves you can actually operate the platform. It's usually the first \"real\" cert on the Cloud Security track, before the security-specific ones layer on top.",
  },
  'SC-500': {
    teaches: "How to design and implement end-to-end security controls across cloud AND AI workloads - Microsoft Entra ID, Defender for Cloud, Sentinel, Security Copilot, and securing AI agents themselves - Microsoft's newest security engineering cert, replacing the retiring AZ-500.",
    journey: "This is the most current, forward-looking cert on the Cloud Security track - it folds AI workload security directly into cloud security engineering, which is exactly where the industry is heading right now.",
  },
  'Terraform Associate': {
    teaches: "How to write, plan, apply, and manage infrastructure configurations using Terraform across multi-cloud environments (AWS, Azure, GCP) - the industry-standard tool for Infrastructure as Code.",
    journey: "Cloud and DevSecOps teams don't click through consoles anymore - they write code that provisions infrastructure. This is the cert that proves you can work the way real cloud teams actually work day to day.",
  },
  'SC-100': {
    teaches: "How to design security strategy and architecture across identity, infrastructure, data, and applications - a higher-level, cross-domain view than any single fundamentals or associate exam covers.",
    journey: "This is an Expert-level cert - it sits above the others on this track deliberately, aimed at someone ready to design a security strategy, not just implement one piece of it. A strong signal for anyone eyeing a senior or lead cloud security role.",
  },
  'AZ-305': {
    teaches: "How to design solutions across compute, networking, storage, and security on Azure at an Expert level - translating business requirements into a real, working cloud architecture.",
    journey: "This is the general cloud-architecture counterpart to SC-100's security-specific focus - between the two, you can credibly design an Azure environment and defend why it's secure.",
  },

  // ---- Specialization: DevSecOps ----
  'Linux Essentials': {
    teaches: "Core Linux skills - the command line, file systems, basic scripting, and how open-source software actually works - from the Linux Professional Institute.",
    journey: "DevSecOps runs almost entirely on Linux - CI/CD runners, containers, cloud VMs, all of it. This is the foundation that makes every other DevSecOps cert and tool on this track actually make sense.",
  },
  'GH-900': {
    teaches: "The fundamentals of GitHub itself - repositories, branching, pull requests, and collaboration workflows - the basic mechanics of how modern software actually gets built and shipped.",
    journey: "Before you can secure a CI/CD pipeline, you need to understand the platform it's built on. This is the on-ramp to GH-500 and to the DevSecOps track's whole \"secure the pipeline\" theme.",
  },
  'GH-500': {
    teaches: "How to use GitHub's Advanced Security features - code scanning, secret scanning, and dependency review - to catch vulnerabilities before they ever reach production.",
    journey: "This is DevSecOps in one certification: security folded directly into the same pipeline developers already use, not bolted on afterward. It's one of the most directly job-relevant certs on this track.",
  },
  'KCNA': {
    teaches: "The fundamentals of Kubernetes and the broader cloud native ecosystem - containers, orchestration, observability, and application delivery - CNCF's own entry-level certification.",
    journey: "Kubernetes now runs a huge share of modern infrastructure. This is the credential that proves you understand the platform DevSecOps teams are actually securing, before you specialize in securing it specifically.",
  },
  'KCSA': {
    teaches: "Security-specific Kubernetes concepts - the 4C's of cloud native security, pod security, network policies, and supply chain security - building directly on what KCNA introduces.",
    journey: "This is where the DevSecOps track's two halves - \"Dev\" and \"Sec\" - actually meet on Kubernetes specifically. It's the natural next step right after KCNA.",
  },
  'AZ-400': {
    teaches: "How to design and implement DevOps practices on Azure end to end - CI/CD pipelines, infrastructure as code, dependency management, and application monitoring.",
    journey: "This is an Expert-level cert that ties the whole DevSecOps track together on Microsoft's platform specifically - the natural \"capstone\" alongside AZ-104, once the fundamentals are solid.",
  },
  'Python (or any programming language)': {
    teaches: "Enough scripting ability to automate repetitive tasks, parse logs, or write a small security tool - Python is the most common choice in this field, but the underlying skill (not the specific language) is what matters.",
    journey: "This is marked optional for a reason - it's not a certification, it's a genuinely useful skill. Being able to write even simple scripts sets DevSecOps (and honestly, every track's) candidates apart in interviews.",
  },

  // ---- Specialization: IAM ----
  'SC-300': {
    teaches: "How to design, implement, and operate identity and access management using Microsoft Entra ID - authentication, authorization, governance, and hybrid identity.",
    journey: "Identity is the core of the IAM track, and this is the Microsoft-specific version of exactly that - directly relevant since Entra ID is one of the most widely deployed identity platforms in the industry.",
  },
  'THM Active Directory Basics': {
    teaches: "How Active Directory actually works under the hood - domains, users, groups, and group policy - through a real, hands-on TryHackMe lab environment.",
    journey: "Active Directory still runs identity for most large organizations. This is the hands-on counterpart to SC-300's theory - actually seeing how AD is structured before you're asked to secure or attack it.",
  },
  'Okta Certified Professional': {
    teaches: "How to configure and administer Okta - one of the most widely used enterprise identity and single sign-on platforms - covering provisioning, authentication policies, and integrations.",
    journey: "Where SC-300 covers Microsoft's identity platform, this covers the other major one companies actually run. Between the two, you can speak credibly about identity in almost any enterprise environment you interview at.",
  },
  'CyberArk Defender': {
    teaches: "How to operate CyberArk's Privileged Access Management platform - the tools that control, monitor, and secure access to an organization's most sensitive accounts and credentials.",
    journey: "Privileged accounts are the target in almost every major breach - this cert proves you understand the specific discipline (PAM) built to stop that, which is a genuinely specialized, in-demand corner of IAM.",
  },
  'SailPoint Certified Identity Security Administrator': {
    teaches: "How to administer SailPoint's identity governance platform - access certifications, provisioning workflows, and policy enforcement across an organization's full identity lifecycle.",
    journey: "This rounds out the IAM track with identity governance specifically - the \"who should have access to what, and who signs off on it\" side of IAM, distinct from the authentication-focused certs earlier on this track.",
  },

  // ---- Specialization: AI Security ----
  'AI-103': {
    teaches: "How to design and build AI-powered applications and agents on Azure - integrating language models, orchestrating agent workflows, and deploying AI solutions responsibly.",
    journey: "You can't secure what you don't understand how to build. This gives you the builder's-eye view of how AI applications and agents actually work, which is exactly what you need before specializing in attacking or defending them.",
  },
  'CompTIA SecAI+': {
    teaches: "The security-specific side of AI systems - securing AI models, data pipelines, and deployments, plus using AI as a security tool itself - CompTIA's own dedicated AI security certification.",
    journey: "This is the direct AI Security counterpart to CompTIA Security+ on the general track - the credential that maps most literally onto \"AI Security\" as a job title.",
  },
  'OWASP Top 10 for LLM Applications': {
    teaches: "The ten most critical, most common vulnerability classes specific to large language model applications - prompt injection, insecure output handling, training data poisoning, and more - maintained by the same OWASP project behind the original web Top 10.",
    journey: "This is a free reference guide, not a paid cert - but it's the one document almost every real AI Security job posting and interview will assume you've read. It's the fastest way to sound credible on this specific, fast-moving topic.",
  },
  'THM AI Security': {
    teaches: "Practical, hands-on labs covering real AI security scenarios - attacking and defending LLM applications - through TryHackMe's guided rooms.",
    journey: "This is where the OWASP Top 10 for LLMs stops being a reading list and becomes something you've actually done. Hands-on practice here is genuinely rare in this field right now, which makes it a real differentiator.",
  },

  // ---- Specialization: GRC ----
  'ISO/IEC 27001 Foundation': {
    teaches: "The structure and requirements of ISO/IEC 27001 - the internationally recognized standard for building and running an Information Security Management System (ISMS).",
    journey: "ISO 27001 is one of the most universally recognized security standards in the world - this is often the very first GRC credential someone earns, since so many other frameworks and audits reference it directly.",
  },
  'NIST Cybersecurity Framework (CSF)': {
    teaches: "The structure of the NIST CSF - Identify, Protect, Detect, Respond, Recover - a widely adopted framework for understanding and managing cybersecurity risk at an organizational level.",
    journey: "NIST CSF shows up constantly in GRC work, especially with US-facing or regulated organizations. Fluency here is often assumed rather than explicitly asked for in interviews, which makes it easy to underestimate how often you'll actually need it.",
  },
  'ISC2 CGRC': {
    teaches: "A comprehensive view of governance, risk management, and compliance from ISC2 - the same organization behind CISSP - covering the full risk management lifecycle end to end.",
    journey: "This is one of the two full professional-level GRC certifications on this track (alongside CRISC) - a genuinely respected, harder-earned credential once you're ready to go beyond the foundational frameworks.",
  },
  'ISACA CRISC': {
    teaches: "How to identify, assess, and manage IT risk specifically - connecting technical risk directly to business impact, from ISACA, one of the most established names in GRC certification.",
    journey: "CRISC is one of the most consistently in-demand GRC credentials on real job postings. It's the natural full-certification step up once the fundamentals-level frameworks (ISO 27001, NIST CSF) feel solid.",
  },
  'ISACA IT Risk Fundamentals': {
    teaches: "The foundational principles of IT risk management - identifying, assessing, and responding to risk - as a genuinely entry-level certificate, no prior experience required.",
    journey: "This is the accessible on-ramp to CRISC - real ISACA content at a fraction of the cost and difficulty, which makes it a smart first step into risk management specifically before committing to the full certification.",
  },
  'POPIA/GDPR Practitioner': {
    teaches: "The practical requirements of South Africa's POPIA and the EU's GDPR - two of the most consequential data protection laws in the world - and how organizations actually stay compliant with them.",
    journey: "Privacy law isn't going away, and for a South African-based community, POPIA fluency is genuinely locally relevant in a way most international certs aren't. This is often the most directly applicable GRC item for a local employer.",
  },
  'ITIL 4 Foundation': {
    teaches: "The fundamentals of IT Service Management (ITSM) - how organizations actually deliver, support, and continually improve IT services - the global standard framework for it.",
    journey: "GRC work rarely happens in a vacuum - it touches how IT services are actually run day to day. ITIL gives you that operational vocabulary, which is often what separates a GRC hire who can only talk policy from one who can talk to the IT team too.",
  },

  // ---- Projects: SOC ----
  'Cloud SIEM Detection Lab': {
    teaches: "How to actually stand up a SIEM - not just use one someone else configured - by deploying a real platform (Wazuh or Elastic), feeding it real log data, and writing detection rules that catch real behavior.",
    journey: "This is the project that turns \"I've studied SIEM concepts\" into \"I've built one.\" It's exactly the kind of concrete, demonstrable proof a hiring manager can ask you to walk through in an interview.",
  },
  'Incident Response Write-Up': {
    teaches: "How to run and document a complete incident response, start to finish - detection, containment, eradication, and lessons learned - the same structure real IR teams use.",
    journey: "Almost every SOC interview eventually asks \"walk me through how you'd handle an incident.\" This project means you have a real, specific answer instead of a generic textbook one.",
  },

  // ---- Projects: Offensive Security ----
  'Full Pentest Report': {
    teaches: "How to run a complete penetration test against a vulnerable-by-design target and write it up the way a real client would actually receive it - findings, CVSS scoring, and remediation guidance.",
    journey: "Finding vulnerabilities is only half the job - the report is what a client actually pays for. This project proves you can do both halves, which is exactly what separates a hobbyist from someone ready to be paid for this work.",
  },
  'Custom Offensive Tool Build': {
    teaches: "How to design, write, and document a small offensive security tool of your own - a scanner, a fuzzer, or similar - instead of only ever running tools someone else built.",
    journey: "Building even a simple tool proves a level of understanding that using off-the-shelf tools alone can't. It's a genuine standout on a CV, since most junior candidates have only ever run Nmap and Metasploit, never built anything themselves.",
  },

  // ---- Projects: Cloud Security ----
  'Secure a Cloud Environment': {
    teaches: "How to stand up a small real cloud environment and then actually harden it - least-privilege IAM, network segmentation, logging - and document the before-and-after state.",
    journey: "Cloud Security certs prove you know the concepts; this project proves you can apply them to something real. \"I secured a real environment and can show you what changed\" is a genuinely strong interview answer.",
  },
  'Cloud Security Posture Audit': {
    teaches: "How to audit a cloud environment against an actual industry benchmark (CIS Benchmarks or the Well-Architected Framework) and document what you found.",
    journey: "Auditing is a distinct, real skill from building - a lot of cloud security work is reviewing someone else's environment, not your own. This project proves you can do that half of the job too.",
  },

  // ---- Projects: DevSecOps ----
  'Secure CI/CD Pipeline': {
    teaches: "How to build a real CI/CD pipeline with security scanning gates built in - SAST, dependency scanning, or container scanning - and document exactly how it's wired together.",
    journey: "This is DevSecOps in its purest form: security that's automated into the pipeline, not a manual review bolted on afterward. It's the single most representative project you could build for this track.",
  },
  'IaC Security Review': {
    teaches: "How to write real Terraform for a small environment, scan it with a real tool (Checkov or tfsec), and then actually fix what it finds - documenting the before-and-after.",
    journey: "Misconfigured infrastructure is one of the most common real-world breach causes. This project proves you can catch that class of mistake before it ever gets deployed, not just after the fact.",
  },

  // ---- Projects: IAM ----
  'Zero Trust Access Design': {
    teaches: "How to actually design an IAM access model from scratch for a hypothetical organization - least-privilege roles, MFA enforcement, and conditional access - not just describe Zero Trust as a concept.",
    journey: "Anyone can define \"Zero Trust\" in an interview. Far fewer candidates can actually design what it looks like in practice - this project is proof you're one of them.",
  },
  'Active Directory Hardening Lab': {
    teaches: "How to set up a small Active Directory lab and then actually harden it using real, documented best practices - and explain exactly what you changed and why.",
    journey: "AD attacks are still one of the most common paths to a full domain compromise. Showing you can harden AD, not just describe how it works, is a genuine, specific signal for an IAM-focused role.",
  },

  // ---- Projects: AI Security ----
  'Red Team an LLM App': {
    teaches: "How to actually attempt prompt injection and jailbreak attacks against a real LLM-powered application, and document what worked, what didn't, and why - grounded in the OWASP Top 10 for LLMs.",
    journey: "AI Security is new enough that very few candidates have hands-on attack experience yet. Being able to say \"I've actually red-teamed an LLM app\" puts you meaningfully ahead in a field where most people only have theory.",
  },
  'AI Risk Assessment Write-Up': {
    teaches: "How to research a genuine AI security risk - model poisoning or data leakage, for example - and write up exactly how it would apply to a hypothetical company's real AI deployment.",
    journey: "This is the analytical, risk-focused half of AI Security, distinct from the hands-on red-teaming project - together they cover both how AI systems get attacked and how organizations should think about that risk.",
  },

  // ---- Projects: GRC ----
  'Mock Risk Assessment': {
    teaches: "How to actually perform a risk assessment for a hypothetical organization using a real, recognized framework (NIST RMF or ISO 27001) - not just describe what a risk assessment is.",
    journey: "Risk assessment is the core, repeatable activity of GRC work. This project proves you can actually run the process end to end, which is exactly what a GRC analyst is hired to do.",
  },
  'Compliance Gap Analysis': {
    teaches: "How to assess a hypothetical company's actual compliance posture against a real regulation (POPIA or GDPR) and document the specific gaps and a remediation plan.",
    journey: "Gap analysis is one of the most common real deliverables in GRC work - this project is direct, portfolio-ready practice for exactly that, using regulations that are genuinely, currently in force.",
  },
};

// A member only sees their Specialization section once they've completed
// this many Core Foundations certs - a higher bar than
// CORE_FOUNDATIONS_MIN_REQUIRED (which just marks foundations as "met"),
// deliberately: Specialization stays hidden a little longer than the
// minimum, so it reads as something earned rather than available from day
// one.
export const SPECIALIZATION_UNLOCK_MIN = 5;

// Refer a Friend's reward, in Rand - single source of truth so the member
// modal, the referrals list, and the admin table all show the same figure
// instead of three hardcoded "R500"s that could quietly drift apart if the
// amount ever changes. See supabase/039_referrals.sql's status column for
// how a referral moves from Pending -> Joined -> Reward Paid.
export const REFERRAL_REWARD_AMOUNT = 500;

// Standard Specialization catalogs, by roadmap_track and the category name
// each track's specialization items are grouped under. Only tracks with a
// defined catalog here get the admin "Add Standard Specialization"
// quick-fill.
export const SPECIALIZATION_CATALOGS = {
  SOC: {
    category: 'SOC',
    items: [
      { title: 'CySA+', defaultDetail: '' },
      { title: 'SC-200', defaultDetail: '' },
      { title: 'THM SOC Level 1', defaultDetail: '' },
      { title: 'Blue Team Level 1', defaultDetail: '' },
    ],
  },
  'Offensive Security': {
    category: 'Pen Testing',
    items: [
      { title: 'eJPT', defaultDetail: '' },
      { title: 'THM Junior Pentester', defaultDetail: '' },
      { title: 'THM Offensive Pentesting', defaultDetail: '' },
      { title: 'Burp Suite Certified Practitioner', defaultDetail: '' },
      { title: 'OSCP', defaultDetail: '' },
    ],
  },
  'Cloud Security': {
    category: 'Cloud Security',
    items: [
      { title: 'AZ-104', defaultDetail: '' },
      { title: 'SC-200', defaultDetail: '' },
      { title: 'SC-500', defaultDetail: '' },
      { title: 'Terraform Associate', defaultDetail: '' },
      { title: 'SC-100', defaultDetail: '' },
      { title: 'AZ-305', defaultDetail: '' },
    ],
  },
  DevSecOps: {
    category: 'DevSecOps',
    items: [
      { title: 'Linux Essentials', defaultDetail: '' },
      { title: 'GH-900', defaultDetail: '' },
      { title: 'GH-500', defaultDetail: '' },
      { title: 'KCNA', defaultDetail: '' },
      { title: 'KCSA', defaultDetail: '' },
      { title: 'Terraform Associate', defaultDetail: '' },
      { title: 'AZ-104', defaultDetail: '' },
      { title: 'AZ-400', defaultDetail: '' },
      { title: 'SC-500', defaultDetail: '' },
      { title: 'Python (or any programming language)', defaultDetail: 'Optional' },
    ],
  },
  GRC: {
    category: 'GRC',
    items: [
      { title: 'ISO/IEC 27001 Foundation', defaultDetail: '' },
      { title: 'NIST Cybersecurity Framework (CSF)', defaultDetail: '' },
      { title: 'ISC2 CGRC', defaultDetail: '' },
      { title: 'ISACA CRISC', defaultDetail: '' },
      { title: 'ISACA IT Risk Fundamentals', defaultDetail: '' },
      { title: 'POPIA/GDPR Practitioner', defaultDetail: '' },
      { title: 'ITIL 4 Foundation', defaultDetail: '' },
    ],
  },
  IAM: {
    category: 'IAM',
    items: [
      { title: 'SC-300', defaultDetail: '' },
      { title: 'THM Active Directory Basics', defaultDetail: '' },
      { title: 'Okta Certified Professional', defaultDetail: '' },
      { title: 'CyberArk Defender', defaultDetail: '' },
      { title: 'SailPoint Certified Identity Security Administrator', defaultDetail: '' },
    ],
  },
  'AI Security': {
    category: 'AI Security',
    items: [
      { title: 'AI-103', defaultDetail: '' },
      { title: 'CompTIA SecAI+', defaultDetail: '' },
      { title: 'OWASP Top 10 for LLM Applications', defaultDetail: '' },
      { title: 'THM AI Security', defaultDetail: '' },
    ],
  },
};

// Standard Projects catalogs, by roadmap_track - unlocked once a member
// clears PROJECTS_UNLOCK_PERCENT of their own track's SPECIALIZATION_CATALOGS
// entry (see the "Projects" phase gate in My Roadmap). Two real, portfolio-
// grade projects per track, each tailored to what that track actually does
// day to day, rather than a generic "build something" prompt.
export const PROJECT_CATALOGS = {
  SOC: {
    category: 'SOC Projects',
    items: [
      { title: 'Cloud SIEM Detection Lab', defaultDetail: 'Deploy a SIEM (e.g. Wazuh or Elastic), ingest logs from a cloud source, build 3 real detection rules' },
      { title: 'Incident Response Write-Up', defaultDetail: 'Document a full simulated incident end-to-end: detection, containment, eradication, lessons learned' },
    ],
  },
  'Offensive Security': {
    category: 'Offensive Security Projects',
    items: [
      { title: 'Full Pentest Report', defaultDetail: 'Run a complete pentest against a vulnerable-by-design target, write a professional report with CVSS scoring and remediation' },
      { title: 'Custom Offensive Tool Build', defaultDetail: 'Write and document a small custom tool you built yourself (e.g. a scanner or fuzzer)' },
    ],
  },
  'Cloud Security': {
    category: 'Cloud Security Projects',
    items: [
      { title: 'Secure a Cloud Environment', defaultDetail: 'Stand up a small Azure/AWS environment and harden it (least privilege, network segmentation, logging) - document before/after' },
      { title: 'Cloud Security Posture Audit', defaultDetail: 'Audit an environment against a real benchmark (CIS or the Well-Architected Framework), document findings' },
    ],
  },
  DevSecOps: {
    category: 'DevSecOps Projects',
    items: [
      { title: 'Secure CI/CD Pipeline', defaultDetail: 'Build a pipeline with integrated security scanning (SAST, dependency, or container scanning gates), document the setup' },
      { title: 'IaC Security Review', defaultDetail: 'Write Terraform for a small environment, scan it with Checkov or tfsec, fix the findings, document before/after' },
    ],
  },
  IAM: {
    category: 'IAM Projects',
    items: [
      { title: 'Zero Trust Access Design', defaultDetail: 'Design and document an IAM access model for a hypothetical org: least-privilege roles, MFA, conditional access' },
      { title: 'Active Directory Hardening Lab', defaultDetail: 'Set up a small AD lab, apply real hardening best practices, document what changed and why' },
    ],
  },
  'AI Security': {
    category: 'AI Security Projects',
    items: [
      { title: 'Red Team an LLM App', defaultDetail: 'Attempt prompt injection/jailbreak attacks against an LLM-powered app, document findings against the OWASP Top 10 for LLMs' },
      { title: 'AI Risk Assessment Write-Up', defaultDetail: "Research a real AI security risk (model poisoning, data leakage), document how it applies to a hypothetical company's deployment" },
    ],
  },
  GRC: {
    category: 'GRC Projects',
    items: [
      { title: 'Mock Risk Assessment', defaultDetail: 'Perform a risk assessment for a hypothetical org using a real framework (NIST RMF or ISO 27001), document findings' },
      { title: 'Compliance Gap Analysis', defaultDetail: "Assess a hypothetical company's posture against a real regulation (POPIA or GDPR), document gaps and remediation" },
    ],
  },
};

// ============================================================================
// EXAM READINESS - per-cert prep checklist + latest practice-test score,
// surfaced on the member-facing Cert Calendar tab. Deliberately not built
// on roadmap_items.detail (free text, never parsed anywhere) - these are
// real, structured milestones instead (051_exam_readiness.sql).
// ============================================================================

// Same 4 milestone keys for every cert so the readiness formula (50%
// checklist + 50% latest practice score) never has to special-case a
// cert's checklist length - only the labels differ. Security+ gets real,
// specific labels drawn from SecurityPlusGuideModal.jsx's own content
// (it's the one cert with a full in-app guide today); the other five get
// the same honest, generic milestones until someone writes cert-specific
// guide content for them too.
const GENERIC_READINESS_MILESTONES = [
  { key: 'study_course', label: 'Completed a full study course for this exam' },
  { key: 'objectives_reviewed', label: "Reviewed the exam's official objectives/skills outline" },
  { key: 'practice_test_1', label: 'Taken a first practice test' },
  { key: 'practice_test_2', label: 'Taken a second practice test' },
];

export const EXAM_READINESS_CATALOGS = {
  'Security+': {
    label: 'CompTIA Security+',
    milestones: [
      { key: 'study_course', label: "Watched Professor Messer's full Security+ video course" },
      { key: 'objectives_reviewed', label: 'Reviewed the official CompTIA Security+ exam objectives' },
      { key: 'practice_test_1', label: 'Taken a first ExamCompass/PocketPrep practice test' },
      { key: 'practice_test_2', label: 'Taken a second practice test' },
    ],
  },
  'AZ-900': { label: 'Microsoft AZ-900 (Azure Fundamentals)', milestones: GENERIC_READINESS_MILESTONES },
  'SC-200': { label: 'Microsoft SC-200 (Security Operations Analyst)', milestones: GENERIC_READINESS_MILESTONES },
  'SC-900': { label: 'Microsoft SC-900 (Security, Compliance & Identity Fundamentals)', milestones: GENERIC_READINESS_MILESTONES },
  'CySA+': { label: 'CompTIA CySA+', milestones: GENERIC_READINESS_MILESTONES },
  eJPT: { label: 'INE eJPT (Junior Penetration Tester)', milestones: GENERIC_READINESS_MILESTONES },
};

// Matches a free-text cert_calendar.cert_name (members type whatever they
// want, e.g. "CompTIA Security+" or "Security+ (SY0-701)") against the
// catalog above - same lowercase-substring approach CertDetailsModal.jsx
// already uses for its own cert knowledge base, so the two stay consistent
// rather than each inventing a different matching rule. Returns the
// catalog key, or null if this cert has no defined readiness program yet.
export function matchExamReadinessCert(certName) {
  const clean = (certName || '').toLowerCase();
  if (clean.includes('cysa')) return 'CySA+';
  if (clean.includes('ejpt')) return 'eJPT';
  if (clean.includes('az-900') || clean.includes('az900')) return 'AZ-900';
  if (clean.includes('sc-200') || clean.includes('sc200')) return 'SC-200';
  if (clean.includes('sc-900') || clean.includes('sc900')) return 'SC-900';
  // Checked after the more specific Microsoft/CySA+ matches above so
  // "Security Operations Analyst (SC-200)" doesn't get misread as
  // Security+ just for containing the word "security" - same permissive
  // 'security'/'sec+' substring CertDetailsModal.jsx already matches on.
  if (clean.includes('security') || clean.includes('sec+') || clean.includes('sy0-')) return 'Security+';
  return null;
}

// A member is flagged "Lapsed" if they haven't paid in this many days and haven't
// been explicitly marked Active or Left by an admin - a nudge to go check on them,
// not a verdict.
export const LAPSED_AFTER_DAYS = 45;

// A member's "Last 1on1 Meeting" is flagged once it's this many days old.
export const MEETING_OVERDUE_AFTER_DAYS = 30;

// A member's roadmap is flagged "gone quiet" once the most recent item
// update is this many days old - shared by the member-facing dashboard
// banner and the admin Stale Roadmaps queue so both sides agree on what
// "stale" means.
export const ROADMAP_STALE_AFTER_DAYS = 14;

// The admin Insights "Exam Readiness" nudge flags a member whose booked
// exam (cert_calendar, still Pending) falls within this many days AND
// whose computeReadinessPercent() score is under this threshold - the
// window and the bar for "worth a proactive check-in", not a verdict on
// whether they'll pass.
export const EXAM_NUDGE_WINDOW_DAYS = 14;
export const EXAM_NUDGE_THRESHOLD_PCT = 50;

// The email escalation (supabase/functions/roadmap-reminder-email) is a
// full checkpoint cadence, not a single threshold like the in-app nudge
// above - fully computed inside get_stale_roadmap_members_for_reminder()
// in 028_roadmap.sql, which can't import this file (separate Deno/Postgres
// runtime), so these exist here purely as documentation for any future
// client-side UI that wants to reference the same numbers, not as values
// anything actually reads from at send-time.
export const ROADMAP_REMINDER_CHECKPOINTS_DAYS = [7, 14, 21, 30];
export const ROADMAP_NEWCOMER_REMINDER_INTERVAL_DAYS = 3;
export const ROADMAP_NEWCOMER_WINDOW_DAYS = 30;
export const ROADMAP_DISENGAGEMENT_ALERT_AFTER_DAYS = 21;

// ============================================================================
// MEMBERS DIRECTORY - GROUPED BY DOMAIN VIEW
// ============================================================================

// The Team - founder + mentors, shown in their own group ahead of the
// Specialization tracks in both the admin and member Members views. Small
// and rarely changes membership, so it's a plain constant here rather than
// a database table or admin-editable setting - the same "just hardcode it,
// it barely changes" treatment gemma-chat/index.ts's FAQ_KNOWLEDGE gives
// mentor info. Same four people as the real MENTORS list in
// MemberPortal.jsx's Book a 1on1 screen. Nokulunga's real email isn't
// confirmed yet (2026-08) - add her here once it is; until then she just
// won't show up in this grouped view, same as anyone else with no matching
// row. Extend this array (by email, lowercase) as mentors change - the
// display name always comes from that person's own real profile, never
// duplicated here.
export const TEAM_MEMBERS = [
  { email: 'siya@hackinghub.co.za', role: 'Founder' },
  { email: 'nonhlanhlakamangethe@gmail.com', role: 'Community Mentor · Data Security & AI' },
  { email: 'kmchunu029@gmail.com', role: 'Community Mentor · Red Teaming' },
];

// One accent hue per track, reused for both the compact group card's accent
// border and its avatar-stack tint - keeps a track visually identifiable at
// a glance across the whole grouped view. Offensive Security gets the
// product's own accent-cyan since it's the flagship track; the rest are
// hues already used elsewhere in this app (release-note group colors) so
// nothing here is a freshly invented palette.
export const TRACK_COLORS = {
  'Offensive Security': '#5ee37a',
  'SOC': '#3b82f6',
  'Cloud Security': '#22d3ee',
  'DevSecOps': '#a78bfa',
  'IAM': '#f5b942',
  'AI Security': '#f472b6',
  'GRC': '#fb923c',
};
export const OTHER_GROUP_COLOR = '#94a3b8';
export const TEAM_GROUP_COLOR = '#f5b942';

/**
 * Splits a flat member list into { team, tracks, other } for the grouped
 * directory view - team matched by email against TEAM_MEMBERS, then each
 * real ROADMAP_TRACKS entry (excluding the "Not Assigned" placeholder
 * value), then "other" for anyone left with no track assigned at all.
 * `getEmail`/`getTrack` adapt this to whichever shape of member object the
 * caller has (the admin roster and the member-facing directory use
 * different field names for the same underlying data).
 */
export function groupMembersByDomain(members, getEmail, getTrack) {
  const teamEmails = new Set(TEAM_MEMBERS.map((t) => t.email.toLowerCase()));
  const team = [];
  const tracks = {};
  ROADMAP_TRACKS.filter((t) => t !== 'Not Assigned').forEach((t) => { tracks[t] = []; });
  const other = [];

  (members || []).forEach((m) => {
    const email = (getEmail(m) || '').toLowerCase();
    if (teamEmails.has(email)) {
      team.push(m);
      return;
    }
    const track = getTrack(m);
    if (track && tracks[track]) {
      tracks[track].push(m);
    } else {
      other.push(m);
    }
  });

  return { team, tracks, other };
}
