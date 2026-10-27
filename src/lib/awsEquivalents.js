// The AWS side of the Azure / AWS switch (see cloudPlatform.js).
//
// A member picks Azure or AWS once and every Microsoft cloud cert on their
// roadmap is shown as its AWS equivalent. This file holds the data: which
// AWS credential stands in for which Azure one, plus the same link /
// tagline / info / subtask / price entries every roadmap title needs
// (memberOptions.js merges them into its title-keyed maps at the bottom).
//
// AWS has no like-for-like credential for every Microsoft security cert,
// so a few rows are the closest fit rather than a true twin - those are
// marked "closest fit" below. Where several Azure certs share one AWS
// equivalent (all the security ones land on the Security Specialty), the
// roadmap shows it once.

export const AZURE_TO_AWS = {
  'AZ-900': 'AWS Certified Cloud Practitioner',
  'AI-901': 'AWS Certified AI Practitioner',
  // Closest fit: AWS has no fundamentals-level security exam, so this is
  // the free Skill Builder course rather than a certification.
  'SC-900': 'AWS Security Fundamentals',
  // 2026-10-26: Solutions Architect – Associate, the usual AWS pairing for
  // AZ-104 and the stepping stone to the Professional exam AZ-305 maps to.
  // (SysOps Administrator was the stand-in before; its entries below are kept.)
  'AZ-104': 'AWS Certified Solutions Architect – Associate',
  // Closest fit for the four Microsoft security certs: the Security Specialty
  // is AWS's only security credential.
  'SC-200': 'AWS Certified Security – Specialty',
  'SC-500': 'AWS Certified Security – Specialty',
  'SC-100': 'AWS Certified Security – Specialty',
  'SC-300': 'AWS Certified Security – Specialty',
  'AZ-305': 'AWS Certified Solutions Architect – Professional',
  'AZ-400': 'AWS Certified DevOps Engineer – Professional',
  'AI-103': 'AWS Certified Machine Learning Engineer – Associate',
  'AZ-700': 'AWS Certified Advanced Networking – Specialty',
};

export const AWS_ROADMAP_LINKS = {
  'AWS Certified Cloud Practitioner': 'https://aws.amazon.com/certification/certified-cloud-practitioner/',
  'AWS Certified AI Practitioner': 'https://aws.amazon.com/certification/certified-ai-practitioner/',
  'AWS Security Fundamentals': 'https://skillbuilder.aws/',
  'AWS Certified Solutions Architect – Associate': 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
  'AWS Certified SysOps Administrator – Associate': 'https://aws.amazon.com/certification/certified-sysops-admin-associate/',
  'AWS Certified Solutions Architect – Professional': 'https://aws.amazon.com/certification/certified-solutions-architect-professional/',
  'AWS Certified DevOps Engineer – Professional': 'https://aws.amazon.com/certification/certified-devops-engineer-professional/',
  'AWS Certified Machine Learning Engineer – Associate': 'https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/',
  'AWS Certified Advanced Networking – Specialty': 'https://aws.amazon.com/certification/certified-advanced-networking-specialty/',
};

export const AWS_ROADMAP_DESCRIPTIONS = {
  'AWS Certified Cloud Practitioner': 'AWS Cloud Fundamentals',
  'AWS Certified AI Practitioner': 'AI, ML & Generative AI Fundamentals',
  'AWS Security Fundamentals': 'Free AWS Security Basics Course',
  'AWS Certified Solutions Architect – Associate': 'Core AWS Architecture, Secure & Resilient',
  'AWS Certified SysOps Administrator – Associate': 'Hands-On AWS Administration',
  'AWS Certified Solutions Architect – Professional': 'Expert-Level Cloud Solutions Architecture',
  'AWS Certified DevOps Engineer – Professional': 'DevOps Engineering on AWS',
  'AWS Certified Machine Learning Engineer – Associate': 'Building & Deploying ML Solutions on AWS',
  'AWS Certified Advanced Networking – Specialty': 'AWS Networking at Depth',
};

