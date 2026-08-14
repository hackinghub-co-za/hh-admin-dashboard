import React, { useState, useEffect } from 'react';
import { createPayfastCheckoutUrl } from '../../lib/payfast';
import CertDetailsModal from '../../components/CertDetailsModal';
import { fetchReviews, submitReview } from '../../lib/reviewsData';
import { fetchMemberDirectory, updateMyDirectoryProfile, uploadHeadshot } from '../../lib/memberDirectoryData';
import { fetchEventRsvps, rsvpForEvent, unrsvpFromEvent, fetchCommunityEvents, createCommunityEvent } from '../../lib/eventsData';
import { fetchCertCalendar, addCertCalendarEntry } from '../../lib/certCalendarData';
import { fetchJobBoard, addJobListing } from '../../lib/jobBoardData';
import { fetchResources, addResource } from '../../lib/resourcesData';
import { fetchCompetitionStandings, rsvpForCompetition } from '../../lib/competitionData';
import { LOCATIONS, SPECIALTIES, EMPLOYMENT_STATUSES } from '../../lib/memberOptions';
import { formatDate } from '../../lib/dateFormat';
import { isSafeUrl } from '../../lib/safeUrl';
import { friendlyErrorMessage } from '../../lib/errorMessages';
import { fetchCalendarEvents, findNextMeetingWithOrganizer } from '../../lib/googleCalendar';
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
  CheckCircle2,
  CalendarCheck2,
  Code2,
  Globe,
  GraduationCap,
} from 'lucide-react';

const REVIEW_CATEGORIES = ['Praise', 'Criticism', 'Recommendation', 'Feature Request', 'General'];

const MOCK_REVIEWS = [
  {
    id: 'mock-1',
    email: 'nonhlanhla@example.com',
    memberName: 'Nonhlanhla Sindane',
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
    name: 'Siyambonga Gladile',
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

// Intentionally empty - the Members Directory under Mock Member now shows no
// fake demo entries (removed per request), just whatever the mock session
// itself adds via "Edit My Profile" (see handleSaveProfile below).
const MOCK_DIRECTORY = [];

// Confetti burst config for the "Yes I'm In" RSVP celebration - a fixed,
// deterministic spread (not random) so it looks the same lively burst every
// time rather than needing per-click randomization.
const CONFETTI_COLORS = ['#5ee37a', '#17a856', '#38bdf8', '#facc15', '#f472b6'];
const CONFETTI_PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  angle: Math.round((360 / 14) * i),
  distance: 50 + (i % 4) * 14,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: (i % 5) * 0.03,
}));

// Days between today and an event's `date` (YYYY-MM-DD) - parsed with an
// explicit local-midnight time so this can't drift a day off in timezones
// behind UTC the way `new Date('2026-08-23')` alone would.
function daysUntilEvent(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const eventDate = new Date(`${dateStr}T00:00:00`);
  return Math.round((eventDate - now) / (1000 * 60 * 60 * 24));
}

