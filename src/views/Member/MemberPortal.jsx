import React, { useState, useEffect } from 'react';
import { createPayfastCheckoutUrl } from '../../lib/payfast';
import CertDetailsModal from '../../components/CertDetailsModal';
import { fetchReviews, submitReview } from '../../lib/reviewsData';
import { fetchMemberDirectory, updateMyDirectoryProfile } from '../../lib/memberDirectoryData';
import { LOCATIONS, SPECIALTIES, EMPLOYMENT_STATUSES } from '../../lib/memberOptions';
import {
  Calendar,
  CalendarDays,
  CheckSquare,
  Square,
  Clock,
  BookOpen,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Video,
  ShieldCheck,
  ExternalLink,
  Megaphone,
  Award,
  Flame,
  Bell,
  Sparkles,
  Info,
  MapPin,
  Users,
  Trophy,
  Target,
  Briefcase,
  Building2,
  Banknote,
  Headphones,
  Map,
  MessageSquare,
  NotebookPen,
  Library,
  Download,
  FileText,
  Star,
  Search,
  Pencil,
  Link,
  User,
} from 'lucide-react';

const REVIEW_CATEGORIES = ['Praise', 'Criticism', 'Recommendation', 'Feature Request', 'General'];

const MOCK_REVIEWS = [
  {
    id: 'mock-1',
    email: 'nonhlanhla@example.com',
    memberName: '[REDACTED]',
    rating: 5,
    category: 'Praise',
    title: 'The 1on1 coaching changed my trajectory',
    body: "Six months ago I didn't know what OSCP even stood for. Jaco's coaching sessions made the roadmap actually feel achievable.",
    visibility: 'Public',
    createdAt: '2026-07-28T10:00:00Z',
  },
  {
    id: 'mock-2',
    email: 'you@example.com',
    memberName: 'You',
    rating: 3,
    category: 'Recommendation',
    title: 'More beginner-friendly cloud content',
    body: 'Most of the cloud security resources assume AWS/Azure familiarity already. Would love a true zero-to-hero track.',
    visibility: 'Private',
    createdAt: '2026-08-02T14:30:00Z',
  },
];

// Mentor photos live in public/mentors/ (not src/assets/) so they can be dropped
// in or swapped at any time without a rebuild-breaking import - a missing file
// (or no `photo` at all, e.g. Momelezi) just falls back to a plain avatar icon
// (see mentorPhotoErrors state in the component below).
const MENTORS = [
  {
    id: 'siya',
    name: '[REDACTED]',
    photo: '/mentors/siya-headshot.jpeg',
    badge: 'LEAD MENTOR & FOUNDER',
    badgeClass: 'badge-success',
    sideNote: 'Available Slots',
    bio: 'Cybersecurity Strategy, Career Roadmaps, OSCP Coaching, SOC, Cloud Security, DevSecOps & Technical Code Reviews.',
    primary: true,
  },
  {
    id: 'nonhlanhla',
    name: 'Nonhlanhla',
    photo: '/mentors/nonhlanhla-zwane-headshot.jpeg',
    badge: 'COMMUNITY MENTOR',
    badgeClass: 'badge-warning',
    sideNote: 'Synced via Siya',
    bio: 'Data Security & AI.',
  },
  {
    id: 'nokulunga',
    name: 'Nokulunga',
    photo: '/mentors/nokulunga-headshot.jpeg',
    badge: 'COMMUNITY MENTOR',
    badgeClass: 'badge-warning',
    sideNote: 'Synced via Siya',
    bio: 'Digital Forensics (DFIR).',
  },
  {
    id: 'momelezi',
    name: 'Momelezi 👻',
    photo: null,
    badge: 'COMMUNITY MENTOR',
    badgeClass: 'badge-warning',
    sideNote: 'Synced via Siya',
    bio: 'Red Teaming / Ethical Hacking.',
  },
];
const MENTOR_CALENDAR_URL = 'https://calendar.app.google/eKVRpXkHCKKcnhYT6';

const MOCK_DIRECTORY = [
  {
    email: 'nonhlanhla@example.com',
    fullName: '[REDACTED]',
    about: 'Blue team enthusiast grinding toward Security+. Always down to pair on a SOC lab.',
    location: 'Johannesburg',
    linkedin: 'https://linkedin.com/in/example',
    specialty: 'Blue Team',
    jobReadiness: 'Interview Ready',
    employmentStatus: 'Unemployed',
    jobTitle: '',
  },
  {
    email: 'khody@example.com',
    fullName: 'Khody Netshifhefhe',
    about: 'OSCP-focused. Happy to walk through HackTheBox boxes with anyone stuck.',
    location: 'Pretoria',
    linkedin: '',
    specialty: 'Red Team',
    jobReadiness: 'In Progress',
    employmentStatus: 'Student',
    jobTitle: '',
  },
  {
    email: 'joshua@example.com',
    fullName: 'Joshua Harrop',
    about: 'Landed a Cloud Security role straight out of the program. Happy to review CVs or mock-interview anyone prepping for cloud roles.',
    location: 'Cape Town',
    linkedin: 'https://linkedin.com/in/example',
    specialty: 'Cloud Security',
    jobReadiness: 'Job Placed',
    employmentStatus: 'Employed',
    jobTitle: 'Cloud Security Engineer',
  },
  {
    email: 'lindokuhle@example.com',
    fullName: 'Lindokuhle Dube',
    about: 'GRC track. Studying for Certified IT Auditor and always keen to talk frameworks over coffee.',
    location: 'Durban',
    linkedin: '',
    specialty: 'GRC',
    jobReadiness: 'Interview Ready',
    employmentStatus: 'Unemployed',
    jobTitle: '',
  },
  {
    email: 'thabo@example.com',
    fullName: 'Thabo Ndlovu',
    about: 'Passed OSCP earlier this year and now working as a full-time pentester. Ask me about the exam, not the vouchers.',
    location: 'Johannesburg',
    linkedin: 'https://linkedin.com/in/example',
    specialty: 'Red Team',
    jobReadiness: 'Job Placed',
    employmentStatus: 'Employed',
    jobTitle: 'Penetration Tester',
  },
  {
    email: 'palesa@example.com',
    fullName: 'Palesa Dlamini',
    about: 'Blue team newbie building out a home SOC lab. Currently working through the PortSwigger Academy.',
    location: 'Pretoria',
    linkedin: '',
    specialty: 'Blue Team',
    jobReadiness: 'In Progress',
    employmentStatus: 'Student',
    jobTitle: '',
  },
  {
    email: 'mzimasi@example.com',
    fullName: '[REDACTED]',
    about: 'Just getting started with the community - figuring out whether Cloud Security or GRC is the right fit.',
    location: 'Other (SA)',
    linkedin: '',
    specialty: 'Cloud Security',
    jobReadiness: 'Not Started',
    employmentStatus: 'Unemployed',
    jobTitle: '',
  },
];