export const AWS_ROADMAP_INFO = {
  'AWS Certified Cloud Practitioner': {
    teaches: "Core cloud concepts - what AWS is, its main services, how pricing and support work, and the shared responsibility model - with zero prior cloud experience assumed.",
    journey: "The AWS counterpart to AZ-900. A huge share of real infrastructure runs on AWS, so this is a fast, affordable way to speak that language credibly in an interview.",
  },
  'AWS Certified AI Practitioner': {
    teaches: "What AI, machine learning and generative AI are, how foundation models are used, and responsible AI principles on AWS - no coding or data science background needed.",
    journey: "The AWS counterpart to AI-901. AI is already showing up inside the tools you will use day to day, and this gives you the vocabulary to follow along.",
  },
  'AWS Security Fundamentals': {
    teaches: "The building blocks of security on AWS - the shared responsibility model, IAM, encryption and key management, and monitoring and compliance. A free Skill Builder course, not an exam.",
    journey: "AWS has no fundamentals-level security exam, so this free course is the closest stand-in for SC-900. Identity and access sit at the centre of almost every major breach, and this gives you the AWS view of it.",
  },
  'AWS Certified Solutions Architect – Associate': {
    teaches: "Designing secure, resilient and cost-aware architectures on AWS - compute, storage, networking, databases and the security services around them - through scenario questions about picking the right service.",
    journey: "The AWS counterpart to AZ-104, and the most common AWS associate certification. It leads straight into the Solutions Architect – Professional exam, which is the AWS counterpart to AZ-305.",
  },
  'AWS Certified SysOps Administrator – Associate': {
    teaches: "Deploying, managing and operating workloads on AWS day to day - monitoring, automation, networking and cost optimisation.",
    journey: "The AWS counterpart to AZ-104. The Cloud Practitioner proved you know the concepts; this proves you can actually operate the platform.",
  },
  'AWS Certified Solutions Architect – Professional': {
    teaches: "Designing complex, multi-account, cost-aware architectures on AWS, including migration, resilience and organisational complexity, at a senior level.",
    journey: "The AWS counterpart to AZ-305. It is one of the hardest AWS exams, so it comes late - once you have real hands-on time on the platform.",
  },
  'AWS Certified DevOps Engineer – Professional': {
    teaches: "Automating the full delivery pipeline on AWS - CI/CD, infrastructure as code, monitoring, logging and incident response at scale.",
    journey: "The AWS counterpart to AZ-400. It proves you can run delivery pipelines the way real DevOps and DevSecOps teams do.",
  },
  'AWS Certified Machine Learning Engineer – Associate': {
    teaches: "Building, training, deploying and maintaining machine learning solutions on AWS, particularly with SageMaker, from an engineering point of view.",
    journey: "The AWS counterpart to AI-103. It suits members who want to build AI applications rather than only secure them.",
  },
  'AWS Certified Advanced Networking – Specialty': {
    teaches: "Designing, implementing and securing complex network architectures on AWS - hybrid connectivity, routing, DNS, and network security controls.",
    journey: "The AWS counterpart to AZ-700. It pairs well with a traditional networking cert such as CCNA, and is a respected specialty credential.",
  },
};

export const AWS_FOUNDATION_SUBTASKS = {
  'AWS Certified Cloud Practitioner': [
    { key: 'awsclf-1', label: 'Cloud concepts' },
    { key: 'awsclf-2', label: 'Security and compliance' },
    { key: 'awsclf-3', label: 'Cloud technology and services' },
    { key: 'awsclf-4', label: 'Billing, pricing and support' },
  ],
  'AWS Certified AI Practitioner': [
    { key: 'awsaif-1', label: 'Fundamentals of AI and ML' },
    { key: 'awsaif-2', label: 'Fundamentals of generative AI' },
    { key: 'awsaif-3', label: 'Applications of foundation models' },
    { key: 'awsaif-4', label: 'Guidelines for responsible AI' },
    { key: 'awsaif-5', label: 'Security, compliance and governance for AI solutions' },
  ],
  'AWS Security Fundamentals': [
    { key: 'awssec-1', label: 'Security on AWS and the shared responsibility model' },
    { key: 'awssec-2', label: 'Identity and access management (IAM)' },
    { key: 'awssec-3', label: 'Protecting data: encryption and key management' },
    { key: 'awssec-4', label: 'Monitoring, logging and compliance' },
  ],
};

export const AWS_FOUNDATION_PRICING = {
  'AWS Certified Cloud Practitioner': { price: 'About R1,800 ($100 USD)', free: false, note: 'The exam fee. AWS sets the price in US dollars, so the rand figure moves with the exchange rate.' },
  'AWS Certified AI Practitioner': { price: 'About R1,800 ($100 USD)', free: false, note: 'The exam fee, at the same level as Cloud Practitioner. AWS sets the price in US dollars.' },
  'AWS Security Fundamentals': { price: 'Free', free: true, note: 'A free digital course on AWS Skill Builder. There is no exam to pay for.' },
};

// Study weeks for the track pathway view (see trackPathway.js).
export const AWS_CERT_STUDY_WEEKS = {
  'AWS Certified Solutions Architect – Associate': 8,
  'AWS Certified SysOps Administrator – Associate': 8,
  'AWS Certified Solutions Architect – Professional': 8,
  'AWS Certified DevOps Engineer – Professional': 8,
  'AWS Certified Machine Learning Engineer – Associate': 6,
  'AWS Certified Advanced Networking – Specialty': 8,
  'AWS Certified Security – Specialty': 10,
};