function formatEventCountdown(days) {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

// Events tab demo data for Mock Member (no real Supabase session to fetch
// community_events from). Real sessions fetch these from Supabase instead -
// see the useEffect below that populates the `communityEvents` state.
const MOCK_EVENTS = [
  { id: 1, type: 'HH Meetup', title: 'Cyber War Games: Capture The Flag', date: '2026-08-16', time: '18:00', location: 'HH Discord & Hybrid JHB', description: 'Team-based CTF night with prizes for the top 3 teams.', link: '', status: 'Approved' },
  { id: 2, type: 'Sunday Catchup', title: 'Sunday Coffee & Code Catchup', date: '2026-08-17', time: '10:00', location: 'Google Meet', description: 'Casual weekly hangout — share wins, ask questions, no agenda.', link: '', status: 'Approved' },
  { id: 7, type: 'Sunday Catchup', title: 'HH S4 Kickoff', date: '2026-08-23', time: '17:00', location: 'Google Meet', description: 'Kicking off Season 4 — what\'s new this quarter, the TryHackMe competition, and a chance to meet the rest of the community.', link: 'https://meet.google.com/pce-rcrd-xmk', status: 'Approved' },
  { id: 3, type: 'HH Meetup', title: 'OSINT Fundamentals Workshop', date: '2026-08-23', time: '17:30', location: 'Online (Zoom)', description: 'Hands-on open-source recon workshop led by Jaco.', link: '', status: 'Approved' },
  { id: 5, type: 'Sunday Catchup', title: 'Sunday Coffee & Code Catchup', date: '2026-08-24', time: '10:00', location: 'Google Meet', description: 'Casual weekly hangout — share wins, ask questions, no agenda.', link: '', status: 'Approved' },
  { id: 4, type: 'Industry Event', title: 'ITWeb Security Summit 2026', date: '2026-08-25', time: '08:00', location: 'Sandton Convention Centre', description: 'Industry conference — HH is attending as a group, ask in the community for details.', link: '', status: 'Approved' },
  { id: 6, type: 'Industry Event', title: 'BSides Cape Town', date: '2026-09-05', time: '09:00', location: 'Cape Town', description: 'Community-run infosec conference — group discount code shared in the community.', link: '', status: 'Approved' },
];

const MOCK_CERT_CALENDAR = [
  { id: 1, member: 'Sanele Khumalo', cert: 'OSCP Penetration Tester', date: '2026-09-12', cohort: 'OSCP-26B', result: 'Pending' },
  { id: 2, member: 'Nonhlanhla Sindane', cert: 'CompTIA Security+', date: '2026-08-28', cohort: 'SecPlus-Aug', result: 'Pending' },
  { id: 3, member: 'Khody Netshifhefhe', cert: 'eLearnSecurity eCPPT', date: '2026-10-05', cohort: 'eCPPT-Intro', result: 'Pending' },
  { id: 4, member: 'Joshua Harrop', cert: 'Microsoft Azure Security (AZ-500)', date: '2026-09-01', cohort: 'Azure-Q3', result: 'Pending' },
  { id: 5, member: 'Thando Mandondo', cert: 'CompTIA Network+', date: '2026-09-20', cohort: 'NetPlus-Q3', result: 'Pending' },
  { id: 8, member: 'Siya', cert: 'KCSA (Kubernetes and Cloud Native Security Associate)', date: '2026-09-17', cohort: 'General', result: 'Pending' },
  { id: 9, member: 'Siya', cert: 'Microsoft Security Operations Analyst (SC-500)', date: '2026-08-20', cohort: 'General', result: 'Pending' },
];

const MOCK_JOB_BOARD = [
  { id: 1, title: 'SOC Analyst (Junior)', company: 'Nclose', location: 'Johannesburg (Hybrid)', type: 'Full-Time', posted: '2026-08-01', salary: 'R18,000 – R25,000 / month', description: 'Entry-level SOC role monitoring alerts, triaging incidents, and escalating to senior analysts. Great fit for members who\'ve completed Security+.', tags: ['Blue Team', 'Security+', 'Entry Level'], link: '' },
  { id: 2, title: 'Junior Penetration Tester', company: 'Telspace Systems', location: 'Cape Town (Onsite)', type: 'Full-Time', posted: '2026-07-28', salary: 'R22,000 – R30,000 / month', description: 'Assist senior consultants on web and network penetration tests. OSCP in progress or completed strongly preferred.', tags: ['Red Team', 'OSCP', 'Junior'], link: '' },
  { id: 3, title: 'GRC Analyst Intern', company: 'Standard Bank', location: 'Johannesburg (Onsite)', type: 'Internship', posted: '2026-08-05', salary: 'R8,000 / month stipend', description: '6-month internship supporting risk assessments and compliance documentation within the group security office.', tags: ['GRC', 'Internship'], link: '' },
  { id: 4, title: 'Cloud Security Engineer', company: 'Entelect', location: 'Remote (SA)', type: 'Full-Time', posted: '2026-07-20', salary: 'R45,000 – R60,000 / month', description: 'Own security posture for AWS and Azure workloads. AZ-500 or equivalent cloud security cert required.', tags: ['Cloud Security', 'AZ-500', 'Mid-Level'], link: '' },
  { id: 5, title: 'Vulnerability Assessment Contractor', company: 'Private Client (via HH Network)', location: 'Remote', type: 'Contract', posted: '2026-08-06', salary: 'Project-based', description: 'Short-term engagement running external vulnerability scans and reporting for a mid-size fintech. Referred through the Hacking Hub network.', tags: ['Red Team', 'Contract'], link: '' },
];

const MOCK_RESOURCES = [
  { id: 1, category: 'Cert Prep', title: 'Cisco Junior Cybersecurity Analyst Career Path', format: 'Course', description: 'Free Cisco Networking Academy course covering cybersecurity operations fundamentals, from networking basics through to SOC-analyst-level skills.', link: 'https://www.netacad.com/career-paths/cybersecurity?courseLang=en-US' },
  { id: 2, category: 'Cert Prep', title: 'Immersive Labs — Cyber Million', format: 'Course', description: 'Free, hands-on cybersecurity skills platform for building foundational, job-ready skills through guided labs.', link: 'https://www.immersivelabs.com/resources/cybermillion' },
];

const MOCK_LEADERBOARD = [
  { email: 'khody@example.com', member: 'Khody Netshifhefhe', rooms: 12, daysLogged: 19 },
  { email: 'nonhlanhla@example.com', member: 'Nonhlanhla Sindane', rooms: 9, daysLogged: 15 },
  { email: 'joshua@example.com', member: 'Joshua Harrop', rooms: 8, daysLogged: 13 },
  { email: 'thabo@example.com', member: 'Thabo Ndlovu', rooms: 7, daysLogged: 11 },
  { email: 'lindokuhle@example.com', member: 'Lindokuhle Dube', rooms: 5, daysLogged: 8 },
];

// Dashboard "Community Broadcast" feed - only one shows at a time, auto-rotating
// (see broadcastIndex state below), rather than all listed at once.
const COMMUNITY_BROADCASTS = [
  { emoji: '📢', title: 'Sprint 4 Active:', body: 'TryHackMe challenge rooms open for monthly bounty.' },
  { emoji: '⚡', title: 'Azure Vouchers:', body: 'Submit completed TryHackMe path by Friday.' },
];

// Mock Community News & Certification Victories Data. linkedinUrl is a
// LinkedIn search for the member + cert, not a specific post - there's no real
// per-achievement post link to wire up yet, and a search at least goes
// somewhere genuinely relevant rather than a fabricated post URL.
const communityVictories = [
  { id: 1, member: 'Philisiwe N.', cert: 'SC-900: Security, Compliance & Identity Fundamentals', date: 'Today', avatarColor: 'var(--accent-purple)', linkedinUrl: 'https://www.linkedin.com/posts/philisiwe-ncube-258263360_sc900-microsoftcertified-cybersecurity-activity-7494082635091251201-xzT6' },
  { id: 2, member: 'Joshua H.', cert: 'SOC Analyst Deployment', date: '3 days ago', avatarColor: 'var(--success)', linkedinUrl: 'https://www.linkedin.com/search/results/content/?keywords=Joshua%20SOC%20Analyst' },
];

const SIYA_EMAIL = 'siya@hackinghub.co.za';

export default function MemberPortal({ activeTab, setActiveTab, user, providerToken, isMockSession, autoOpenProfileEdit }) {
  const [selectedCert, setSelectedCert] = useState(null);
  const firstName = (user?.user_metadata?.full_name || user?.email || 'there').trim().split(' ')[0];

  // Community Broadcast auto-rotates through COMMUNITY_BROADCASTS one at a time
  // rather than listing every update at once.
  const [broadcastIndex, setBroadcastIndex] = useState(0);
  useEffect(() => {
    if (COMMUNITY_BROADCASTS.length <= 1) return;
    const interval = setInterval(() => {
      setBroadcastIndex((i) => (i + 1) % COMMUNITY_BROADCASTS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  // Tracks which mentor photos have failed to load (e.g. not uploaded to
  // public/mentors/ yet) so those cards fall back to a plain avatar icon.
  const [mentorPhotoErrors, setMentorPhotoErrors] = useState({});

  // Next 1on1 Session (Dashboard widget) - the member's own next calendar
  // event organized by siya@hackinghub.co.za, read from the member's own
  // Google Calendar (they show up there too, as an invited attendee, once
  // siya books/creates the session). Mock Member has no real Google session
  // to read a calendar from, so it stays empty there - the widget already
  // degrades to "Book a 1on1 Meeting" in that case, same as a real member
  // with nothing booked in the next 30 days. providerToken can be missing
  // even for a real session (Supabase only returns it right after the OAuth
  // redirect, not on session restore/refresh) - checked directly at render
  // time rather than folded into the loading flag, same pattern already
  // used for the admin's own Google Calendar sync in AdminDashboard.jsx.
  const [nextOneOnOne, setNextOneOnOne] = useState(null);
  const [loadingOneOnOne, setLoadingOneOnOne] = useState(!isMockSession);
  const [oneOnOneError, setOneOnOneError] = useState(null);

  useEffect(() => {
    if (isMockSession || !providerToken) return;
    let cancelled = false;
    fetchCalendarEvents(providerToken, { maxResults: 50 })
      .then((events) => {
        if (cancelled) return;
        setNextOneOnOne(findNextMeetingWithOrganizer(events, SIYA_EMAIL, 30));
      })
      .catch((err) => !cancelled && setOneOnOneError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingOneOnOne(false));
    return () => { cancelled = true; };
  }, [isMockSession, providerToken]);

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
      .catch((err) => !cancelled && setReviewsError(friendlyErrorMessage(err)))
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
      setReviewsError(friendlyErrorMessage(err));
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
  // Full breakdown shown when a member clicks another member's directory card.
  const [selectedDirectoryMember, setSelectedDirectoryMember] = useState(null);
  // Starts pre-opened when routed here straight from onboarding's "Set Up My
  // Profile" choice (App.jsx) - MemberPortal only ever mounts fresh at that
  // exact moment (onboarding renders a separate component tree entirely), so
  // reading the flag once at mount via this initializer is enough; no effect
  // needed to react to it changing later.
  const [editingProfile, setEditingProfile] = useState(!!autoOpenProfileEdit);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [headshotError, setHeadshotError] = useState(null);
  const emptyProfileForm = {
    fullName: user?.user_metadata?.full_name || '',
    about: '',
    location: '',
    linkedin: '',
    tryhackmeUsername: '',
    headshotUrl: '',
    githubUrl: '',
    tiktokUrl: '',
    websiteUrl: '',
    yearsExperience: '',
    certifications: '',
    funFact: '',
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
      .catch((err) => !cancelled && setDirectoryError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingDirectory(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const myDirectoryEntry = directory.find((m) => m.email === user?.email);

  const openEditProfile = () => {
    setProfileForm(myDirectoryEntry ? { ...emptyProfileForm, ...myDirectoryEntry } : emptyProfileForm);
    setEditingProfile(true);
  };

  const handleHeadshotChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setHeadshotError(null);

    if (isMockSession) {
      // No real Storage session to upload to - just preview locally, matching
      // how every other mock-gated feature in this app degrades.
      setProfileForm((prev) => ({ ...prev, headshotUrl: URL.createObjectURL(file) }));
      return;
    }

    setUploadingHeadshot(true);
    try {
      const url = await uploadHeadshot(user.email, file);
      setProfileForm((prev) => ({ ...prev, headshotUrl: url }));
    } catch (err) {
      setHeadshotError(friendlyErrorMessage(err));
    } finally {
      setUploadingHeadshot(false);
    }
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
      setDirectoryError(friendlyErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const filteredDirectory = directory.filter((m) => {
    if (!m.fullName.trim()) return false; // hide unnamed profiles, same as get_member_directory()
    const q = directorySearch.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.specialty.toLowerCase().includes(q) ||
      m.location.toLowerCase().includes(q)
    );
  });

  // Mock roadmap tasks
  const tasks = [
    { id: 1, text: 'Complete PortSwigger Web Security Academy: Directory Traversal', completed: true },
    { id: 2, text: 'Submit write-up for HackTheBox: "Internal" machine', completed: false },
    { id: 3, text: 'Review Windows Active Directory privilege escalation notes', completed: false },
    { id: 4, text: 'Schedule mock OSCP exam run with Jaco (Mentor)', completed: false },
  ];

  // Recent Certification Victories auto-rotates through communityVictories one
  // at a time (same "single visible tile, moving feed" pattern as the
  // Community Broadcast card above), on its own independent 5s timer.
  const [victoryIndex, setVictoryIndex] = useState(0);
  useEffect(() => {
    if (communityVictories.length <= 1) return;
    const interval = setInterval(() => {
      setVictoryIndex((i) => (i + 1) % communityVictories.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const upcomingEvent = {
    title: 'HH S4 Kickoff',
    date: 'Sunday, 23 - August - 2026 · 5:00 – 7:00pm SAST',
    location: 'Google Meet',
    meetLink: 'https://meet.google.com/pce-rcrd-xmk',
    rsvps: 42,
  };

  // All upcoming events members can attend, across every category
  const [eventTypeFilter, setEventTypeFilter] = useState('All');
  // Event RSVPs - real Supabase data for a real session (RLS scopes reads to
  // signed-in, approved members), local-only demo state under Mock Member
  // since there's no real session to persist an RSVP against. Real attendance
  // counts start at 0 per event and only grow as real members RSVP - no fake
  // baseline blended in, same principle as the Competitions leaderboard.
  const [eventRsvps, setEventRsvps] = useState([]);
  const [loadingEventRsvps, setLoadingEventRsvps] = useState(!isMockSession);
  const [eventRsvpError, setEventRsvpError] = useState(null);
  const [mockRsvpedEventIds, setMockRsvpedEventIds] = useState(new Set());
  const [rsvpingEventId, setRsvpingEventId] = useState(null);
  const [burstingEventId, setBurstingEventId] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchEventRsvps()
      .then((data) => !cancelled && setEventRsvps(data))
      .catch((err) => !cancelled && setEventRsvpError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingEventRsvps(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const hasRsvpedToEvent = (eventId) =>
    isMockSession
      ? mockRsvpedEventIds.has(eventId)
      : eventRsvps.some((r) => r.event_id === eventId && r.email === user?.email);

  const rsvpCountForEvent = (event) => {
    if (isMockSession) return mockRsvpedEventIds.has(event.id) ? 1 : 0;
    if (loadingEventRsvps) return null;
    return eventRsvps.filter((r) => r.event_id === event.id).length;
  };

  // Toggles: RSVPs if the member hasn't said yes yet, un-RSVPs (removing them
  // from attendance) if they click "You're There" again having already said yes.
  const handleEventRsvp = async (eventId) => {
    const alreadyRsvped = hasRsvpedToEvent(eventId);

    if (!alreadyRsvped) {
      setBurstingEventId(eventId);
      setTimeout(() => setBurstingEventId((id) => (id === eventId ? null : id)), 1000);
    }

    if (isMockSession) {
      setMockRsvpedEventIds((prev) => {
        const next = new Set(prev);
        if (alreadyRsvped) next.delete(eventId);
        else next.add(eventId);
        return next;
      });
      return;
    }

    setRsvpingEventId(eventId);
    setEventRsvpError(null);
    try {
      if (alreadyRsvped) await unrsvpFromEvent(eventId);
      else await rsvpForEvent(eventId);
      setEventRsvps(await fetchEventRsvps());
    } catch (err) {
      setEventRsvpError(friendlyErrorMessage(err));
    } finally {
      setRsvpingEventId(null);
    }
  };
  // Community events - real Supabase data for a real session (RLS scopes
  // reads to signed-in, approved members), local-only demo events under Mock
  // Member since there's no real session to fetch from. Members can also add
  // their own event (case 'events' render below - "Add Event" form) - those
  // persist for everyone, not just the member who created it.
  const [communityEvents, setCommunityEvents] = useState(isMockSession ? MOCK_EVENTS : []);
  const [loadingEvents, setLoadingEvents] = useState(!isMockSession);
  const [eventsError, setEventsError] = useState(null);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [addEventError, setAddEventError] = useState(null);
  const [newEventForm, setNewEventForm] = useState({
    title: '', type: 'HH Meetup', date: '', time: '', location: '', link: '', description: '',
  });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchCommunityEvents()
      .then((data) => !cancelled && setCommunityEvents(data))
      .catch((err) => !cancelled && setEventsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingEvents(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEventForm.title.trim() || !newEventForm.date) return;
    setAddingEvent(true);
    setAddEventError(null);
    try {
      if (isMockSession) {
        const mockEvent = {
          id: Math.max(0, ...communityEvents.map((ev) => ev.id)) + 1,
          type: newEventForm.type,
          title: newEventForm.title.trim(),
          description: newEventForm.description.trim(),
          date: newEventForm.date,
          time: newEventForm.time,
          location: newEventForm.location.trim(),
          link: newEventForm.link.trim(),
          createdBy: user?.email || 'you',
          status: 'Pending',
        };
        setCommunityEvents((prev) => [...prev, mockEvent].sort((a, b) => new Date(a.date) - new Date(b.date)));
      } else {
        await createCommunityEvent({
          type: newEventForm.type,
          title: newEventForm.title.trim(),
          description: newEventForm.description.trim(),
          date: newEventForm.date,
          time: newEventForm.time,
          location: newEventForm.location.trim(),
          link: newEventForm.link.trim(),
          createdBy: user?.email,
        });
        setCommunityEvents(await fetchCommunityEvents());
      }
      setNewEventForm({ title: '', type: 'HH Meetup', date: '', time: '', location: '', link: '', description: '' });
      setShowAddEventForm(false);
    } catch (err) {
      setAddEventError(friendlyErrorMessage(err));
    } finally {
      setAddingEvent(false);
    }
  };

  const EVENT_TYPE_STYLES = {
    'HH Meetup': { className: 'badge-success' },
    'Industry Event': { className: 'badge-warning' },
    'Sunday Catchup': { style: { background: 'rgba(192, 132, 252, 0.15)', color: 'var(--accent-purple)', border: '1px solid rgba(192, 132, 252, 0.25)' } },
  };

  const filteredEvents = eventTypeFilter === 'All'
    ? communityEvents
    : communityEvents.filter(e => e.type === eventTypeFilter);

  // Cert Calendar - real Supabase data for a real session (RLS scopes reads
  // to signed-in, approved members), local-only demo entries under Mock
  // Member since there's no real session to fetch from. Members can add their
  // own target exam date via the "Add to Cert Calendar" form below - those
  // persist for everyone, not just the member who added them.
  const [certCalendar, setCertCalendar] = useState(isMockSession ? MOCK_CERT_CALENDAR : []);
  const [loadingCertCalendar, setLoadingCertCalendar] = useState(!isMockSession);
  const [certCalendarError, setCertCalendarError] = useState(null);
  const [showAddCertForm, setShowAddCertForm] = useState(false);
  const [addingCert, setAddingCert] = useState(false);
  const [addCertError, setAddCertError] = useState(null);
  const [newCertForm, setNewCertForm] = useState({ member: '', cert: '', date: '', cohort: '' });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchCertCalendar()
      .then((data) => !cancelled && setCertCalendar(data))
      .catch((err) => !cancelled && setCertCalendarError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingCertCalendar(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const handleAddCertEntry = async (e) => {
    e.preventDefault();
    if (!newCertForm.member.trim() || !newCertForm.cert.trim() || !newCertForm.date) return;
    setAddingCert(true);
    setAddCertError(null);
    try {
      if (isMockSession) {
        const mockEntry = {
          id: Math.max(0, ...certCalendar.map((c) => c.id)) + 1,
          member: newCertForm.member.trim(),
          cert: newCertForm.cert.trim(),
          date: newCertForm.date,
          cohort: newCertForm.cohort.trim() || 'General',
          result: 'Pending',
          createdBy: user?.email || 'you',
        };
        setCertCalendar((prev) => [...prev, mockEntry].sort((a, b) => new Date(a.date) - new Date(b.date)));
      } else {
        await addCertCalendarEntry({
          member: newCertForm.member.trim(),
          cert: newCertForm.cert.trim(),
          date: newCertForm.date,
          cohort: newCertForm.cohort.trim(),
          createdBy: user?.email,
        });
        setCertCalendar(await fetchCertCalendar());
      }
      setNewCertForm({ member: '', cert: '', date: '', cohort: '' });
      setShowAddCertForm(false);
    } catch (err) {
      setAddCertError(friendlyErrorMessage(err));
    } finally {
      setAddingCert(false);
    }
  };

  // Quarterly TryHackMe competition - real Supabase data for a real session
  // (RLS scopes reads to signed-in, approved members), local mock leaderboard
  // under Mock Member since there's no real session to persist an RSVP against.
  const [competitionLeaderboard, setCompetitionLeaderboard] = useState(isMockSession ? MOCK_LEADERBOARD : []);
  const [loadingStandings, setLoadingStandings] = useState(!isMockSession);
  const [standingsError, setStandingsError] = useState(null);
  const [rsvpingCompetition, setRsvpingCompetition] = useState(false);
  // Drives the one-off confetti burst + leaderboard row highlight right when the
  // member RSVPs - deliberately keyed off "just did it this session" rather than
  // just "is my row present", so reloading the page later (row already exists
  // from a prior session) doesn't replay the animation every time.
  const [showRsvpConfetti, setShowRsvpConfetti] = useState(false);
  const [justRsvpedEmail, setJustRsvpedEmail] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchCompetitionStandings()
      .then((data) => !cancelled && setCompetitionLeaderboard(data))
      .catch((err) => !cancelled && setStandingsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingStandings(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const hasRsvpedForCompetition = competitionLeaderboard.some((row) => row.email === user?.email);

  const celebrateRsvp = () => {
    setJustRsvpedEmail(user?.email);
    setShowRsvpConfetti(true);
    setTimeout(() => setShowRsvpConfetti(false), 1000);
  };

  const handleCompetitionRsvp = async () => {
    const displayName = user?.user_metadata?.full_name || user?.email || 'You';
    if (isMockSession) {
      setCompetitionLeaderboard((prev) =>
        prev.some((row) => row.email === user?.email)
          ? prev
          : [...prev, { email: user?.email, member: displayName, rooms: 0, daysLogged: 0 }]
      );
      celebrateRsvp();
      return;
    }
    setRsvpingCompetition(true);
    setStandingsError(null);
    try {
      await rsvpForCompetition(displayName);
      setCompetitionLeaderboard(await fetchCompetitionStandings());
      celebrateRsvp();
    } catch (err) {
      setStandingsError(friendlyErrorMessage(err));
    } finally {
      setRsvpingCompetition(false);
    }
  };

  const currentCompetition = {
    title: 'Q3 2026 Community CTF Sprint',
    platform: 'TryHackMe',
    startDate: '2026-08-24',
    endDate: '2026-10-16', // last Friday of the ~8-week run
    description: 'Complete as many rooms as you can in the HH TryHackMe team space this quarter. Standings are ranked by days logged — top 3 finishers win prizes.',
    prizes: [
      { place: '1st', reward: 'Any certification voucher, up to R10,000' },
      { place: '2nd', reward: 'Any certification voucher, up to R5,000' },
      { place: '3rd', reward: 'Any certification voucher, up to R2,000' },
    ],
  };

  // Status and kickoff countdown are derived from today's date rather than
  // hardcoded, so they can't drift out of sync with the actual competition dates.
  const competitionNow = new Date();
  const competitionStartDate = new Date(currentCompetition.startDate);
  const competitionEndDate = new Date(currentCompetition.endDate);
  const daysUntilCompetition = Math.ceil((competitionStartDate - competitionNow) / (1000 * 60 * 60 * 24));
  const competitionStatus = daysUntilCompetition > 0 ? 'Upcoming' : competitionNow <= competitionEndDate ? 'Active' : 'Ended';
  const competitionStatusBadgeClass = competitionStatus === 'Active' ? 'badge-success' : competitionStatus === 'Upcoming' ? 'badge-warning' : 'badge-danger';

  // Job Board — real Supabase data for a real session (RLS scopes reads to
  // signed-in, approved members), local-only demo listings under Mock Member
  // since there's no real session to fetch from. Members can add their own
  // listing via the "Add Job" form below - those persist for everyone.
  const [jobTypeFilter, setJobTypeFilter] = useState('All');
  const [jobListings, setJobListings] = useState(isMockSession ? MOCK_JOB_BOARD : []);
  const [loadingJobs, setLoadingJobs] = useState(!isMockSession);
  const [jobsError, setJobsError] = useState(null);
  const [showAddJobForm, setShowAddJobForm] = useState(false);
  const [addingJob, setAddingJob] = useState(false);
  const [addJobError, setAddJobError] = useState(null);
  const [newJobForm, setNewJobForm] = useState({
    title: '', company: '', location: '', type: 'Full-Time', salary: '', description: '', tags: '', link: '',
  });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchJobBoard()
      .then((data) => !cancelled && setJobListings(data))
      .catch((err) => !cancelled && setJobsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingJobs(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const handleAddJob = async (e) => {
    e.preventDefault();
    if (!newJobForm.title.trim() || !newJobForm.company.trim()) return;
    setAddingJob(true);
    setAddJobError(null);
    const tagList = newJobForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      if (isMockSession) {
        const mockJob = {
          id: Math.max(0, ...jobListings.map((j) => j.id)) + 1,
          title: newJobForm.title.trim(),
          company: newJobForm.company.trim(),
          location: newJobForm.location.trim(),
          type: newJobForm.type,
          salary: newJobForm.salary.trim(),
          description: newJobForm.description.trim(),
          tags: tagList,
          link: newJobForm.link.trim(),
          posted: new Date().toISOString().slice(0, 10),
        };
        setJobListings((prev) => [mockJob, ...prev]);
      } else {
        await addJobListing({
          title: newJobForm.title.trim(),
          company: newJobForm.company.trim(),
          location: newJobForm.location.trim(),
          type: newJobForm.type,
          salary: newJobForm.salary.trim(),
          description: newJobForm.description.trim(),
          tags: tagList,
          link: newJobForm.link.trim(),
          createdBy: user?.email,
        });
        setJobListings(await fetchJobBoard());
      }
      setNewJobForm({ title: '', company: '', location: '', type: 'Full-Time', salary: '', description: '', tags: '', link: '' });
      setShowAddJobForm(false);
    } catch (err) {
      setAddJobError(friendlyErrorMessage(err));
    } finally {
      setAddingJob(false);
    }
  };

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

  // Real Supabase data for a real session (RLS scopes reads to signed-in,
  // approved members), local-only demo resources under Mock Member since
  // there's no real session to fetch from. Members can add their own via the
  // "Add Resource" form below - those persist for everyone.
  const [resources, setResources] = useState(isMockSession ? MOCK_RESOURCES : []);
  const [loadingResources, setLoadingResources] = useState(!isMockSession);
  const [resourcesError, setResourcesError] = useState(null);
  const [showAddResourceForm, setShowAddResourceForm] = useState(false);
  const [addingResource, setAddingResource] = useState(false);
  const [addResourceError, setAddResourceError] = useState(null);
  const [newResourceForm, setNewResourceForm] = useState({
    category: 'Cert Prep', title: '', format: '', description: '', link: '',
  });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchResources()
      .then((data) => !cancelled && setResources(data))
      .catch((err) => !cancelled && setResourcesError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingResources(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!newResourceForm.title.trim() || !newResourceForm.link.trim()) return;
    setAddingResource(true);
    setAddResourceError(null);
    try {
      if (isMockSession) {
        const mockResource = {
          id: Math.max(0, ...resources.map((r) => r.id)) + 1,
          category: newResourceForm.category,
          title: newResourceForm.title.trim(),
          format: newResourceForm.format.trim(),
          description: newResourceForm.description.trim(),
          link: newResourceForm.link.trim(),
        };
        setResources((prev) => [mockResource, ...prev]);
      } else {
        await addResource({
          category: newResourceForm.category,
          title: newResourceForm.title.trim(),
          format: newResourceForm.format.trim(),
          description: newResourceForm.description.trim(),
          link: newResourceForm.link.trim(),
          createdBy: user?.email,
        });
        setResources(await fetchResources());
      }
      setNewResourceForm({ category: 'Cert Prep', title: '', format: '', description: '', link: '' });
      setShowAddResourceForm(false);
    } catch (err) {
      setAddResourceError(friendlyErrorMessage(err));
    } finally {
      setAddingResource(false);
    }
  };

  const filteredResources = resourceCategoryFilter === 'All'
    ? resources
    : resources.filter(r => r.category === resourceCategoryFilter);

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

  // Current active plan (Default: Rank 1 - Basic Access)
  const currentPlanRank = 1;
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
              <div
                key={m.email}
                className="glass-card hover-glow"
                style={{ display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer' }}
                onClick={() => setSelectedDirectoryMember(m)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.headshotUrl ? (
                        <img src={m.headshotUrl} alt={m.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={17} color="var(--text-secondary)" />
                      )}
                    </div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      {m.fullName || 'Unnamed member'}
                      {m.email === user?.email && <span style={{ color: 'var(--accent-cyan)', fontWeight: 500, fontSize: '0.8rem' }}> (You)</span>}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    {m.tryhackmeUsername && (
                      <a
                        href={`https://tryhackme.com/p/${encodeURIComponent(m.tryhackmeUsername)}`}
                        target="_blank"
                        rel="noreferrer"
                        title={`TryHackMe: ${m.tryhackmeUsername}`}
                      >
                        <Target size={16} color="var(--accent-cyan)" />
                      </a>
                    )}
                    {isSafeUrl(m.linkedin) && (
                      <a href={m.linkedin} target="_blank" rel="noreferrer" title="LinkedIn Profile">
                        <Link size={16} color="var(--accent-cyan)" />
                      </a>
                    )}
                    {isSafeUrl(m.githubUrl) && (
                      <a href={m.githubUrl} target="_blank" rel="noreferrer" title="GitHub Profile">
                        <Code2 size={16} color="var(--accent-cyan)" />
                      </a>
                    )}
                    {isSafeUrl(m.tiktokUrl) && (
                      <a href={m.tiktokUrl} target="_blank" rel="noreferrer" title="TikTok Profile">
                        <Video size={16} color="var(--accent-cyan)" />
                      </a>
                    )}
                    {isSafeUrl(m.websiteUrl) && (
                      <a href={m.websiteUrl} target="_blank" rel="noreferrer" title="Personal Website">
                        <Globe size={16} color="var(--accent-cyan)" />
                      </a>
                    )}
                  </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {profileForm.headshotUrl ? (
                        <img src={profileForm.headshotUrl} alt="Your headshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={26} color="var(--text-secondary)" />
                      )}
                    </div>
                    <div>
                      <label
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '8px 14px', cursor: uploadingHeadshot ? 'default' : 'pointer', opacity: uploadingHeadshot ? 0.7 : 1, display: 'inline-flex' }}
                      >
                        <Pencil size={13} /> {uploadingHeadshot ? 'Uploading...' : profileForm.headshotUrl ? 'Change Headshot' : 'Add Headshot'}
                        <input type="file" accept="image/*" onChange={handleHeadshotChange} disabled={uploadingHeadshot} style={{ display: 'none' }} />
                      </label>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>Optional. JPG, PNG, WEBP or GIF, up to 5MB.</p>
                      {headshotError && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '4px' }}>{headshotError}</p>}
                    </div>
                  </div>

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

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <Target size={13} /> TryHackMe Username
                    </label>
                    <input type="text" className="form-input" placeholder="e.g. yourusername" value={profileForm.tryhackmeUsername} onChange={(e) => setProfileForm({ ...profileForm, tryhackmeUsername: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <Code2 size={13} /> GitHub Profile
                    </label>
                    <input type="url" className="form-input" placeholder="https://github.com/..." value={profileForm.githubUrl} onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <Video size={13} /> TikTok Profile
                    </label>
                    <input type="url" className="form-input" placeholder="https://tiktok.com/@..." value={profileForm.tiktokUrl} onChange={(e) => setProfileForm({ ...profileForm, tiktokUrl: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <Globe size={13} /> Personal Website
                    </label>
                    <input type="url" className="form-input" placeholder="https://..." value={profileForm.websiteUrl} onChange={(e) => setProfileForm({ ...profileForm, websiteUrl: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <Briefcase size={13} /> Years of Working Experience
                    </label>
                    <input type="number" min="0" max="60" className="form-input" placeholder="e.g. 3" value={profileForm.yearsExperience} onChange={(e) => setProfileForm({ ...profileForm, yearsExperience: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <Award size={13} /> Certifications
                    </label>
                    <input type="text" className="form-input" placeholder="e.g. OSCP, CompTIA Security+" value={profileForm.certifications} onChange={(e) => setProfileForm({ ...profileForm, certifications: e.target.value })} />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      <Sparkles size={13} /> A Fun Fact About You
                    </label>
                    <input type="text" className="form-input" placeholder="Something interesting other members might enjoy" value={profileForm.funFact} onChange={(e) => setProfileForm({ ...profileForm, funFact: e.target.value })} />
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

          {selectedDirectoryMember && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
              onClick={() => setSelectedDirectoryMember(null)}
            >
              <div
                className="glass-card"
                style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedDirectoryMember.headshotUrl ? (
                      <img src={selectedDirectoryMember.headshotUrl} alt={selectedDirectoryMember.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={32} color="var(--text-secondary)" />
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                      {selectedDirectoryMember.fullName || 'Unnamed member'}
                      {selectedDirectoryMember.email === user?.email && <span style={{ color: 'var(--accent-cyan)', fontWeight: 500, fontSize: '0.85rem' }}> (You)</span>}
                    </h2>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{selectedDirectoryMember.specialty}</span>
                      <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{selectedDirectoryMember.jobReadiness}</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: selectedDirectoryMember.about ? 'normal' : 'italic', marginBottom: '20px', lineHeight: 1.6 }}>
                  {selectedDirectoryMember.about || 'No bio yet.'}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
                  {selectedDirectoryMember.location && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Location</div>
                      <div style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> {selectedDirectoryMember.location}</div>
                    </div>
                  )}
                  {selectedDirectoryMember.employmentStatus && selectedDirectoryMember.employmentStatus !== 'Not Set' && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        {selectedDirectoryMember.employmentStatus === 'Employed' && selectedDirectoryMember.jobTitle ? 'Job Title' : 'Employment Status'}
                      </div>
                      <div style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={13} />
                        {selectedDirectoryMember.employmentStatus === 'Employed' && selectedDirectoryMember.jobTitle ? selectedDirectoryMember.jobTitle : selectedDirectoryMember.employmentStatus}
                      </div>
                    </div>
                  )}
                  {selectedDirectoryMember.yearsExperience !== null && selectedDirectoryMember.yearsExperience !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Experience</div>
                      <div style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Briefcase size={13} /> {selectedDirectoryMember.yearsExperience} {selectedDirectoryMember.yearsExperience === 1 ? 'year' : 'years'}
                      </div>
                    </div>
                  )}
                  {selectedDirectoryMember.certifications && (
                    <div style={{ gridColumn: selectedDirectoryMember.location || (selectedDirectoryMember.employmentStatus && selectedDirectoryMember.employmentStatus !== 'Not Set') ? 'auto' : '1 / -1' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Certifications</div>
                      <div style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Award size={13} /> {selectedDirectoryMember.certifications}
                      </div>
                    </div>
                  )}
                </div>

                {selectedDirectoryMember.funFact && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '20px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(94, 227, 122, 0.06)', border: '1px solid rgba(94, 227, 122, 0.15)' }}>
                    <Sparkles size={15} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selectedDirectoryMember.funFact}</span>
                  </div>
                )}

                {(selectedDirectoryMember.tryhackmeUsername || isSafeUrl(selectedDirectoryMember.linkedin) || isSafeUrl(selectedDirectoryMember.githubUrl) || isSafeUrl(selectedDirectoryMember.tiktokUrl) || isSafeUrl(selectedDirectoryMember.websiteUrl)) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                    {selectedDirectoryMember.tryhackmeUsername && (
                      <a
                        href={`https://tryhackme.com/p/${encodeURIComponent(selectedDirectoryMember.tryhackmeUsername)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                      >
                        <Target size={13} /> TryHackMe
                      </a>
                    )}
                    {isSafeUrl(selectedDirectoryMember.linkedin) && (
                      <a href={selectedDirectoryMember.linkedin} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                        <Link size={13} /> LinkedIn
                      </a>
                    )}
                    {isSafeUrl(selectedDirectoryMember.githubUrl) && (
                      <a href={selectedDirectoryMember.githubUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                        <Code2 size={13} /> GitHub
                      </a>
                    )}
                    {isSafeUrl(selectedDirectoryMember.tiktokUrl) && (
                      <a href={selectedDirectoryMember.tiktokUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                        <Video size={13} /> TikTok
                      </a>
                    )}
                    {isSafeUrl(selectedDirectoryMember.websiteUrl) && (
                      <a href={selectedDirectoryMember.websiteUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                        <Globe size={13} /> Website
                      </a>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedDirectoryMember(null)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );

    case 'dashboard':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Welcome back, {firstName}!</h1>
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
              <a
                href={upcomingEvent.meetLink}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px' }}
              >
                <Video size={14} /> Join Google Meet
              </a>
            </div>

            {/* Community Intelligence & News Broadcast - one item visible at a
                time, auto-rotating through the feed */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <style>{`
                @keyframes broadcast-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
                .broadcast-fade { animation: broadcast-fade-in 0.5s ease; }
              `}</style>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Megaphone size={18} color="var(--warning)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase' }}>Community Broadcast</span>
              </div>
              <div
                key={broadcastIndex}
                className="broadcast-fade"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{COMMUNITY_BROADCASTS[broadcastIndex].emoji} {COMMUNITY_BROADCASTS[broadcastIndex].title}</span>
                <span style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{COMMUNITY_BROADCASTS[broadcastIndex].body}</span>
              </div>
              {COMMUNITY_BROADCASTS.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  {COMMUNITY_BROADCASTS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setBroadcastIndex(i)}
                      aria-label={`Show broadcast ${i + 1}`}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        background: i === broadcastIndex ? 'var(--warning)' : 'rgba(255,255,255,0.15)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Certification Victories & Member Achievements Feed - one victory
                visible at a time, sliding vertically to the next every 5s */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <style>{`
                @keyframes victory-slide-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
                .victory-slide { animation: victory-slide-in 0.5s ease; }
              `}</style>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Award size={18} color="var(--accent-purple)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-purple)', textTransform: 'uppercase' }}>Recent Certification Victories</span>
              </div>
              <div
                key={communityVictories[victoryIndex].id}
                className="victory-slide"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: communityVictories[victoryIndex].avatarColor, flexShrink: 0 }}></div>
                  <a
                    href={communityVictories[victoryIndex].linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--text-primary)', fontWeight: 700, textDecoration: 'none' }}
                    title="View on LinkedIn"
                  >
                    {communityVictories[victoryIndex].member}
                  </a>
                </div>
                <span style={{ color: 'var(--text-secondary)' }}>earned {communityVictories[victoryIndex].cert}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{communityVictories[victoryIndex].date}</span>
              </div>
              {communityVictories.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  {communityVictories.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setVictoryIndex(i)}
                      aria-label={`Show victory ${i + 1}`}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        background: i === victoryIndex ? 'var(--accent-purple)' : 'rgba(255,255,255,0.15)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Roadmap & Task Checklist */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>My Roadmap</h3>
                <span className="badge badge-success">{progressPercent}% Complete</span>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }} aria-hidden="true">
                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '24px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))', borderRadius: '4px', transition: 'width 0.4s ease' }}></div>
                  </div>

                  {/* Task Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {tasks.map(t => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '14px 16px',
                          borderRadius: 'var(--border-radius-md)',
                          background: t.completed ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                          border: t.completed ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border-color)',
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
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '6px 14px' }}>Under Construction</span>
                </div>
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

                {!isMockSession && !providerToken ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Sign in with Google again to sync this from your calendar.
                  </p>
                ) : !isMockSession && loadingOneOnOne ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Checking your calendar...</p>
                ) : oneOnOneError ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '16px' }}>Couldn't read your calendar: {oneOnOneError}</p>
                ) : nextOneOnOne ? (
                  <>
                    <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>{nextOneOnOne.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Mentor: Siya</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{nextOneOnOne.startFormatted}</div>
                    </div>
                    {nextOneOnOne.meetLink ? (
                      <a
                        href={nextOneOnOne.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <Video size={16} /> Join Google Meet
                      </a>
                    ) : (
                      <a
                        href={nextOneOnOne.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <Calendar size={16} /> View on Google Calendar
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Nothing booked with Siya in the next 30 days.
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setActiveTab?.('meetings')}
                    >
                      <Calendar size={16} /> Book a 1on1 Meeting
                    </button>
                  </>
                )}
              </div>

              {/* Next Payment Card */}
              <div className="glass-card">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                  <CreditCard size={20} color="var(--accent-purple)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Billing Info</h4>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }} aria-hidden="true">
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
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '6px 14px' }}>Under Construction</span>
                  </div>
                </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Events</h1>
              <p>Everything happening across Hacking Hub — meetups, industry events, and casual catchups.</p>
              {eventRsvpError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px' }}>{eventRsvpError}</p>}
              {eventsError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px' }}>{eventsError}</p>}
            </div>
            <button className="btn btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setShowAddEventForm(true)}>
              <CalendarDays size={16} /> Add Event
            </button>
          </div>

          {(() => {
            const myRsvpedEvents = communityEvents
              .filter((e) => hasRsvpedToEvent(e.id))
              .sort((a, b) => new Date(a.date) - new Date(b.date));
            if (myRsvpedEvents.length === 0) return null;
            return (
              <div className="glass-card" style={{ marginBottom: '24px', border: '1px solid var(--accent-cyan)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <CheckCircle2 size={18} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>You're Going</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myRsvpedEvents.map((e) => (
                    <div
                      key={e.id}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{e.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{formatDate(e.date)} at {e.time} SAST</div>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                        {formatEventCountdown(daysUntilEvent(e.date))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <style>{`
            @keyframes rsvp-confetti-burst {
              0% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1); opacity: 1; }
              100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance)) scale(0.4); opacity: 0; }
            }
            .rsvp-confetti {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 7px;
              height: 7px;
              border-radius: 2px;
              animation: rsvp-confetti-burst 0.85s ease-out forwards;
              animation-delay: var(--delay);
              pointer-events: none;
            }
          `}</style>

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

          {loadingEvents && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>Loading events...</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredEvents.map((e) => {
              const typeStyle = EVENT_TYPE_STYLES[e.type] || {};
              const hasRsvped = hasRsvpedToEvent(e.id);
              const rsvpCount = rsvpCountForEvent(e);
              const rsvping = rsvpingEventId === e.id;
              return (
                <div key={e.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className={`badge ${typeStyle.className || ''}`} style={typeStyle.style}>{e.type}</span>
                      {e.status === 'Pending' && (
                        <span className="badge badge-warning" style={{ whiteSpace: 'nowrap' }} title="Only visible to you until an admin approves it">
                          Pending Review
                        </span>
                      )}
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <Users size={13} /> {rsvpCount === null ? '…' : rsvpCount} RSVPs
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{e.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{e.description}</p>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      <CalendarDays size={14} /> {formatDate(e.date)} at {e.time} SAST
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                      <MapPin size={14} /> {e.location}
                    </div>
                    {isSafeUrl(e.link) && (
                      <a
                        href={e.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)' }}
                      >
                        <Link size={14} /> Event Link <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <div style={{ position: 'relative', marginTop: '4px' }}>
                    <button
                      onClick={() => handleEventRsvp(e.id)}
                      disabled={rsvping}
                      title={hasRsvped ? "Click to remove your RSVP" : undefined}
                      className={`btn ${hasRsvped ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ justifyContent: 'center', width: '100%' }}
                    >
                      {rsvping
                        ? (hasRsvped ? 'Leaving...' : 'Joining...')
                        : hasRsvped
                          ? <><CheckCircle2 size={14} /> You're There</>
                          : <><Sparkles size={14} /> Yes I'm There</>}
                    </button>
                    {burstingEventId === e.id && (
                      <div style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                        {CONFETTI_PARTICLES.map((p, i) => (
                          <span
                            key={i}
                            className="rsvp-confetti"
                            style={{
                              '--angle': `${p.angle}deg`,
                              '--distance': `${p.distance}px`,
                              '--delay': `${p.delay}s`,
                              background: p.color,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {hasRsvped && (
                    <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      {formatEventCountdown(daysUntilEvent(e.date))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {showAddEventForm && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
              onClick={() => setShowAddEventForm(false)}
            >
              <div
                className="glass-card"
                style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>Add Event</h2>
                <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Event Title</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Sunday Coffee & Code Catchup"
                      value={newEventForm.title}
                      onChange={(e) => setNewEventForm({ ...newEventForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Type</label>
                    <select
                      className="form-input"
                      value={newEventForm.type}
                      onChange={(e) => setNewEventForm({ ...newEventForm, type: e.target.value })}
                    >
                      <option value="HH Meetup">HH Meetup</option>
                      <option value="Industry Event">Industry Event</option>
                      <option value="Sunday Catchup">Sunday Catchup</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={newEventForm.date}
                        onChange={(e) => setNewEventForm({ ...newEventForm, date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={newEventForm.time}
                        onChange={(e) => setNewEventForm({ ...newEventForm, time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Location</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Google Meet, or a physical address"
                      value={newEventForm.location}
                      onChange={(e) => setNewEventForm({ ...newEventForm, location: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Link (optional)</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://..."
                      value={newEventForm.link}
                      onChange={(e) => setNewEventForm({ ...newEventForm, link: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Description (optional)</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      style={{ resize: 'vertical' }}
                      placeholder="What's this event about?"
                      value={newEventForm.description}
                      onChange={(e) => setNewEventForm({ ...newEventForm, description: e.target.value })}
                    />
                  </div>

                  {addEventError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{addEventError}</p>}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddEventForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={addingEvent}>{addingEvent ? 'Adding...' : 'Add Event'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );

    case 'jobs':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Job Board</h1>
              <p>Roles sourced from Hacking Hub's employer network and job placement partners.</p>
              {jobsError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px' }}>{jobsError}</p>}
            </div>
            <button className="btn btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setShowAddJobForm(true)}>
              <Briefcase size={16} /> Add Job
            </button>
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

          {loadingJobs && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>Loading job board...</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredJobs.map((job) => (
              <div key={job.id} className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className={`badge ${JOB_TYPE_BADGE[job.type] || 'badge-success'}`}>{job.type}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Posted {formatDate(job.posted)}</span>
                    </div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{job.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      <Building2 size={14} /> {job.company}
                    </div>
                  </div>
                  {isSafeUrl(job.link) ? (
                    <a href={job.link} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                      <Briefcase size={14} /> Apply
                    </a>
                  ) : (
                    <button className="btn btn-primary" disabled style={{ fontSize: '0.85rem', opacity: 0.5, cursor: 'not-allowed' }}>
                      <Briefcase size={14} /> No Link Yet
                    </button>
                  )}
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

          {showAddJobForm && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
              onClick={() => setShowAddJobForm(false)}
            >
              <div
                className="glass-card"
                style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>Add a Job</h2>
                <form onSubmit={handleAddJob} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Job Title</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. SOC Analyst (Junior)"
                      value={newJobForm.title}
                      onChange={(e) => setNewJobForm({ ...newJobForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Company</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Nclose"
                      value={newJobForm.company}
                      onChange={(e) => setNewJobForm({ ...newJobForm, company: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Type</label>
                      <select className="form-input" value={newJobForm.type} onChange={(e) => setNewJobForm({ ...newJobForm, type: e.target.value })}>
                        <option value="Full-Time">Full-Time</option>
                        <option value="Contract">Contract</option>
                        <option value="Internship">Internship</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Location</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Remote (SA)"
                        value={newJobForm.location}
                        onChange={(e) => setNewJobForm({ ...newJobForm, location: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Salary (optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. R18,000 – R25,000 / month"
                      value={newJobForm.salary}
                      onChange={(e) => setNewJobForm({ ...newJobForm, salary: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Apply Link</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://..."
                      value={newJobForm.link}
                      onChange={(e) => setNewJobForm({ ...newJobForm, link: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Tags (comma-separated, optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Blue Team, Security+, Entry Level"
                      value={newJobForm.tags}
                      onChange={(e) => setNewJobForm({ ...newJobForm, tags: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Description (optional)</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      style={{ resize: 'vertical' }}
                      placeholder="What's the role about?"
                      value={newJobForm.description}
                      onChange={(e) => setNewJobForm({ ...newJobForm, description: e.target.value })}
                    />
                  </div>

                  {addJobError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{addJobError}</p>}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddJobForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={addingJob}>{addingJob ? 'Adding...' : 'Add Job'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );

    case 'resources':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Library size={28} color="var(--accent-cyan)" /> Resources
              </h1>
              <p>Everything to help you pass certs, plan your career, and land the role — cert prep, role roadmaps, podcasts, books, interview playbooks, and CV templates.</p>
              {resourcesError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px' }}>{resourcesError}</p>}
            </div>
            <button className="btn btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setShowAddResourceForm(true)}>
              <Library size={16} /> Add Resource
            </button>
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

          {loadingResources && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>Loading resources...</p>}

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
                  {isSafeUrl(res.link) ? (
                    <a
                      href={res.link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                      style={{ justifyContent: 'center', fontSize: '0.85rem' }}
                    >
                      <ExternalLink size={14} /> Open Resource
                    </a>
                  ) : (
                    <button className="btn btn-secondary" disabled style={{ justifyContent: 'center', fontSize: '0.85rem', opacity: 0.5, cursor: 'not-allowed' }}>
                      <Download size={14} /> Coming Soon
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {!loadingResources && filteredResources.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No resources here yet — be the first to add one.</p>
          )}

          {showAddResourceForm && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
              onClick={() => setShowAddResourceForm(false)}
            >
              <div
                className="glass-card"
                style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>Add a Resource</h2>
                <form onSubmit={handleAddResource} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Category</label>
                    <select
                      className="form-input"
                      value={newResourceForm.category}
                      onChange={(e) => setNewResourceForm({ ...newResourceForm, category: e.target.value })}
                    >
                      {RESOURCE_CATEGORIES.filter((c) => c !== 'All').map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Title</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Google Cybersecurity Professional Certificate"
                      value={newResourceForm.title}
                      onChange={(e) => setNewResourceForm({ ...newResourceForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Link</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://..."
                      value={newResourceForm.link}
                      onChange={(e) => setNewResourceForm({ ...newResourceForm, link: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Format (optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Course, Guide, Podcast, Book"
                      value={newResourceForm.format}
                      onChange={(e) => setNewResourceForm({ ...newResourceForm, format: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Description (optional)</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      style={{ resize: 'vertical' }}
                      placeholder="Why is this worth checking out?"
                      value={newResourceForm.description}
                      onChange={(e) => setNewResourceForm({ ...newResourceForm, description: e.target.value })}
                    />
                  </div>

                  {addResourceError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{addResourceError}</p>}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddResourceForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={addingResource}>{addingResource ? 'Adding...' : 'Add Resource'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );

    case 'certs':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Community Certification Calendar</h1>
              <p>Hacking Hub community-wide target exam dates, active cohorts, and member countdowns.</p>
              {certCalendarError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '8px' }}>{certCalendarError}</p>}
            </div>
            <button className="btn btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setShowAddCertForm(true)}>
              <GraduationCap size={16} /> Add to Cert Calendar
            </button>
          </div>

          <div className="glass-card" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Community Operatives Exam Countdown</h3>
              <span className="badge badge-success">{certCalendar.length} Active Targets</span>
            </div>

            {loadingCertCalendar && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>Loading cert calendar...</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {certCalendar.map((c) => {
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
                      <strong style={{ color: 'var(--accent-cyan)' }}>{formatDate(c.date)}</strong>
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

          {showAddCertForm && (
            <div
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
              onClick={() => setShowAddCertForm(false)}
            >
              <div
                className="glass-card"
                style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--accent-cyan)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>Add to Cert Calendar</h2>
                <form onSubmit={handleAddCertEntry} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Your Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Jane Doe"
                      value={newCertForm.member}
                      onChange={(e) => setNewCertForm({ ...newCertForm, member: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Certification</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. CompTIA Security+"
                      value={newCertForm.cert}
                      onChange={(e) => setNewCertForm({ ...newCertForm, cert: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Target Exam Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newCertForm.date}
                      onChange={(e) => setNewCertForm({ ...newCertForm, date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Cohort (optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. SecPlus-Aug"
                      value={newCertForm.cohort}
                      onChange={(e) => setNewCertForm({ ...newCertForm, cohort: e.target.value })}
                    />
                  </div>

                  {addCertError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{addCertError}</p>}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddCertForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={addingCert}>{addingCert ? 'Adding...' : 'Add to Calendar'}</button>
                  </div>
                </form>
              </div>
            </div>
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {daysUntilCompetition > 0 && (
                  <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CalendarCheck2 size={12} /> Kicks off in {daysUntilCompetition} day{daysUntilCompetition === 1 ? '' : 's'}
                  </span>
                )}
                <span className={`badge ${competitionStatusBadgeClass}`}>{competitionStatus}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {currentCompetition.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Runs</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Start</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(competitionStartDate)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>End</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(competitionEndDate)}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Prizes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {currentCompetition.prizes.map((p) => (
                    <div key={p.place} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{p.place}</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{p.reward}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <style>{`
              @keyframes rsvp-confetti-burst {
                0% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1); opacity: 1; }
                100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance)) scale(0.4); opacity: 0; }
              }
              .rsvp-confetti {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 7px;
                height: 7px;
                border-radius: 2px;
                animation: rsvp-confetti-burst 0.85s ease-out forwards;
                animation-delay: var(--delay);
                pointer-events: none;
              }
              @keyframes rsvp-row-in {
                0% { background: rgba(94, 227, 122, 0.4); transform: scale(1.01); }
                100% { background: transparent; transform: scale(1); }
              }
              .rsvp-row-new { animation: rsvp-row-in 1.8s ease-out; }
            `}</style>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  className={`btn ${hasRsvpedForCompetition ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={handleCompetitionRsvp}
                  disabled={hasRsvpedForCompetition || rsvpingCompetition}
                  style={{ justifyContent: 'center' }}
                >
                  {hasRsvpedForCompetition ? <><CheckCircle2 size={14} /> You're In</> : rsvpingCompetition ? 'Joining...' : "Yes I'm In"}
                </button>
                {showRsvpConfetti && (
                  <div style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                    {CONFETTI_PARTICLES.map((p, i) => (
                      <span
                        key={i}
                        className="rsvp-confetti"
                        style={{
                          '--angle': `${p.angle}deg`,
                          '--distance': `${p.distance}px`,
                          '--delay': `${p.delay}s`,
                          background: p.color,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <a
                href="https://docs.google.com/document/d/1VRDejGUdybG96XckT9XFrQMeRk8aapH1QTDlt6c62QA/edit?tab=t.0#heading=h.fr8u08q2iu12"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ justifyContent: 'center' }}
              >
                <BookOpen size={14} /> Learn More
              </a>
              {standingsError && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{standingsError}</span>}
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Current Standings</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Updated weekly</span>
            </div>
            {loadingStandings && <p style={{ color: 'var(--text-muted)' }}>Loading standings...</p>}
            {!loadingStandings && competitionLeaderboard.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>No one's RSVP'd yet - be the first!</p>
            )}
            {!loadingStandings && competitionLeaderboard.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Rank</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Member</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Target size={13} /> Rooms Completed</span>
                  </th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CalendarCheck2 size={13} /> Days Logged</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...competitionLeaderboard].sort((a, b) => b.daysLogged - a.daysLogged).map((row, i) => {
                  const medal = i === 0
                    ? { bg: 'rgba(250, 204, 21, 0.10)', color: '#facc15' }
                    : i === 1
                    ? { bg: 'rgba(203, 213, 225, 0.09)', color: '#cbd5e1' }
                    : i === 2
                    ? { bg: 'rgba(217, 119, 87, 0.10)', color: '#d97757' }
                    : null;
                  return (
                    <tr
                      key={row.email || row.member}
                      className={row.email && row.email === justRsvpedEmail ? 'rsvp-row-new' : undefined}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: medal?.bg }}
                    >
                      <td style={{ padding: '14px 12px' }}>
                        {medal ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: medal.color, fontWeight: 700 }}>
                            <Trophy size={15} /> #{i + 1}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>#{i + 1}</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 12px', fontWeight: 600 }}>{row.member}</td>
                      <td style={{ padding: '14px 12px', color: 'var(--text-secondary)' }}>{row.rooms}</td>
                      <td style={{ padding: '14px 12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{row.daysLogged}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
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
                      {formatDate(r.createdAt)}
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
              <div style={{ position: 'relative' }}>
                <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }} aria-hidden="true">
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
                </div>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '6px 14px' }}>Under Construction</span>
                </div>
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