export default function MemberPortal({ activeTab, user, isMockSession }) {
  const [selectedCert, setSelectedCert] = useState(null);
  // Tracks which mentor photos have failed to load (e.g. not uploaded to
  // public/mentors/ yet) so those cards fall back to a plain avatar icon.
  const [mentorPhotoErrors, setMentorPhotoErrors] = useState({});

  // Reviews / feedback - real Supabase data for a real session (RLS scopes what
  // comes back: public reviews + this member's own private ones), local mock data
  // under Mock Member since there's no real session for RLS to key off.
  const [reviews, setReviews] = useState(isMockSession ? MOCK_REVIEWS : []);
  const [loadingReviews, setLoadingReviews] = useState(!isMockSession);
  const [reviewsError, setReviewsError] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: '', category: 'General', title: '', body: '', visibility: 'Private' });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchReviews()
      .then((data) => !cancelled && setReviews(data))
      .catch((err) => !cancelled && setReviewsError(err.message))
      .finally(() => !cancelled && setLoadingReviews(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.body.trim()) return;

    const payload = {
      email: user?.email || 'unknown@example.com',
      memberName: user?.user_metadata?.full_name || 'Member',
      rating: reviewForm.rating ? Number(reviewForm.rating) : null,
      category: reviewForm.category,
      title: reviewForm.title,
      body: reviewForm.body,
      visibility: reviewForm.visibility,
    };

    setSubmittingReview(true);
    setReviewsError(null);
    try {
      if (isMockSession) {
        setReviews([{ ...payload, id: `mock-${Date.now()}`, memberName: 'You', createdAt: new Date().toISOString() }, ...reviews]);
      } else {
        const saved = await submitReview(payload);
        setReviews([saved, ...reviews]);
      }
      setReviewForm({ rating: '', category: 'General', title: '', body: '', visibility: 'Private' });
    } catch (err) {
      setReviewsError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };
  // Member directory - real Supabase data (via get_member_directory, which only
  // ever returns a hand-picked safe column set) for a real session, local mock
  // roster under Mock Member since there's no real session to call the RPC with.
  const [directory, setDirectory] = useState(isMockSession ? MOCK_DIRECTORY : []);
  const [loadingDirectory, setLoadingDirectory] = useState(!isMockSession);
  const [directoryError, setDirectoryError] = useState(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const emptyProfileForm = {
    fullName: user?.user_metadata?.full_name || '',
    about: '',
    location: '',
    linkedin: '',
    specialty: 'Not Set',
    employmentStatus: 'Not Set',
    jobTitle: '',
  };
  const [profileForm, setProfileForm] = useState(emptyProfileForm);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchMemberDirectory()
      .then((data) => !cancelled && setDirectory(data))
      .catch((err) => !cancelled && setDirectoryError(err.message))
      .finally(() => !cancelled && setLoadingDirectory(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const myDirectoryEntry = directory.find((m) => m.email === user?.email);

  const openEditProfile = () => {
    setProfileForm(myDirectoryEntry ? { ...emptyProfileForm, ...myDirectoryEntry } : emptyProfileForm);
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setDirectoryError(null);
    try {
      if (isMockSession) {
        setDirectory((prev) => {
          const others = prev.filter((m) => m.email !== user.email);
          return [{ ...profileForm, email: user.email }, ...others];
        });
      } else {
        await updateMyDirectoryProfile(profileForm);
        const updated = await fetchMemberDirectory();
        setDirectory(updated);
      }
      setEditingProfile(false);
    } catch (err) {
      setDirectoryError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const filteredDirectory = directory.filter((m) => {
    const q = directorySearch.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.specialty.toLowerCase().includes(q) ||
      m.location.toLowerCase().includes(q)
    );
  });

  // Mock roadmap tasks
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Complete PortSwigger Web Security Academy: Directory Traversal', completed: true },
    { id: 2, text: 'Submit write-up for HackTheBox: "Internal" machine', completed: false },
    { id: 3, text: 'Review Windows Active Directory privilege escalation notes', completed: false },
    { id: 4, text: 'Schedule mock OSCP exam run with Jaco (Mentor)', completed: false },
  ]);

  // Mock Community News & Certification Victories Data
  const communityVictories = [
    { id: 1, member: 'Nonhlanhla S.', cert: 'CompTIA Security+', date: 'Yesterday', avatarColor: 'var(--accent-cyan)' },
    { id: 2, member: 'Khody N.', cert: 'OSCP Penetration Tester', date: '2 days ago', avatarColor: 'var(--accent-purple)' },
    { id: 3, member: 'Joshua H.', cert: 'SOC Analyst Deployment', date: '3 days ago', avatarColor: 'var(--success)' },
    { id: 4, member: 'Lindokuhle D.', cert: 'Certified IT Auditor', date: '5 days ago', avatarColor: 'var(--warning)' },
  ];

  const upcomingEvent = {
    title: 'Intro to Zero-Knowledge Proofs & Wargaming CTF',
    date: 'Aug 15, 2026 at 18:30 SAST',
    location: 'HH Discord & Hybrid JHB',
    rsvps: 42,
  };

  // All upcoming events members can attend, across every category
  const [eventTypeFilter, setEventTypeFilter] = useState('All');
  const communityEvents = [
    {
      id: 1,
      type: 'HH Meetup',
      title: 'Cyber War Games: Capture The Flag',
      date: '2026-08-16',
      time: '18:00',
      location: 'HH Discord & Hybrid JHB',
      description: 'Team-based CTF night with prizes for the top 3 teams.',
      rsvps: 42,
    },
    {
      id: 2,
      type: 'Sunday Catchup',
      title: 'Sunday Coffee & Code Catchup',
      date: '2026-08-17',
      time: '10:00',
      location: 'Google Meet',
      description: 'Casual weekly hangout — share wins, ask questions, no agenda.',
      rsvps: 18,
    },
    {
      id: 3,
      type: 'HH Meetup',
      title: 'OSINT Fundamentals Workshop',
      date: '2026-08-23',
      time: '17:30',
      location: 'Online (Zoom)',
      description: 'Hands-on open-source recon workshop led by Jaco.',
      rsvps: 21,
    },
    {
      id: 4,
      type: 'Industry Event',
      title: 'ITWeb Security Summit 2026',
      date: '2026-08-25',
      time: '08:00',
      location: 'Sandton Convention Centre',
      description: 'Industry conference — HH is attending as a group, ask in the community for details.',
      rsvps: 9,
    },
    {
      id: 5,
      type: 'Sunday Catchup',
      title: 'Sunday Coffee & Code Catchup',
      date: '2026-08-24',
      time: '10:00',
      location: 'Google Meet',
      description: 'Casual weekly hangout — share wins, ask questions, no agenda.',
      rsvps: 15,
    },
    {
      id: 6,
      type: 'Industry Event',
      title: 'BSides Cape Town',
      date: '2026-09-05',
      time: '09:00',
      location: 'Cape Town',
      description: 'Community-run infosec conference — group discount code shared in the community.',
      rsvps: 6,
    },
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  const EVENT_TYPE_STYLES = {
    'HH Meetup': { className: 'badge-success' },
    'Industry Event': { className: 'badge-warning' },
    'Sunday Catchup': { style: { background: 'rgba(192, 132, 252, 0.15)', color: 'var(--accent-purple)', border: '1px solid rgba(192, 132, 252, 0.25)' } },
  };

  const filteredEvents = eventTypeFilter === 'All'
    ? communityEvents
    : communityEvents.filter(e => e.type === eventTypeFilter);

  // Quarterly TryHackMe competition
  const currentCompetition = {
    title: 'Q3 2026 Community CTF Sprint',
    platform: 'TryHackMe',
    status: 'Active',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    description: 'Complete as many rooms as you can in the HH TryHackMe team space this quarter. Points are tallied from room completions — top 3 finishers win prizes.',
    prize: 'R1,500 voucher (1st) · OSCP exam voucher (2nd) · HH hoodie (3rd)',
  };

  const competitionLeaderboard = [
    { rank: 1, member: 'Khody Netshifhefhe', rooms: 12, points: 3840 },
    { rank: 2, member: 'Sanele Khumalo', rooms: 11, points: 3510 },
    { rank: 3, member: '[REDACTED]', rooms: 9, points: 2980 },
    { rank: 4, member: 'Joshua Harrop', rooms: 8, points: 2600 },
    { rank: 5, member: 'Thando Mandondo', rooms: 7, points: 2210 },
  ];

  // Job Board — roles sourced from HH's employer network and job placement partners
  const [jobTypeFilter, setJobTypeFilter] = useState('All');
  const jobListings = [
    {
      id: 1,
      title: 'SOC Analyst (Junior)',
      company: 'Nclose',
      location: 'Johannesburg (Hybrid)',
      type: 'Full-Time',
      posted: '2026-08-01',
      salary: 'R18,000 – R25,000 / month',
      description: 'Entry-level SOC role monitoring alerts, triaging incidents, and escalating to senior analysts. Great fit for members who\'ve completed Security+.',
      tags: ['Blue Team', 'Security+', 'Entry Level'],
    },
    {
      id: 2,
      title: 'Junior Penetration Tester',
      company: 'Telspace Systems',
      location: 'Cape Town (Onsite)',
      type: 'Full-Time',
      posted: '2026-07-28',
      salary: 'R22,000 – R30,000 / month',
      description: 'Assist senior consultants on web and network penetration tests. OSCP in progress or completed strongly preferred.',
      tags: ['Red Team', 'OSCP', 'Junior'],
    },
    {
      id: 3,
      title: 'GRC Analyst Intern',
      company: 'Standard Bank',
      location: 'Johannesburg (Onsite)',
      type: 'Internship',
      posted: '2026-08-05',
      salary: 'R8,000 / month stipend',
      description: '6-month internship supporting risk assessments and compliance documentation within the group security office.',
      tags: ['GRC', 'Internship'],
    },
    {
      id: 4,
      title: 'Cloud Security Engineer',
      company: 'Entelect',
      location: 'Remote (SA)',
      type: 'Full-Time',
      posted: '2026-07-20',
      salary: 'R45,000 – R60,000 / month',
      description: 'Own security posture for AWS and Azure workloads. AZ-500 or equivalent cloud security cert required.',
      tags: ['Cloud Security', 'AZ-500', 'Mid-Level'],
    },
    {
      id: 5,
      title: 'Vulnerability Assessment Contractor',
      company: 'Private Client (via HH Network)',
      location: 'Remote',
      type: 'Contract',
      posted: '2026-08-06',
      salary: 'Project-based',
      description: 'Short-term engagement running external vulnerability scans and reporting for a mid-size fintech. Referred through the Hacking Hub network.',
      tags: ['Red Team', 'Contract'],
    },
  ].sort((a, b) => new Date(b.posted) - new Date(a.posted));

  const JOB_TYPE_BADGE = {
    'Full-Time': 'badge-success',
    'Contract': 'badge-warning',
    'Internship': 'badge-danger',
  };

  const filteredJobs = jobTypeFilter === 'All'
    ? jobListings
    : jobListings.filter(j => j.type === jobTypeFilter);

  // Resources — cert prep, role roadmaps, podcasts, books, interview prep, CV templates
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState('All');
  const RESOURCE_CATEGORIES = ['All', 'Cert Prep', 'Role Roadmaps', 'Podcasts', 'Books', 'Interview Playbooks', 'CV Templates'];
  const RESOURCE_ICON = {
    'Cert Prep': FileText,
    'Role Roadmaps': Map,
    'Podcasts': Headphones,
    'Books': BookOpen,
    'Interview Playbooks': MessageSquare,
    'CV Templates': NotebookPen,
  };

  const resources = [
    { id: 1, category: 'Cert Prep', title: 'OSCP Study Notes & Buffer Overflow Cheatsheet', format: 'HH Guide', description: 'Community-maintained notes covering AD attacks, privilege escalation, and manual buffer overflow steps.' },
    { id: 2, category: 'Cert Prep', title: 'CompTIA Security+ Exam Objectives Breakdown', format: 'HH Guide', description: 'Domain-by-domain summary of the SY0-701 objectives with practice question links.' },
    { id: 3, category: 'Cert Prep', title: 'eCPPT Prep Checklist', format: 'HH Guide', description: 'What to review before booking your eCPPT practical exam window.' },
    { id: 4, category: 'Role Roadmaps', title: 'SOC Analyst Roadmap (0–2 Years)', format: 'Roadmap', description: 'Skills, certs, and projects to go from no experience to a confident junior SOC analyst.' },
    { id: 5, category: 'Role Roadmaps', title: 'Penetration Tester Roadmap', format: 'Roadmap', description: 'Junior to senior progression for offensive security, with recommended certs at each stage.' },
    { id: 6, category: 'Role Roadmaps', title: 'Cloud Security Engineer Roadmap', format: 'Roadmap', description: 'AWS and Azure security fundamentals through to AZ-500 and beyond.' },
    { id: 7, category: 'Role Roadmaps', title: 'GRC Analyst Roadmap', format: 'Roadmap', description: 'Building a governance, risk, and compliance career — frameworks worth knowing and where to start.' },
    { id: 8, category: 'Podcasts', title: 'Darknet Diaries', format: 'Podcast', description: 'True stories from the dark side of the internet — great for building intuition on real attacks.' },
    { id: 9, category: 'Podcasts', title: 'Risky Business', format: 'Podcast', description: 'Weekly news roundup on the security industry — good for staying current for interviews.' },
    { id: 10, category: 'Books', title: "The Web Application Hacker's Handbook", format: 'Book', description: 'Still one of the best deep dives into web app exploitation techniques.' },
    { id: 11, category: 'Books', title: 'Practical Malware Analysis', format: 'Book', description: 'Hands-on introduction to analysing malicious software in a lab environment.' },
    { id: 12, category: 'Interview Playbooks', title: 'Cybersecurity Interview Question Bank', format: 'Playbook', description: '80+ real questions asked at SA employers, grouped by role (SOC, pentest, GRC, cloud).' },
    { id: 13, category: 'Interview Playbooks', title: 'Mock Interview Prep Guide', format: 'Playbook', description: 'How to structure answers with the STAR method for technical and behavioural rounds.' },
    { id: 14, category: 'CV Templates', title: 'Entry-Level Security CV Template', format: 'Template', description: 'Formatted for ATS systems, built for members with certs but limited work experience.' },
    { id: 15, category: 'CV Templates', title: 'Pentester / Red Team CV Template', format: 'Template', description: 'Structured to highlight CTF placements, bug bounty finds, and lab write-ups.' },
  ];

  const filteredResources = resourceCategoryFilter === 'All'
    ? resources
    : resources.filter(r => r.category === resourceCategoryFilter);

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handlePayfastPay = (planName, amount, isSubscription = true) => {
    const checkoutUrl = createPayfastCheckoutUrl({
      itemName: `Hacking Hub - ${planName}`,
      amount: amount,
      subscriptionType: isSubscription ? 1 : 0,
      frequency: 3, // monthly
    });
    window.location.href = checkoutUrl;
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  // Membership Tier Definitions
  const ALL_TIERS = [
    {
      rank: 1,
      name: 'Basic Access',
      priceDisplay: 'R 200.00',
      period: '/ month',
      amount: 200,
      badgeClass: 'badge-warning',
      badgeText: 'BASIC ACCESS',
      benefits: [
        'Community Discord access',
        'CV & LinkedIn profile reviews',
        'Basic member directory access',
      ],
    },
    {
      rank: 2,
      name: 'Monthly Operative',
      priceDisplay: 'R 600.00',
      period: '/ month',
      amount: 600,
      badgeClass: 'badge-success',
      badgeText: 'MONTHLY OPERATIVE',
      borderStyle: '1px solid var(--accent-cyan)',
      benefits: [
        'Everything in Basic Access',
        'Daily Accountability programme',
        '1-on-1 strategy & coaching sessions',
        'CV review & mock interview prep',
        'Private member channels & labs',
        'CompTIA exam discounts',
      ],
    },
    {
      rank: 3,
      name: 'Permanent Access',
      priceDisplay: 'R 1,000.00',
      period: '/ 6 months',
      amount: 1000,
      badgeClass: 'badge-success',
      badgeStyle: { background: 'rgba(192, 132, 252, 0.2)', color: 'var(--accent-purple)' },
      btnStyle: { background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' },
      badgeText: 'PERMANENT ACCESS',
      benefits: [
        'Everything in Monthly Operative',
        'Lifetime community access',
        'All future programme updates',
        'Priority support & coaching',
        'Founding member status & badge',
        'Free Azure exams (upon milestone completion)',
      ],
    },
    {
      rank: 4,
      name: 'Elite Operative',
      priceDisplay: 'Apply Only',
      period: '',
      amount: 0,
      badgeClass: 'badge-danger',
      badgeText: 'ELITE OPERATIVE',
      isApplyOnly: true,
      benefits: [
        'Everything in Permanent Access',
        'Fully Sponsored Certifications (OSCP/CompTIA)',
        'All course & training costs covered',
        '12-Month Job Placement Guarantee (or 100% refund)',
        'Direct founder 1on1 access',
      ],
    },
  ];

  // Current active plan state (Default: Rank 1 - Basic Access)
  const [currentPlanRank, setCurrentPlanRank] = useState(1);
  const currentPlan = ALL_TIERS.find(t => t.rank === currentPlanRank) || ALL_TIERS[0];
  const upgradeTiers = ALL_TIERS.filter(t => t.rank >= currentPlanRank);

  // Router for Member Dashboard
  switch (activeTab) {
    case 'members':
      return (
        <div>
          <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Members</h1>
              <p>Everyone else in the Hacking Hub community — see who's around and what they're working on.</p>
            </div>
            <button className="btn btn-primary" onClick={openEditProfile}>
              <Pencil size={16} /> Edit My Profile
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px 16px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', maxWidth: '360px', marginBottom: '24px' }}>
            <Search size={18} color="var(--text-muted)" style={{ marginTop: '2px' }} />
            <input
              type="text"
              placeholder="Search by name, specialty, or location..."
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.9rem', outline: 'none', width: '100%' }}
            />
          </div>

          {loadingDirectory && <p style={{ color: 'var(--text-muted)' }}>Loading members...</p>}
          {directoryError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{directoryError}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredDirectory.map((m) => (
              <div key={m.email} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                    {m.fullName || 'Unnamed member'}
                    {m.email === user?.email && <span style={{ color: 'var(--accent-cyan)', fontWeight: 500, fontSize: '0.8rem' }}> (You)</span>}
                  </h4>
                  {m.linkedin && (
                    <a href={m.linkedin} target="_blank" rel="noreferrer" title="LinkedIn Profile">
                      <Link size={16} color="var(--accent-cyan)" />
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{m.specialty}</span>
                  <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{m.jobReadiness}</span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: m.about ? 'normal' : 'italic', flexGrow: 1 }}>
                  {m.about || 'No bio yet.'}
                </p>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {m.location && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> {m.location}</span>
                  )}
                  {m.employmentStatus === 'Employed' && m.jobTitle && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building2 size={13} /> {m.jobTitle}</span>
                  )}
                  {m.employmentStatus && m.employmentStatus !== 'Not Set' && m.employmentStatus !== 'Employed' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building2 size={13} /> {m.employmentStatus}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!loadingDirectory && filteredDirectory.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No members match that search.</p>
          )}

          {editingProfile && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
              onClick={() => setEditingProfile(false)}
            >
              <div
                className="glass-card"
                style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>Edit My Profile</h2>
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Display Name</label>
                    <input type="text" className="form-input" value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>About</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="A short bio other members will see..."
                      value={profileForm.about}
                      onChange={(e) => setProfileForm({ ...profileForm, about: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Location</label>
                      <select className="form-input" value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}>
                        <option value="">Not set</option>
                        {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Specialty</label>
                      <select className="form-input" value={profileForm.specialty} onChange={(e) => setProfileForm({ ...profileForm, specialty: e.target.value })}>
                        {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>LinkedIn Profile</label>
                    <input type="url" className="form-input" placeholder="https://linkedin.com/in/..." value={profileForm.linkedin} onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Employment Status</label>
                      <select className="form-input" value={profileForm.employmentStatus} onChange={(e) => setProfileForm({ ...profileForm, employmentStatus: e.target.value })}>
                        {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {profileForm.employmentStatus === 'Employed' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Job Title</label>
                        <input type="text" className="form-input" placeholder="e.g. SOC Analyst" value={profileForm.jobTitle} onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })} />
                      </div>
                    )}
                  </div>

                  {directoryError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{directoryError}</p>}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Profile'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );

    case 'dashboard':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Welcome back, Sanele!</h1>
            <p>Here is your current cybersecurity progression overview.</p>
          </div>

          {/* TOP PANEL: Community Feed, Upcoming Events & Certification Victories */}
          <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
            {/* Upcoming Event Alert */}
            <div className="glass-card" style={{ border: '1px solid var(--accent-cyan)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>Upcoming Event</span>
                </div>
                <span className="badge badge-success">{upcomingEvent.rsvps} RSVPs</span>
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>{upcomingEvent.title}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {upcomingEvent.date} | <strong>{upcomingEvent.location}</strong>
              </p>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px' }}>
                RSVP for Event <Sparkles size={14} />
              </button>
            </div>

            {/* Community Intelligence & News Broadcast */}
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Megaphone size={18} color="var(--warning)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase' }}>Community Broadcast</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>📢 Sprint 4 Active:</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>TryHackMe challenge rooms open for monthly bounty.</span>
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>⚡ Azure Vouchers:</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>Submit completed TryHackMe path by Friday.</span>
                </div>
              </div>
            </div>

            {/* Certification Victories & Member Achievements Feed */}
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Award size={18} color="var(--accent-purple)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-purple)', textTransform: 'uppercase' }}>Recent Certification Victories</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {communityVictories.map((v) => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: v.avatarColor }}></div>
                      <strong style={{ color: 'var(--text-primary)' }}>{v.member}</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>earned {v.cert}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Roadmap & Task Checklist */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>OSCP Roadmap Checklist</h3>
                <span className="badge badge-success">{progressPercent}% Complete</span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '24px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))', borderRadius: '4px', transition: 'width 0.4s ease' }}></div>
              </div>

              {/* Task Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {tasks.map(t => (
                  <div
                    key={t.id}
                    onClick={() => toggleTask(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      borderRadius: 'var(--border-radius-md)',
                      background: t.completed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                      border: t.completed ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {t.completed ? (
                      <CheckSquare size={20} color="var(--success)" style={{ flexShrink: 0 }} />
                    ) : (
                      <Square size={20} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: '0.95rem',
                      textDecoration: t.completed ? 'line-through' : 'none',
                      color: t.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                      userSelect: 'none',
                    }}>
                      {t.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Side Widgets (1on1 + Payment) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Next 1on1 Card */}
              <div className="glass-card">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                  <Clock size={20} color="var(--accent-cyan)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Next 1on1 Session</h4>
                </div>
                <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>OSCP Exam Review</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Mentor: Jaco du Toit</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>Today at 14:00 (SAST)</div>
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <Video size={16} /> Join Google Meet
                </button>
              </div>

              {/* Next Payment Card */}
              <div className="glass-card">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                  <CreditCard size={20} color="var(--accent-purple)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Billing Info</h4>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subscription Plan:</span>
                  <strong>{currentPlan.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Next Payment Date:</span>
                  <strong>2026-09-01</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '16px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Monthly Fee:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{currentPlan.priceDisplay}</strong>
                </div>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
                  Manage Payments
                </button>
              </div>
            </div>
          </div>
        </div>
      );

    case 'meetings':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Book a 1on1 Strategy Session</h1>
            <p>Select your mentor to open their live Google Calendar and reserve your 1on1 coaching slot.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {MENTORS.map((m) => (
              <div
                key={m.id}
                className="glass-card"
                style={{
                  border: m.primary ? '1px solid var(--accent-cyan)' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span className={`badge ${m.badgeClass}`}>{m.badge}</span>
                    <span style={{ fontSize: '0.8rem', color: m.primary ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontWeight: m.primary ? 600 : 400 }}>
                      {m.sideNote}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    {!m.photo || mentorPhotoErrors[m.id] ? (
                      <div
                        style={{
                          width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                          background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <User size={22} color="var(--text-secondary)" />
                      </div>
                    ) : (
                      <img
                        src={m.photo}
                        alt={m.name}
                        onError={() => setMentorPhotoErrors((prev) => ({ ...prev, [m.id]: true }))}
                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-color)' }}
                      />
                    )}
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{m.name}</h3>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    {m.bio}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <a
                    href={MENTOR_CALENDAR_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={`btn ${m.primary ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Calendar size={16} /> {m.primary ? 'Book 1on1 on Google Calendar' : 'Schedule Slot'} <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'events':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Events</h1>
            <p>Everything happening across Hacking Hub — meetups, industry events, and casual catchups.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {['All', 'HH Meetup', 'Industry Event', 'Sunday Catchup'].map((type) => (
              <button
                key={type}
                onClick={() => setEventTypeFilter(type)}
                className={`btn ${eventTypeFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '8px 14px' }}
              >
                {type}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredEvents.map((e) => {
              const typeStyle = EVENT_TYPE_STYLES[e.type] || {};
              return (
                <div key={e.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge ${typeStyle.className || ''}`} style={typeStyle.style}>{e.type}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <Users size={13} /> {e.rsvps} RSVPs
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{e.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{e.description}</p>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      <CalendarDays size={14} /> {e.date} at {e.time} SAST
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <MapPin size={14} /> {e.location}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '4px' }}>
                    <Sparkles size={14} /> RSVP
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'jobs':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Job Board</h1>
            <p>Roles sourced from Hacking Hub's employer network and job placement partners.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {['All', 'Full-Time', 'Contract', 'Internship'].map((type) => (
              <button
                key={type}
                onClick={() => setJobTypeFilter(type)}
                className={`btn ${jobTypeFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '8px 14px' }}
              >
                {type}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredJobs.map((job) => (
              <div key={job.id} className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className={`badge ${JOB_TYPE_BADGE[job.type] || 'badge-success'}`}>{job.type}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Posted {job.posted}</span>
                    </div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{job.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      <Building2 size={14} /> {job.company}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                    <Briefcase size={14} /> Apply
                  </button>
                </div>

                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>{job.description}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> {job.location}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={13} /> {job.salary}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {job.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '9999px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'resources':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Library size={28} color="var(--accent-cyan)" /> Resources
            </h1>
            <p>Everything to help you pass certs, plan your career, and land the role — cert prep, role roadmaps, podcasts, books, interview playbooks, and CV templates.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {RESOURCE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setResourceCategoryFilter(cat)}
                className={`btn ${resourceCategoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '8px 14px' }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredResources.map((res) => {
              const Icon = RESOURCE_ICON[res.category] || FileText;
              return (
                <div key={res.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{res.category}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Icon size={13} /> {res.format}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{res.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flexGrow: 1 }}>{res.description}</p>
                  <button className="btn btn-secondary" style={{ justifyContent: 'center', fontSize: '0.85rem' }}>
                    <Download size={14} /> Open Resource
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'certs':
      const communityCerts = [
        { id: 1, member: 'Sanele Khumalo', cert: 'OSCP Penetration Tester', date: '2026-09-12', cohort: 'OSCP-26B' },
        { id: 2, member: '[REDACTED]', cert: 'CompTIA Security+', date: '2026-08-28', cohort: 'SecPlus-Aug' },
        { id: 3, member: 'Khody Netshifhefhe', cert: 'eLearnSecurity eCPPT', date: '2026-10-05', cohort: 'eCPPT-Intro' },
        { id: 4, member: 'Joshua Harrop', cert: 'Microsoft Azure Security (AZ-500)', date: '2026-09-01', cohort: 'Azure-Q3' },
        { id: 5, member: 'Thando Mandondo', cert: 'CompTIA Network+', date: '2026-09-20', cohort: 'NetPlus-Q3' },
      ];

      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Community Certification Calendar</h1>
            <p>Hacking Hub community-wide target exam dates, active cohorts, and member countdowns.</p>
          </div>

          <div className="glass-card" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Community Operatives Exam Countdown</h3>
              <span className="badge badge-success">{communityCerts.length} Active Targets</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {communityCerts.map((c) => {
                const targetDate = new Date(c.date);
                const today = new Date();
                const diffTime = targetDate - today;
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isUrgent = daysLeft <= 14;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCert(c)}
                    style={{
                      padding: '20px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'rgba(255,255,255,0.02)',
                      border: isUrgent ? '1px solid var(--warning)' : '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover-glow"
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{c.cohort}</span>
                        <span className={`badge ${daysLeft <= 7 ? 'badge-danger' : isUrgent ? 'badge-warning' : 'badge-success'}`}>
                          {daysLeft > 0 ? `${daysLeft} Days Remaining` : daysLeft === 0 ? 'Exam Day!' : 'Exam Passed'}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '4px' }}>{c.member}</h4>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {c.cert} <Info size={14} color="var(--accent-cyan)" />
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Target Exam Date:</span>
                      <strong style={{ color: 'var(--accent-cyan)' }}>{c.date}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Certification Details Breakdown Modal */}
          {selectedCert && (
            <CertDetailsModal
              certName={selectedCert.cert}
              memberName={selectedCert.member}
              cohort={selectedCert.cohort}
              date={selectedCert.date}
              onClose={() => setSelectedCert(null)}
            />
          )}
        </div>
      );

    case 'competitions':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Competitions</h1>
            <p>Our quarterly TryHackMe competition — standings and how to get involved.</p>
          </div>

          <div className="glass-card" style={{ marginBottom: '32px', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Trophy size={24} color="var(--accent-cyan)" />
                <div>
                  <h3 style={{ margin: 0 }}>{currentCompetition.title}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{currentCompetition.platform}</p>
                </div>
              </div>
              <span className="badge badge-success">{currentCompetition.status}</span>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {currentCompetition.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Runs</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentCompetition.startDate} – {currentCompetition.endDate}</div>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Prizes</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{currentCompetition.prize}</div>
              </div>
            </div>

            <button className="btn btn-primary" style={{ justifyContent: 'center' }}>
              <ExternalLink size={14} /> Join on TryHackMe
            </button>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Current Standings</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Updated weekly</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Rank</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Member</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Target size={13} /> Rooms Completed</span>
                  </th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {competitionLeaderboard.map((row) => (
                  <tr key={row.rank} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '14px 12px' }}>
                      {row.rank === 1 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                          <Trophy size={15} /> #1
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>#{row.rank}</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 12px', fontWeight: 600 }}>{row.member}</td>
                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)' }}>{row.rooms}</td>
                    <td style={{ padding: '14px 12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{row.points.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'reviews':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Star size={28} color="var(--accent-cyan)" /> Reviews & Feedback
            </h1>
            <p>Praise, criticism, recommendations — whatever's on your mind. Choose whether to share it with the community or keep it private to admins.</p>
          </div>

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '24px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
              You're using Mock Member — reviews here are local only and won't be saved. Sign in with Google to submit for real.
            </div>
          )}
          {!isMockSession && reviewsError && (
            <div style={{ padding: '12px 16px', marginBottom: '24px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
              {reviewsError}
            </div>
          )}

          <div className="glass-card" style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '20px' }}>Leave a Review</h3>
            <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Rating (optional)</label>
                  <select className="form-input" value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>
                    <option value="">No rating</option>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'star' : 'stars'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Category</label>
                  <select className="form-input" value={reviewForm.category} onChange={(e) => setReviewForm({ ...reviewForm, category: e.target.value })}>
                    {REVIEW_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Title (optional)</label>
                <input type="text" className="form-input" placeholder="Sum it up in a few words" value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Your feedback *</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="What's working, what isn't, what you'd like to see..."
                  value={reviewForm.body}
                  onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })}
                  style={{ resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Who can see this?</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setReviewForm({ ...reviewForm, visibility: 'Private' })}
                    className={`btn ${reviewForm.visibility === 'Private' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}
                  >
                    Private to admins only
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewForm({ ...reviewForm, visibility: 'Public' })}
                    className={`btn ${reviewForm.visibility === 'Public' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}
                  >
                    Share with the community
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={submittingReview || !reviewForm.body.trim()} style={{ justifyContent: 'center', marginTop: '4px' }}>
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>

          <h3 style={{ marginBottom: '16px' }}>
            {loadingReviews ? 'Loading reviews...' : `${reviews.length} Review${reviews.length === 1 ? '' : 's'} Visible to You`}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {reviews.map((r) => {
              const isOwn = user?.email && r.email?.toLowerCase() === user.email.toLowerCase();
              return (
                <div key={r.id} className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{r.category}</span>
                      <span
                        className={`badge ${r.visibility === 'Public' ? 'badge-success' : 'badge-warning'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {r.visibility === 'Public' ? 'Public' : 'Private'}
                      </span>
                      {r.rating && (
                        <span style={{ display: 'flex', gap: '2px' }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={13} fill={i < r.rating ? 'var(--warning)' : 'none'} color="var(--warning)" />
                          ))}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(r.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {r.title && <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>{r.title}</h4>}
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>{r.body}</p>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    {isOwn ? 'You' : r.memberName}
                  </div>
                </div>
              );
            })}
            {!loadingReviews && reviews.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No reviews yet — be the first to share your thoughts.
              </div>
            )}
          </div>
        </div>
      );

    case 'billing':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>My Subscription & Upgrades</h1>
            <p>View your active clearance level and upgrade options.</p>
          </div>

          {/* Current Active Plan Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px' }}>Current Active Clearance</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Plan Name</span>
                <strong>{currentPlan.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Rate</span>
                <strong>{currentPlan.priceDisplay} {currentPlan.period}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                <span className="badge badge-success">active</span>
              </div>

              {/* Developer Tier Selector */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Simulate Current Membership Level:
                </label>
                <select
                  value={currentPlanRank}
                  onChange={(e) => setCurrentPlanRank(Number(e.target.value))}
                  className="form-input"
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                >
                  {ALL_TIERS.map(t => (
                    <option key={t.rank} value={t.rank}>
                      Level {t.rank}: {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="glass-card">
              <h3 style={{ marginBottom: '16px' }}>PayFast Security Guarantee</h3>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldCheck size={28} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontWeight: 600 }}>100% Encrypted Payments</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Processed securely via PayFast SA</div>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Upgrades instantly unlock additional benefits upon PayFast ITN verification.
              </p>
            </div>
          </div>

          <h3 style={{ marginBottom: '20px' }}>Your Plan & Upgrade Options</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {upgradeTiers.map((tier) => {
              const isCurrent = tier.rank === currentPlanRank;
              return (
                <div
                  key={tier.rank}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: isCurrent ? '2px solid var(--accent-cyan)' : (tier.borderStyle || 'var(--glass-border)'),
                    position: 'relative',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className={`badge ${tier.badgeClass}`} style={tier.badgeStyle}>
                        {tier.badgeText}
                      </span>
                      {isCurrent && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>CURRENT PLAN</span>}
                    </div>

                    <h4 style={{ fontSize: '1.3rem', marginBottom: '4px', fontWeight: 700 }}>
                      {tier.priceDisplay} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{tier.period}</span>
                    </h4>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />

                    {/* Bulleted Benefits List */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Specific Tier Benefits:
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tier.benefits.map((b, idx) => (
                          <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            <ShieldCheck size={16} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    {isCurrent ? (
                      <button className="btn btn-secondary" disabled style={{ width: '100%', justifyContent: 'center', opacity: 0.7 }}>
                        Current Active Plan
                      </button>
                    ) : tier.isApplyOnly ? (
                      <a
                        href="https://calendar.app.google/VAt3wTxF53hmYw73A"
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, var(--danger), var(--accent-purple))' }}
                      >
                        Apply for Placement <ExternalLink size={14} />
                      </a>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', ...(tier.btnStyle || {}) }}
                        onClick={() => handlePayfastPay(tier.name, tier.amount)}
                      >
                        Upgrade to {tier.name} <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

    default:
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>My Cybersecurity Roadmap</h1>
            <p>Welcome back! Track your learning path, upcoming 1on1 sessions, and community events.</p>
          </div>
        </div>
      );
  }
}
