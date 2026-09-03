import React, { useState, useEffect } from 'react';
import { fetchPastCalendarEvents } from '../../lib/googleCalendar';
import CertDetailsModal from '../../components/CertDetailsModal';
import MemberProfileModal from '../../components/MemberProfileModal';
import AddMemberModal from '../../components/AddMemberModal';
import RecordEftPaymentModal from '../../components/RecordEftPaymentModal';
import GroupedMemberDirectory from '../../components/GroupedMemberDirectory';
// Anonymized fixture data for Mock Admin only - same shape and aggregate
// realism (amounts, dates, plan mix) as the real historical PayFast export,
// but with every real member/email swapped for a fake "Demo Member N"
// identity. The real export used to live here as payfastTransactions.json,
// committed with real members' names, emails, and exact payment amounts to
// this *public* GitHub repo - that data is now fully backfilled into the
// payfast_transactions table (see 033_payfast_transactions.sql PART 2) and
// the real file has been removed and purged from git history entirely.
import payfastTransactionsMockData from '../../data/payfastTransactions.mock.json';
import { LAPSED_AFTER_DAYS, MEETING_OVERDUE_AFTER_DAYS, ROADMAP_STALE_AFTER_DAYS, ROADMAP_TRACKS, ROADMAP_PHASES, CORE_FOUNDATIONS_CATALOG, CORE_FOUNDATIONS_MIN_REQUIRED, SPECIALIZATION_UNLOCK_MIN, SPECIALIZATION_CATALOGS, EXAM_READINESS_CATALOGS, matchExamReadinessCert, EXAM_NUDGE_WINDOW_DAYS, EXAM_NUDGE_THRESHOLD_PCT, REFERRAL_REWARD_AMOUNT, ROADMAP_ITEM_LINKS } from '../../lib/memberOptions';
import { formatDate } from '../../lib/dateFormat';
import {
  fetchMemberProfiles,
  upsertMemberProfile,
  permanentlyDeleteMember,
  fetchDeletedMemberEmails,
  fetchManualMembers,
  insertManualMember,
  fetchEftPayments,
  insertEftPayment,
  deleteEftPayment,
  grantMemberPortalAccess,
} from '../../lib/memberData';
import { fetchReviews } from '../../lib/reviewsData';
import { fetchAllReferrals, updateReferralStatus } from '../../lib/referralsData';
import { friendlyErrorMessage } from '../../lib/errorMessages';
import { isSafeUrl } from '../../lib/safeUrl';
import { fetchCertCalendar, addCertCalendarEntry, updateCertCalendarResult, updateCertCalendarEntry, deleteCertCalendarEntry } from '../../lib/certCalendarData';
import { fetchExpenses, addExpense, updateExpense, deleteExpense } from '../../lib/expensesData';
import { fetchFocusFive, addToFocusFive, removeFromFocusFive } from '../../lib/focusFiveData';
import {
  fetchAllCommunityBroadcasts, addCommunityBroadcast, updateCommunityBroadcast, deleteCommunityBroadcast,
  fetchAllCommunityWins, addCommunityWin, updateCommunityWin, deleteCommunityWin,
} from '../../lib/communityContentData';
import { fetchAllSuggestedContent, addSuggestedContent, updateSuggestedContent, deleteSuggestedContent } from '../../lib/suggestedContentData';
import { fetchCommunityEvents, approveCommunityEvent, deleteCommunityEvent, createCommunityEvent } from '../../lib/eventsData';
import { fetchJobBoard, addJobListing, deleteJobListing } from '../../lib/jobBoardData';
import { fetchRoadmapForMember, fetchAllRoadmapItems, addRoadmapItem, updateRoadmapItem, deleteRoadmapItem, setRoadmapFoundationsApproval } from '../../lib/roadmapData';
import { ONBOARDING_STEPS, fetchAllOnboardingSteps } from '../../lib/onboardingData';
import { fetchOptinPool, fetchAllGroups, runMatchmakerRound, updateGroupStatus, updateGroupDueDate, deleteGroup } from '../../lib/matchmakerData';
import { fetchAllRoomLogs, reviewRoomLog } from '../../lib/roomLogData';
import { fetchPortalActiveMemberCount, fetchPortalTabEngagement, fetchPortalWeeklyTrend } from '../../lib/portalEventsData';
import { fetchAllExamReadiness, computeReadinessPercent } from '../../lib/examReadinessData';
import { fetchPayfastPayments } from '../../lib/payfastPaymentsData';
import {
  Calendar,
  Users,
  CreditCard,
  GraduationCap,
  TrendingUp,
  DollarSign,
  Briefcase,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Award,
  Megaphone,
  Info,
  Download,
  Link,
  Phone,
  MapPin,
  UserPlus,
  Landmark,
  Building2,
  Flag,
  Star,
  Milestone,
  Trash2,
  Pencil,
  CheckSquare,
  Square,
  Handshake,
  ListChecks,
  X,
  Sparkles,
  CalendarClock,
  Activity,
  LayoutGrid,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// Focus 5 - the members getting the most attention this month, now backed
// by supabase/038_focus_five.sql instead of a hardcoded list. Mock Admin
// has no real session, so it gets a small local-only seed instead - these
// don't match anyone in the mock roster (same as before), but the Edit
// panel still works against local state so the mock demo isn't broken.
const MOCK_FOCUS_FIVE = ['elrico', 'olungaka', 'lubabalo', 'inam', 'louisa'].map((name) => ({
  id: name,
  memberEmail: `${name}@example.com`,
}));

// One color per expense category, for the "Expenses by Category" bar chart
// on the Dashboard tab - kept here rather than inline so it stays in sync
// with EXPENSE_CATEGORIES (defined further down, inside the component,
// alongside the rest of the expenses state) without needing to be
// recomputed per render.
const EXPENSE_CATEGORY_COLORS = {
  'Tools & Software': 'var(--accent-cyan)',
  Staff: 'var(--accent-purple)',
  Marketing: 'var(--warning)',
  'Hosting / Infrastructure': 'var(--info)',
  Events: '#f472b6',
  Other: 'var(--text-muted)',
};

export default function AdminDashboard({ activeTab, setActiveTab, providerToken, isMockSession, user }) {
  // Bumped by the "Refresh" button on the Admin Overview tab - added to every
  // data-fetching useEffect's dependency array below so a click re-runs all
  // of them. Nothing here is live/polling otherwise: every tab's data is a
  // one-time fetch on mount, so without this the admin has no way to see
  // fresh data short of a full page reload.
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [refreshingData, setRefreshingData] = useState(false);
  const handleRefreshData = () => {
    setRefreshingData(true);
    setDataRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshingData(false), 1200);
  };

  // Certifications state
  const [selectedCert, setSelectedCert] = useState(null);
  const [certEvents, setCertEvents] = useState([]);
  const [loadingCertEvents, setLoadingCertEvents] = useState(false);
  const [certEventsError, setCertEventsError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredTrendMonth, setHoveredTrendMonth] = useState(null);

  // Roadmaps tab - one member's checklist at a time, admin-authored. Real
  // Supabase data for a real session (RLS grants admins full visibility via
  // is_admin()); Mock Admin has no real session, so it stays purely local.
  const [roadmapMemberEmail, setRoadmapMemberEmail] = useState(null);
  const [roadmapMemberSearch, setRoadmapMemberSearch] = useState('');
  const [roadmapTrackFilter, setRoadmapTrackFilter] = useState('All');
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [loadingRoadmapItems, setLoadingRoadmapItems] = useState(false);
  const [roadmapItemsError, setRoadmapItemsError] = useState(null);
  const [showAddRoadmapItemForm, setShowAddRoadmapItemForm] = useState(false);
  const [newRoadmapItem, setNewRoadmapItem] = useState({ phase: 'Core Foundations', category: '', title: '', detail: '', dueDate: '' });
  const [editingRoadmapItemId, setEditingRoadmapItemId] = useState(null);
  const [editRoadmapItemForm, setEditRoadmapItemForm] = useState({ phase: '', category: '', title: '', detail: '', dueDate: '' });
  // Mock Admin only - keeps locally-added/edited items around when switching
  // between members, since there's no real session to persist them to.
  const [mockRoadmapItemsByEmail, setMockRoadmapItemsByEmail] = useState({});

  // Mock Admin only - updates both the visible list and the per-email store
  // that survives switching to a different member and back.
  const applyMockRoadmapItems = (email, items) => {
    setRoadmapItems(items);
    setMockRoadmapItemsByEmail((prev) => ({ ...prev, [email.toLowerCase()]: items }));
  };

  // Every member's roadmap items, fetched once (not per-member) purely to
  // compute each member's % complete in the picker list without having to
  // open their checklist first. Real session only - Mock Admin reuses
  // mockRoadmapItemsByEmail above instead, since there's nothing to fetch.
  const [allRoadmapItems, setAllRoadmapItems] = useState([]);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAllRoadmapItems()
      .then((data) => !cancelled && setAllRoadmapItems(data))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  // Every member's onboarding checklist progress, fetched once for the "New
  // Members Onboarding" queue on the Members tab. Real session only - Mock
  // Admin has no real session for these rows to exist against, so the queue
  // just renders empty under Mock Admin rather than fabricating progress for
  // real payer names.
  const [allOnboardingSteps, setAllOnboardingSteps] = useState([]);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAllOnboardingSteps()
      .then((data) => !cancelled && setAllOnboardingSteps(data))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const loadRoadmapForMember = (email) => {
    setRoadmapMemberEmail(email);
    setShowAddRoadmapItemForm(false);
    setEditingRoadmapItemId(null);
    if (isMockSession) {
      // No fabricated roadmap for real member names in the mock roster (the
      // roster itself comes from real PayFast history even under Mock
      // Admin) - starts empty, same as a real member with nothing assigned
      // yet. Add/edit/delete below still work locally to try the UI out.
      setRoadmapItems(mockRoadmapItemsByEmail[email.toLowerCase()] || []);
      return;
    }
    setLoadingRoadmapItems(true);
    setRoadmapItemsError(null);
    fetchRoadmapForMember(email)
      .then(setRoadmapItems)
      .catch((err) => setRoadmapItemsError(friendlyErrorMessage(err)))
      .finally(() => setLoadingRoadmapItems(false));
  };

  const handleAddRoadmapItem = async (e) => {
    e.preventDefault();
    if (!roadmapMemberEmail || !newRoadmapItem.category || !newRoadmapItem.title) return;
    const nextSortOrder = Math.max(0, ...roadmapItems.map((i) => i.sortOrder), 0) + 10;
    if (isMockSession) {
      applyMockRoadmapItems(roadmapMemberEmail, [...roadmapItems, { id: Date.now(), memberEmail: roadmapMemberEmail, completed: false, sortOrder: nextSortOrder, ...newRoadmapItem }]);
    } else {
      try {
        const created = await addRoadmapItem({ memberEmail: roadmapMemberEmail, sortOrder: nextSortOrder, ...newRoadmapItem });
        setRoadmapItems([...roadmapItems, created]);
      } catch (err) {
        setRoadmapItemsError(friendlyErrorMessage(err));
        return;
      }
    }
    setNewRoadmapItem({ phase: 'Core Foundations', category: '', title: '', detail: '', dueDate: '' });
    setShowAddRoadmapItemForm(false);
  };

  // Quick-fills whichever of the 8 standard Core Foundations certs (see
  // CORE_FOUNDATIONS_CATALOG) this member doesn't already have, rather than
  // an admin having to type each one by hand for every new roadmap.
  const [addingStandardFoundations, setAddingStandardFoundations] = useState(false);

  const handleAddStandardFoundations = async () => {
    if (!roadmapMemberEmail) return;
    const existingTitles = new Set(roadmapItems.filter((i) => i.phase === 'Core Foundations' && i.category === 'Certifications').map((i) => i.title));
    const missing = CORE_FOUNDATIONS_CATALOG.filter((c) => !existingTitles.has(c.title));
    if (missing.length === 0) return;

    setAddingStandardFoundations(true);
    let nextSortOrder = Math.max(0, ...roadmapItems.map((i) => i.sortOrder), 0) + 10;
    const newItems = missing.map((c) => {
      const item = { phase: 'Core Foundations', category: 'Certifications', title: c.title, detail: c.defaultDetail };
      const sortOrder = nextSortOrder;
      nextSortOrder += 10;
      return { ...item, sortOrder };
    });

    if (isMockSession) {
      applyMockRoadmapItems(roadmapMemberEmail, [...roadmapItems, ...newItems.map((item) => ({ id: Date.now() + item.sortOrder, memberEmail: roadmapMemberEmail, completed: false, ...item }))]);
      setAddingStandardFoundations(false);
      return;
    }

    try {
      const created = [];
      for (const item of newItems) {
        created.push(await addRoadmapItem({ memberEmail: roadmapMemberEmail, ...item }));
      }
      setRoadmapItems([...roadmapItems, ...created]);
    } catch (err) {
      setRoadmapItemsError(friendlyErrorMessage(err));
    } finally {
      setAddingStandardFoundations(false);
    }
  };

  // Quick-fills whichever items from the member's assigned track's standard
  // Specialization catalog (SPECIALIZATION_CATALOGS) they don't already
  // have. Only SOC and Offensive Security have a defined catalog today.
  const [addingStandardSpecialization, setAddingStandardSpecialization] = useState(false);

  const handleAddStandardSpecialization = async (catalog) => {
    if (!roadmapMemberEmail || !catalog) return;
    const existingTitles = new Set(roadmapItems.filter((i) => i.phase === 'Specialization' && i.category === catalog.category).map((i) => i.title));
    const missing = catalog.items.filter((c) => !existingTitles.has(c.title));
    if (missing.length === 0) return;

    setAddingStandardSpecialization(true);
    let nextSortOrder = Math.max(0, ...roadmapItems.map((i) => i.sortOrder), 0) + 10;
    const newItems = missing.map((c) => {
      const item = { phase: 'Specialization', category: catalog.category, title: c.title, detail: c.defaultDetail };
      const sortOrder = nextSortOrder;
      nextSortOrder += 10;
      return { ...item, sortOrder };
    });

    if (isMockSession) {
      applyMockRoadmapItems(roadmapMemberEmail, [...roadmapItems, ...newItems.map((item) => ({ id: Date.now() + item.sortOrder, memberEmail: roadmapMemberEmail, completed: false, ...item }))]);
      setAddingStandardSpecialization(false);
      return;
    }

    try {
      const created = [];
      for (const item of newItems) {
        created.push(await addRoadmapItem({ memberEmail: roadmapMemberEmail, ...item }));
      }
      setRoadmapItems([...roadmapItems, ...created]);
    } catch (err) {
      setRoadmapItemsError(friendlyErrorMessage(err));
    } finally {
      setAddingStandardSpecialization(false);
    }
  };

  // Approving/revoking is what actually unlocks Specialization for a member
  // who's hit the completion count - see SPECIALIZATION_UNLOCK_MIN. Updates
  // the local memberProfiles overlay directly so the badge/button reflect
  // it immediately, same pattern as handleSaveMemberProfile.
  const [savingFoundationsApproval, setSavingFoundationsApproval] = useState(false);

  const handleToggleFoundationsApproval = async (email, approved) => {
    setSavingFoundationsApproval(true);
    const key = email.toLowerCase();
    if (!isMockSession) {
      try {
        await setRoadmapFoundationsApproval(email, approved);
      } catch (err) {
        setRoadmapItemsError(friendlyErrorMessage(err));
        setSavingFoundationsApproval(false);
        return;
      }
    }
    setMemberProfiles((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), roadmapFoundationsApproved: approved },
    }));
    setSavingFoundationsApproval(false);
  };

  const startEditRoadmapItem = (item) => {
    setEditingRoadmapItemId(item.id);
    setEditRoadmapItemForm({ phase: item.phase, category: item.category, title: item.title, detail: item.detail, dueDate: item.dueDate || '' });
  };

  const handleSaveRoadmapItemEdit = async (item) => {
    const updated = { ...item, ...editRoadmapItemForm };
    if (isMockSession) {
      applyMockRoadmapItems(roadmapMemberEmail, roadmapItems.map((i) => (i.id === item.id ? updated : i)));
    } else {
      try {
        await updateRoadmapItem(item.id, { ...updated, sortOrder: item.sortOrder });
        setRoadmapItems(roadmapItems.map((i) => (i.id === item.id ? updated : i)));
      } catch (err) {
        setRoadmapItemsError(friendlyErrorMessage(err));
        return;
      }
    }
    setEditingRoadmapItemId(null);
  };

  const handleToggleRoadmapItemDone = async (item) => {
    const updated = { ...item, completed: !item.completed };
    if (isMockSession) {
      applyMockRoadmapItems(roadmapMemberEmail, roadmapItems.map((i) => (i.id === item.id ? updated : i)));
      return;
    }
    setRoadmapItems(roadmapItems.map((i) => (i.id === item.id ? updated : i)));
    try {
      await updateRoadmapItem(item.id, { ...updated, sortOrder: item.sortOrder });
    } catch (err) {
      setRoadmapItemsError(friendlyErrorMessage(err));
      setRoadmapItems(roadmapItems.map((i) => (i.id === item.id ? item : i)));
    }
  };

  const handleDeleteRoadmapItem = async (item) => {
    if (isMockSession) {
      applyMockRoadmapItems(roadmapMemberEmail, roadmapItems.filter((i) => i.id !== item.id));
      return;
    }
    setRoadmapItems(roadmapItems.filter((i) => i.id !== item.id));
    try {
      await deleteRoadmapItem(item.id);
    } catch (err) {
      setRoadmapItemsError(friendlyErrorMessage(err));
      setRoadmapItems([...roadmapItems, item]);
    }
  };

  // Matchmaker - opt-in pool + randomized groups of 2-4. Real Supabase data
  // for a real session (RLS grants admins full visibility via is_admin());
  // Mock Admin has no real session, so it stays purely local.
  const [optinPool, setOptinPool] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingMatchmaker, setLoadingMatchmaker] = useState(!isMockSession);
  const [matchmakerError, setMatchmakerError] = useState(null);
  const [runningRound, setRunningRound] = useState(false);

  const refreshMatchmakerData = () =>
    Promise.all([fetchOptinPool(), fetchAllGroups()])
      .then(([pool, allGroups]) => {
        setOptinPool(pool);
        setGroups(allGroups);
      })
      .catch((err) => setMatchmakerError(friendlyErrorMessage(err)))
      .finally(() => setLoadingMatchmaker(false));

  useEffect(() => {
    if (isMockSession) return;
    refreshMatchmakerData();
  }, [isMockSession, dataRefreshKey]);

  const handleRunMatchmakerRound = async () => {
    setMatchmakerError(null);
    if (isMockSession) {
      if (optinPool.length < 2) {
        setMatchmakerError('Need at least 2 opted-in members to run a round.');
        return;
      }
      const shuffled = [...optinPool].sort(() => Math.random() - 0.5);
      const numGroups = Math.ceil(shuffled.length / 4);
      const mockDueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const newGroups = Array.from({ length: numGroups }, (_, i) => ({
        id: Date.now() + i,
        activityType: Math.random() < 0.5 ? 'Project' : 'Presentation',
        memberEmails: shuffled.filter((_, idx) => idx % numGroups === i),
        status: 'Active',
        dueDate: mockDueDate,
      }));
      setGroups([...newGroups, ...groups]);
      setOptinPool([]);
      return;
    }
    setRunningRound(true);
    try {
      await runMatchmakerRound();
      refreshMatchmakerData();
    } catch (err) {
      setMatchmakerError(friendlyErrorMessage(err));
    } finally {
      setRunningRound(false);
    }
  };

  const handleUpdateGroupStatus = async (group, status) => {
    setGroups(groups.map((g) => (g.id === group.id ? { ...g, status } : g)));
    if (!isMockSession) {
      try {
        await updateGroupStatus(group.id, status);
      } catch (err) {
        setMatchmakerError(friendlyErrorMessage(err));
        setGroups(groups.map((g) => (g.id === group.id ? group : g)));
      }
    }
  };

  const handleUpdateGroupDueDate = async (group, dueDate) => {
    setGroups(groups.map((g) => (g.id === group.id ? { ...g, dueDate } : g)));
    if (!isMockSession) {
      try {
        await updateGroupDueDate(group.id, dueDate);
      } catch (err) {
        setMatchmakerError(friendlyErrorMessage(err));
        setGroups(groups.map((g) => (g.id === group.id ? group : g)));
      }
    }
  };

  const handleDeleteGroup = async (group) => {
    setGroups(groups.filter((g) => g.id !== group.id));
    if (!isMockSession) {
      try {
        await deleteGroup(group.id);
      } catch (err) {
        setMatchmakerError(friendlyErrorMessage(err));
        setGroups((prev) => [...prev, group]);
      }
    }
  };

  // Room Logs - members' self-reported daily TryHackMe room counts, pending
  // admin review. Approving credits competition_standings for that member.
  const [roomLogs, setRoomLogs] = useState([]);
  const [loadingRoomLogs, setLoadingRoomLogs] = useState(!isMockSession);
  const [roomLogsError, setRoomLogsError] = useState(null);
  const [reviewingRoomLogId, setReviewingRoomLogId] = useState(null);
  const [rejectNoteDraft, setRejectNoteDraft] = useState({});

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAllRoomLogs()
      .then((data) => !cancelled && setRoomLogs(data))
      .catch((err) => !cancelled && setRoomLogsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingRoomLogs(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  // Portal usage analytics (050_portal_events.sql) - powers the "usage"
  // section of the Insights tab. Aggregated server-side (three small RPCs),
  // not looped over client-side like the rest of Insights - this table
  // won't stay roster-sized the way member_profiles does. Fetch-on-mount +
  // the existing manual Refresh button, no polling, same as every other tab.
  const [portalActiveMembers7d, setPortalActiveMembers7d] = useState(null);
  const [portalActiveMembers30d, setPortalActiveMembers30d] = useState(null);
  const [portalTabEngagement, setPortalTabEngagement] = useState([]);
  const [portalWeeklyTrend, setPortalWeeklyTrend] = useState([]);
  const [loadingPortalAnalytics, setLoadingPortalAnalytics] = useState(!isMockSession);
  const [portalAnalyticsError, setPortalAnalyticsError] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    Promise.all([
      fetchPortalActiveMemberCount(7),
      fetchPortalActiveMemberCount(30),
      fetchPortalTabEngagement(30),
      fetchPortalWeeklyTrend(8),
    ])
      .then(([active7d, active30d, tabEngagement, weeklyTrend]) => {
        if (cancelled) return;
        setPortalActiveMembers7d(active7d);
        setPortalActiveMembers30d(active30d);
        setPortalTabEngagement(tabEngagement);
        setPortalWeeklyTrend(weeklyTrend);
      })
      .catch((err) => !cancelled && setPortalAnalyticsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingPortalAnalytics(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  // Exam Readiness nudge (Insights tab) - every member's readiness row,
  // across every cert. Cheap: one unfiltered admin-only select, joined
  // client-side against the already-fetched `certs` (Cert Calendar) state
  // below rather than a second round trip.
  const [examReadinessRows, setExamReadinessRows] = useState([]);
  const [loadingExamReadiness, setLoadingExamReadiness] = useState(!isMockSession);
  const [examReadinessError, setExamReadinessError] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAllExamReadiness()
      .then((data) => !cancelled && setExamReadinessRows(data))
      .catch((err) => !cancelled && setExamReadinessError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingExamReadiness(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const handleReviewRoomLog = async (log, approved) => {
    const note = approved ? '' : (rejectNoteDraft[log.id] || '');
    setReviewingRoomLogId(log.id);
    if (isMockSession) {
      setRoomLogs(roomLogs.map((l) => (l.id === log.id ? { ...l, status: approved ? 'Approved' : 'Rejected', adminNote: note } : l)));
      setReviewingRoomLogId(null);
      return;
    }
    try {
      await reviewRoomLog(log.id, approved, note);
      setRoomLogs(await fetchAllRoomLogs());
    } catch (err) {
      setRoomLogsError(friendlyErrorMessage(err));
    } finally {
      setReviewingRoomLogId(null);
    }
  };

  // Member profile fields with no source in the PayFast export (age, location, gender,
  // specialty, LinkedIn, phone, money owed, job readiness) are admin-entered and kept
  // here rather than invented for real, named members. Keyed by lowercased email.
  const [memberProfiles, setMemberProfiles] = useState({});
  const [selectedMemberEmail, setSelectedMemberEmail] = useState(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('all');
  // Member Sheet column sort - null key means the default (name, A-Z).
  // Clicking the same column again flips direction; clicking a different
  // one starts that column fresh at ascending.
  const [memberSheetSort, setMemberSheetSort] = useState({ key: null, dir: 'asc' });
  // 'grid' (the original flat card grid) or 'domain' (grouped by
  // Specialization track - see GroupedMemberDirectory).
  const [memberViewMode, setMemberViewMode] = useState('grid');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Refer a Friend submissions - real Supabase data for a real session, a
  // small local demo set under Mock Admin since there's no session to fetch
  // against.
  const [referrals, setReferrals] = useState(isMockSession ? [
    // referrerEmail matches against memberRoster (built from
    // payfastTransactionsMockData under Mock Admin) to show the referrer's
    // real name - has to be one of that fixture's fake "Demo Member N"
    // emails, not a real member's, both so it actually resolves to a name
    // and so no real person's email sits in tracked demo/mock code.
    { id: 1, referrerEmail: 'demo.member1@example.com', name: 'Nomvula Radebe', linkedin: 'https://www.linkedin.com/in/example', phone: '071 234 5678', status: 'Pending', createdAt: '2026-08-15T00:00:00Z' },
  ] : []);
  const [loadingReferrals, setLoadingReferrals] = useState(!isMockSession);
  const [referralsError, setReferralsError] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAllReferrals()
      .then((data) => !cancelled && setReferrals(data))
      .catch((err) => !cancelled && setReferralsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingReferrals(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  // Moves a referral through Pending -> Joined -> Reward Paid. Same
  // no-mock-branch precedent already established for this exact feature
  // (the section already discloses "referrals only load for a real
  // signed-in session" under Mock Admin) - handleApproveEvent doesn't
  // branch for isMockSession either, so this doesn't either.
  const [updatingReferralId, setUpdatingReferralId] = useState(null);

  const handleUpdateReferralStatus = async (referralId, status) => {
    setUpdatingReferralId(referralId);
    setReferralsError(null);
    try {
      await updateReferralStatus(referralId, status);
      setReferrals((prev) => prev.map((r) => (r.id === referralId ? { ...r, status } : r)));
    } catch (err) {
      setReferralsError(friendlyErrorMessage(err));
    } finally {
      setUpdatingReferralId(null);
    }
  };

  // Members added by hand (no PayFast payment yet) - kept separate from the
  // payment-derived roster and merged in for display.
  const [manualMembers, setManualMembers] = useState([]);

  // Last 1on1 date per member, matched by email against Google Calendar attendees.
  // Pulled on demand (not automatically) since it's one real API call per sync.
  const [lastMeetingByEmail, setLastMeetingByEmail] = useState({});
  // Every synced meeting date per member (not just the latest) - same sync,
  // same attendee-matching heuristic, just kept in full so Insights can work
  // out how far apart a member's meetings actually land, not only when the
  // last one was.
  const [meetingDatesByEmail, setMeetingDatesByEmail] = useState({});
  const [loadingMeetingSync, setLoadingMeetingSync] = useState(false);
  const [meetingSyncError, setMeetingSyncError] = useState(null);

  const handleSyncLastMeetings = () => {
    setLoadingMeetingSync(true);
    setMeetingSyncError(null);
    fetchPastCalendarEvents(providerToken, { sinceDate: '2026-01-01T00:00:00Z' })
      .then((events) => {
        const lastMap = {};
        const datesMap = {};
        events.forEach((evt) => {
          evt.attendees.forEach((a) => {
            const key = a.email.toLowerCase();
            if (!lastMap[key] || new Date(evt.start) > new Date(lastMap[key])) {
              lastMap[key] = evt.start;
            }
            (datesMap[key] || (datesMap[key] = [])).push(evt.start);
          });
        });
        setLastMeetingByEmail(lastMap);
        setMeetingDatesByEmail(datesMap);
      })
      .catch((err) => setMeetingSyncError(friendlyErrorMessage(err)))
      .finally(() => setLoadingMeetingSync(false));
  };

  const handleSaveMemberProfile = (email, profileData) => {
    setMemberProfiles((prev) => ({ ...prev, [email.toLowerCase()]: profileData }));
    if (!isMockSession) {
      upsertMemberProfile(email, profileData).catch((err) => setSavedMemberDataError(friendlyErrorMessage(err)));
    }
  };

  // Only ever called for a member already marked 'Left' (enforced in
  // MemberProfileModal, which only renders the button in that state).
  // Immediately hides them from every roster - real payment history and
  // other records stay intact, just no longer linked to a live profile.
  const handleDeleteMemberProfile = (email) => {
    const lowerEmail = email.toLowerCase();
    setDeletedEmails((prev) => new Set(prev).add(lowerEmail));
    setMemberProfiles((prev) => {
      const next = { ...prev };
      delete next[lowerEmail];
      return next;
    });
    setManualMembers((prev) => prev.filter((m) => m.email.toLowerCase() !== lowerEmail));
    setSelectedMemberEmail(null);
    if (!isMockSession) {
      permanentlyDeleteMember(email, user?.email).catch((err) => setSavedMemberDataError(friendlyErrorMessage(err)));
    }
  };

  const handleAddManualMember = (form) => {
    const { member, email, startDate, lastPlan, totalSpent, ...profileFields } = form;
    setManualMembers((prev) => [
      ...prev,
      {
        email,
        member,
        firstPaymentDate: startDate,
        lastPaymentDate: startDate,
        lastPlan,
        totalSpent: Number(totalSpent) || 0,
        paymentCount: 0,
      },
    ]);
    handleSaveMemberProfile(email, { ...profileFields, moneyOwed: Number(profileFields.moneyOwed) || 0 });
    if (!isMockSession) {
      insertManualMember({ member, email, startDate, lastPlan, totalSpent }).catch((err) => setSavedMemberDataError(friendlyErrorMessage(err)));
    }
  };

  // Cert Calendar - real Supabase data for a real session (RLS grants admins
  // full visibility regardless of status via is_admin()), small local mock
  // roster under Mock Admin since there's no real session to fetch from.
  // Members can also add their own entry from their own Cert Calendar view
  // (024_cert_calendar.sql) - those show up here too.
  const [certs, setCerts] = useState(isMockSession ? [
    { id: 1, member: 'Sanele Khumalo', cert: 'OSCP Penetration Tester', date: '2026-09-12', cohort: 'OSCP-26B', result: 'Pending' },
    { id: 2, member: 'Nonhlanhla Sindane', cert: 'CompTIA Security+', date: '2026-08-28', cohort: 'SecPlus-Aug', result: 'Pending' },
    { id: 3, member: 'Khody Netshifhefhe', cert: 'eLearnSecurity eCPPT', date: '2026-10-05', cohort: 'eCPPT-Intro', result: 'Pending' },
    { id: 4, member: 'Joshua Harrop', cert: 'Microsoft Azure Security (AZ-500)', date: '2026-09-01', cohort: 'Azure-Q3', result: 'Pending' },
    { id: 5, member: 'Thabo Ndlovu', cert: 'OSCP Penetration Tester', date: '2026-08-02', cohort: 'OSCP-26A', result: 'Passed' },
    { id: 6, member: 'Palesa Dlamini', cert: 'CompTIA Security+', date: '2026-07-15', cohort: 'SecPlus-Jul', result: 'Passed' },
  ] : []);
  const [loadingCerts, setLoadingCerts] = useState(!isMockSession);
  const [certsError, setCertsError] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchCertCalendar()
      .then((data) => !cancelled && setCerts(data))
      .catch((err) => !cancelled && setCertsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingCerts(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const [newCert, setNewCert] = useState({ member: '', cert: '', date: '', cohort: '', memberEmail: '' });

  const handleAddCert = async (e) => {
    e.preventDefault();
    if (!newCert.member || !newCert.cert || !newCert.date) return;
    if (isMockSession) {
      setCerts([
        ...certs,
        {
          id: Math.max(0, ...certs.map((c) => c.id)) + 1,
          member: newCert.member,
          cert: newCert.cert,
          date: newCert.date,
          cohort: newCert.cohort || 'General',
          result: 'Pending',
          memberEmail: newCert.memberEmail,
        },
      ]);
    } else {
      try {
        await addCertCalendarEntry({ member: newCert.member, cert: newCert.cert, date: newCert.date, cohort: newCert.cohort, createdBy: user?.email, memberEmail: newCert.memberEmail });
        setCerts(await fetchCertCalendar());
      } catch (err) {
        setCertsError(friendlyErrorMessage(err));
        return;
      }
    }
    setNewCert({ member: '', cert: '', date: '', cohort: '', memberEmail: '' });
  };

  const handleUpdateCertResult = async (id, result) => {
    const cert = certs.find((c) => c.id === id);
    const justPassed = result === 'Passed' && cert?.result !== 'Passed';
    setCerts(certs.map(c => c.id === id ? { ...c, result } : c));
    if (!isMockSession) {
      try {
        await updateCertCalendarResult(id, result);
      } catch (err) {
        setCertsError(friendlyErrorMessage(err));
      }
    }
    if (justPassed && cert) announceCertWin({ ...cert, result });
  };

  const [editingCertId, setEditingCertId] = useState(null);
  const [editCertForm, setEditCertForm] = useState({ member: '', cert: '', date: '', cohort: '', result: 'Pending', memberEmail: '' });

  const startEditCert = (c) => {
    setEditingCertId(c.id);
    setEditCertForm({ member: c.member, cert: c.cert, date: c.date, cohort: c.cohort || '', result: c.result || 'Pending', memberEmail: c.memberEmail || '' });
  };

  const handleSaveCertEdit = async (cert) => {
    const updated = { ...cert, ...editCertForm };
    const justPassed = updated.result === 'Passed' && cert.result !== 'Passed';
    if (isMockSession) {
      setCerts(certs.map((c) => (c.id === cert.id ? updated : c)));
    } else {
      try {
        await updateCertCalendarEntry(cert.id, editCertForm);
        setCerts(certs.map((c) => (c.id === cert.id ? updated : c)));
      } catch (err) {
        setCertsError(friendlyErrorMessage(err));
        return;
      }
    }
    setEditingCertId(null);
    if (justPassed) announceCertWin(updated);
  };

  const handleDeleteCert = async (cert) => {
    setCerts(certs.filter((c) => c.id !== cert.id));
    if (selectedCert?.id === cert.id) setSelectedCert(null);
    if (!isMockSession) {
      try {
        await deleteCertCalendarEntry(cert.id);
      } catch (err) {
        setCertsError(friendlyErrorMessage(err));
        setCerts((prev) => [...prev, cert]);
      }
    }
  };

  // Business Expenses - the money-out side of the Finances tab, admin-only
  // (no member-facing equivalent, unlike Cert Calendar). Mock Admin has no
  // Supabase session, so it starts with a small local demo set instead.
  const [expenses, setExpenses] = useState(isMockSession ? [
    { id: 1, category: 'Staff', description: 'Siya - August coaching hours', amount: 4500, date: '2026-08-01' },
    { id: 2, category: 'Hosting / Infrastructure', description: 'Supabase Pro plan', amount: 450, date: '2026-08-03' },
    { id: 3, category: 'Tools & Software', description: 'Notion team seats', amount: 320, date: '2026-08-05' },
  ] : []);
  const [loadingExpenses, setLoadingExpenses] = useState(!isMockSession);
  const [expensesError, setExpensesError] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchExpenses()
      .then((data) => !cancelled && setExpenses(data))
      .catch((err) => !cancelled && setExpensesError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingExpenses(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const EXPENSE_CATEGORIES = ['Tools & Software', 'Staff', 'Marketing', 'Hosting / Infrastructure', 'Events', 'Other'];
  const [newExpense, setNewExpense] = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: '' });

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount || !newExpense.date) return;
    const amount = Number(newExpense.amount);
    if (isMockSession) {
      setExpenses([
        { id: Math.max(0, ...expenses.map((x) => x.id)) + 1, category: newExpense.category, description: newExpense.description, amount, date: newExpense.date },
        ...expenses,
      ]);
    } else {
      try {
        const added = await addExpense({ ...newExpense, amount, createdBy: user?.email });
        setExpenses([added, ...expenses]);
      } catch (err) {
        setExpensesError(friendlyErrorMessage(err));
        return;
      }
    }
    setNewExpense({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: '' });
  };

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editExpenseForm, setEditExpenseForm] = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: '' });

  const startEditExpense = (x) => {
    setEditingExpenseId(x.id);
    setEditExpenseForm({ category: x.category, description: x.description, amount: String(x.amount), date: x.date });
  };

  const handleSaveExpenseEdit = async (expense) => {
    const updated = { ...expense, ...editExpenseForm, amount: Number(editExpenseForm.amount) };
    if (isMockSession) {
      setExpenses(expenses.map((x) => (x.id === expense.id ? updated : x)));
    } else {
      try {
        await updateExpense(expense.id, { ...editExpenseForm, amount: Number(editExpenseForm.amount) });
        setExpenses(expenses.map((x) => (x.id === expense.id ? updated : x)));
      } catch (err) {
        setExpensesError(friendlyErrorMessage(err));
        return;
      }
    }
    setEditingExpenseId(null);
  };

  const handleDeleteExpense = async (expense) => {
    setExpenses(expenses.filter((x) => x.id !== expense.id));
    if (!isMockSession) {
      try {
        await deleteExpense(expense.id);
      } catch (err) {
        setExpensesError(friendlyErrorMessage(err));
        setExpenses((prev) => [...prev, expense]);
      }
    }
  };

  // Admin-side Job Board management - job_board previously had no admin UI
  // at all (members self-submit, listings go live immediately, no
  // moderation step - see 025_job_board.sql). This lets an admin post one
  // directly too, e.g. copying in a role that came in via the "share a
  // link" submission form instead of through a member's own portal login.
  // Reuses the exact same fetch/add functions the member Job Board tab
  // already calls (RLS already grants admins full CRUD, "admins manage job
  // board"), plus a new deleteJobListing (jobBoardData.js) since nothing on
  // the member side ever needed to delete a listing before.
  const JOB_TYPES = ['Full-Time', 'Contract', 'Internship'];
  const [jobListings, setJobListings] = useState(isMockSession ? [
    { id: 1, title: 'SOC Analyst (Junior)', company: 'Nclose', location: 'Johannesburg (Hybrid)', type: 'Full-Time', salary: 'R18,000 – R25,000 / month', description: 'Entry-level SOC role monitoring alerts and triaging incidents.', tags: ['Blue Team', 'Entry Level'], link: '', posted: '2026-08-01' },
  ] : []);
  const [loadingJobListings, setLoadingJobListings] = useState(!isMockSession);
  const [jobListingsError, setJobListingsError] = useState(null);
  const [showAddJobForm, setShowAddJobForm] = useState(false);
  const [newJob, setNewJob] = useState({ title: '', company: '', location: '', type: JOB_TYPES[0], salary: '', description: '', tags: '', link: '' });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchJobBoard()
      .then((data) => !cancelled && setJobListings(data))
      .catch((err) => !cancelled && setJobListingsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingJobListings(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const handleAddJob = async (e) => {
    e.preventDefault();
    if (!newJob.title || !newJob.company) return;
    if (isMockSession) {
      setJobListings([
        { id: Date.now(), ...newJob, tags: newJob.tags.split(',').map((t) => t.trim()).filter(Boolean), posted: new Date().toISOString().slice(0, 10) },
        ...jobListings,
      ]);
    } else {
      try {
        const added = await addJobListing({ ...newJob, createdBy: user?.email });
        setJobListings([added, ...jobListings]);
      } catch (err) {
        setJobListingsError(friendlyErrorMessage(err));
        return;
      }
    }
    setNewJob({ title: '', company: '', location: '', type: JOB_TYPES[0], salary: '', description: '', tags: '', link: '' });
    setShowAddJobForm(false);
  };

  const handleDeleteJob = async (job) => {
    setJobListings(jobListings.filter((j) => j.id !== job.id));
    if (!isMockSession) {
      try {
        await deleteJobListing(job.id);
      } catch (err) {
        setJobListingsError(friendlyErrorMessage(err));
        setJobListings((prev) => [...prev, job]);
      }
    }
  };

  // Focus 5 - see supabase/038_focus_five.sql / src/lib/focusFiveData.js.
  const FOCUS_FIVE_MAX = 5;
  const [focusFive, setFocusFive] = useState(isMockSession ? MOCK_FOCUS_FIVE : []);
  const [loadingFocusFive, setLoadingFocusFive] = useState(!isMockSession);
  const [focusFiveError, setFocusFiveError] = useState(null);
  const [editingFocusFive, setEditingFocusFive] = useState(false);
  const [focusFiveSearch, setFocusFiveSearch] = useState('');

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchFocusFive()
      .then((data) => !cancelled && setFocusFive(data))
      .catch((err) => !cancelled && setFocusFiveError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingFocusFive(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const handleAddToFocusFive = async (email) => {
    if (focusFive.length >= FOCUS_FIVE_MAX || focusFive.some((f) => f.memberEmail.toLowerCase() === email.toLowerCase())) return;
    const optimistic = { id: email, memberEmail: email.toLowerCase(), addedAt: new Date().toISOString() };
    setFocusFive([...focusFive, optimistic]);
    if (isMockSession) return;
    try {
      await addToFocusFive(email);
    } catch (err) {
      setFocusFiveError(friendlyErrorMessage(err));
      setFocusFive((prev) => prev.filter((f) => f.memberEmail.toLowerCase() !== email.toLowerCase()));
    }
  };

  const handleRemoveFromFocusFive = async (email) => {
    const previous = focusFive;
    setFocusFive(focusFive.filter((f) => f.memberEmail.toLowerCase() !== email.toLowerCase()));
    if (isMockSession) return;
    try {
      await removeFromFocusFive(email);
    } catch (err) {
      setFocusFiveError(friendlyErrorMessage(err));
      setFocusFive(previous);
    }
  };

  // Jumps straight to a member's roadmap from anywhere in this component
  // (Focus 5's own card) - mirrors exactly what clicking a row in the
  // Roadmaps tab's own member picker does.
  const jumpToMemberRoadmap = (email) => {
    loadRoadmapForMember(email);
    setActiveTab('roadmaps');
  };

  // Community Broadcast & Recent Wins - the Dashboard content admins curate,
  // real Supabase data for a real session, local-only demo state under Mock
  // Admin. Both used to be hardcoded arrays in MemberPortal.jsx.
  const [broadcasts, setBroadcasts] = useState(isMockSession ? [
    { id: 1, emoji: '🤝', title: 'Matchmaker is live:', body: 'Opt in and get randomly grouped with 1-3 other members for a project or presentation.', sortOrder: 10, active: true },
  ] : []);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(!isMockSession);
  const [broadcastsError, setBroadcastsError] = useState(null);
  const [newBroadcast, setNewBroadcast] = useState({ emoji: '', title: '', body: '', sortOrder: '' });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAllCommunityBroadcasts()
      .then((data) => !cancelled && setBroadcasts(data))
      .catch((err) => !cancelled && setBroadcastsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingBroadcasts(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const handleAddBroadcast = async (e) => {
    e.preventDefault();
    if (!newBroadcast.title.trim() || !newBroadcast.body.trim()) return;
    const payload = { emoji: newBroadcast.emoji.trim(), title: newBroadcast.title.trim(), body: newBroadcast.body.trim(), sortOrder: Number(newBroadcast.sortOrder) || 0 };
    if (isMockSession) {
      setBroadcasts([...broadcasts, { id: Date.now(), ...payload, active: true }].sort((a, b) => a.sortOrder - b.sortOrder));
    } else {
      try {
        const added = await addCommunityBroadcast({ ...payload, createdBy: user?.email });
        setBroadcasts([...broadcasts, added].sort((a, b) => a.sortOrder - b.sortOrder));
      } catch (err) {
        setBroadcastsError(friendlyErrorMessage(err));
        return;
      }
    }
    setNewBroadcast({ emoji: '', title: '', body: '', sortOrder: '' });
  };

  const [editingBroadcastId, setEditingBroadcastId] = useState(null);
  const [editBroadcastForm, setEditBroadcastForm] = useState({ emoji: '', title: '', body: '', sortOrder: '', active: true });

  const startEditBroadcast = (b) => {
    setEditingBroadcastId(b.id);
    setEditBroadcastForm({ emoji: b.emoji, title: b.title, body: b.body, sortOrder: String(b.sortOrder), active: b.active });
  };

  const handleSaveBroadcastEdit = async (broadcast) => {
    const payload = { emoji: editBroadcastForm.emoji.trim(), title: editBroadcastForm.title.trim(), body: editBroadcastForm.body.trim(), sortOrder: Number(editBroadcastForm.sortOrder) || 0, active: editBroadcastForm.active };
    if (isMockSession) {
      setBroadcasts(broadcasts.map((b) => (b.id === broadcast.id ? { ...b, ...payload } : b)));
    } else {
      try {
        await updateCommunityBroadcast(broadcast.id, payload);
        setBroadcasts(broadcasts.map((b) => (b.id === broadcast.id ? { ...b, ...payload } : b)));
      } catch (err) {
        setBroadcastsError(friendlyErrorMessage(err));
        return;
      }
    }
    setEditingBroadcastId(null);
  };

  const handleDeleteBroadcast = async (broadcast) => {
    setBroadcasts(broadcasts.filter((b) => b.id !== broadcast.id));
    if (!isMockSession) {
      try {
        await deleteCommunityBroadcast(broadcast.id);
      } catch (err) {
        setBroadcastsError(friendlyErrorMessage(err));
        setBroadcasts((prev) => [...prev, broadcast]);
      }
    }
  };

  const [wins, setWins] = useState(isMockSession ? [
    { id: 1, member: 'Philisiwe N.', achievement: 'earned SC-900: Security, Compliance & Identity Fundamentals', achievedDate: '2026-08-20', linkedinUrl: '', active: true },
  ] : []);
  const [loadingWins, setLoadingWins] = useState(!isMockSession);
  const [winsError, setWinsError] = useState(null);
  const [newWin, setNewWin] = useState({ member: '', achievement: '', achievedDate: '', linkedinUrl: '' });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAllCommunityWins()
      .then((data) => !cancelled && setWins(data))
      .catch((err) => !cancelled && setWinsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingWins(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const handleAddWin = async (e) => {
    e.preventDefault();
    if (!newWin.member.trim() || !newWin.achievement.trim() || !newWin.achievedDate) return;
    const payload = { member: newWin.member.trim(), achievement: newWin.achievement.trim(), achievedDate: newWin.achievedDate, linkedinUrl: newWin.linkedinUrl.trim() };
    if (isMockSession) {
      setWins([{ id: Date.now(), ...payload, active: true }, ...wins].sort((a, b) => new Date(b.achievedDate) - new Date(a.achievedDate)));
    } else {
      try {
        const added = await addCommunityWin({ ...payload, createdBy: user?.email });
        setWins([added, ...wins].sort((a, b) => new Date(b.achievedDate) - new Date(a.achievedDate)));
      } catch (err) {
        setWinsError(friendlyErrorMessage(err));
        return;
      }
    }
    setNewWin({ member: '', achievement: '', achievedDate: '', linkedinUrl: '' });
  };

  // Fires the moment a cert calendar entry is marked Passed, so a Recent Win
  // announcement doesn't depend on an admin remembering to add one by hand.
  // Uses the exam date as achievedDate (when the pass actually happened, not
  // whenever someone got around to marking it) - same as every other seeded win.
  const announceCertWin = async (cert) => {
    const payload = {
      member: cert.member,
      achievement: `passed ${cert.cert}`,
      achievedDate: cert.date,
      linkedinUrl: '',
    };
    if (isMockSession) {
      setWins((prev) => [{ id: Date.now(), ...payload, active: true }, ...prev].sort((a, b) => new Date(b.achievedDate) - new Date(a.achievedDate)));
    } else {
      try {
        const added = await addCommunityWin({ ...payload, createdBy: user?.email });
        setWins((prev) => [added, ...prev].sort((a, b) => new Date(b.achievedDate) - new Date(a.achievedDate)));
      } catch (err) {
        setWinsError(friendlyErrorMessage(err));
      }
    }
  };

  const [editingWinId, setEditingWinId] = useState(null);
  const [editWinForm, setEditWinForm] = useState({ member: '', achievement: '', achievedDate: '', linkedinUrl: '', active: true });

  const startEditWin = (w) => {
    setEditingWinId(w.id);
    setEditWinForm({ member: w.member, achievement: w.achievement, achievedDate: w.achievedDate, linkedinUrl: w.linkedinUrl, active: w.active });
  };

  const handleSaveWinEdit = async (win) => {
    const payload = { member: editWinForm.member.trim(), achievement: editWinForm.achievement.trim(), achievedDate: editWinForm.achievedDate, linkedinUrl: editWinForm.linkedinUrl.trim(), active: editWinForm.active };
    if (isMockSession) {
      setWins(wins.map((w) => (w.id === win.id ? { ...w, ...payload } : w)));
    } else {
      try {
        await updateCommunityWin(win.id, payload);
        setWins(wins.map((w) => (w.id === win.id ? { ...w, ...payload } : w)));
      } catch (err) {
        setWinsError(friendlyErrorMessage(err));
        return;
      }
    }
    setEditingWinId(null);
  };

  const handleDeleteWin = async (win) => {
    setWins(wins.filter((w) => w.id !== win.id));
    if (!isMockSession) {
      try {
        await deleteCommunityWin(win.id);
      } catch (err) {
        setWinsError(friendlyErrorMessage(err));
        setWins((prev) => [...prev, win]);
      }
    }
  };

  // Suggested Content - real Supabase data for a real session, local-only
  // demo state under Mock Admin. Replaces the member Dashboard's old
  // "Billing Info" card, which was a blurred "Under Construction" stub.
  const [suggestions, setSuggestions] = useState(isMockSession ? [
    { id: 1, contentType: 'Article', title: 'What hiring managers actually look for on a junior SOC CV', url: '', active: true },
  ] : []);
  const [loadingSuggestions, setLoadingSuggestions] = useState(!isMockSession);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [newSuggestion, setNewSuggestion] = useState({ contentType: 'Video', title: '', url: '' });

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchAllSuggestedContent()
      .then((data) => !cancelled && setSuggestions(data))
      .catch((err) => !cancelled && setSuggestionsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingSuggestions(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const handleAddSuggestion = async (e) => {
    e.preventDefault();
    if (!newSuggestion.title.trim() || !newSuggestion.url.trim()) return;
    const payload = { contentType: newSuggestion.contentType, title: newSuggestion.title.trim(), url: newSuggestion.url.trim() };
    if (isMockSession) {
      setSuggestions([{ id: Date.now(), ...payload, active: true }, ...suggestions]);
    } else {
      try {
        const added = await addSuggestedContent({ ...payload, createdBy: user?.email });
        setSuggestions([added, ...suggestions]);
      } catch (err) {
        setSuggestionsError(friendlyErrorMessage(err));
        return;
      }
    }
    setNewSuggestion({ contentType: 'Video', title: '', url: '' });
  };

  const [editingSuggestionId, setEditingSuggestionId] = useState(null);
  const [editSuggestionForm, setEditSuggestionForm] = useState({ contentType: 'Video', title: '', url: '', active: true });

  const startEditSuggestion = (s) => {
    setEditingSuggestionId(s.id);
    setEditSuggestionForm({ contentType: s.contentType, title: s.title, url: s.url, active: s.active });
  };

  const handleSaveSuggestionEdit = async (suggestion) => {
    const payload = { contentType: editSuggestionForm.contentType, title: editSuggestionForm.title.trim(), url: editSuggestionForm.url.trim(), active: editSuggestionForm.active };
    if (isMockSession) {
      setSuggestions(suggestions.map((s) => (s.id === suggestion.id ? { ...s, ...payload } : s)));
    } else {
      try {
        await updateSuggestedContent(suggestion.id, payload);
        setSuggestions(suggestions.map((s) => (s.id === suggestion.id ? { ...s, ...payload } : s)));
      } catch (err) {
        setSuggestionsError(friendlyErrorMessage(err));
        return;
      }
    }
    setEditingSuggestionId(null);
  };

  const handleDeleteSuggestion = async (suggestion) => {
    setSuggestions(suggestions.filter((s) => s.id !== suggestion.id));
    if (!isMockSession) {
      try {
        await deleteSuggestedContent(suggestion.id);
      } catch (err) {
        setSuggestionsError(friendlyErrorMessage(err));
        setSuggestions((prev) => [...prev, suggestion]);
      }
    }
  };

  // PayFast Transactions - 100% Supabase-sourced for a real session now
  // (both the full historical backfill and everything payfast-webhook has
  // recorded live since - see 033_payfast_transactions.sql). Mock Admin has
  // no Supabase session, so it only ever sees the anonymized fixture data.
  const [payments, setPayments] = useState(isMockSession ? payfastTransactionsMockData : []);
  const [loadingLivePayments, setLoadingLivePayments] = useState(!isMockSession);
  const [livePaymentsError, setLivePaymentsError] = useState(null);

  // This effect and the EFT one below both write to `payments` on every
  // dataRefreshKey bump, with no ordering guarantee between them. Each one
  // only ever replaces its own slice (filtering the other's rows back in
  // rather than clobbering `prev`) so neither can wipe the other out or pile
  // up duplicates across refreshes - EFT-only payers were dropping out of
  // "Active" status whenever this effect happened to resolve last.
  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchPayfastPayments()
      .then((live) => !cancelled && setPayments((prev) => [...live, ...prev.filter((p) => p.fundingType === 'EFT')]))
      .catch((err) => !cancelled && setLivePaymentsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingLivePayments(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  // Loaded once for real admin sessions - Mock Admin has no Supabase session, so
  // these calls would just be rejected by RLS, and edits stay local-only for it.
  const [loadingSavedMemberData, setLoadingSavedMemberData] = useState(!isMockSession);
  const [savedMemberDataError, setSavedMemberDataError] = useState(null);

  // Permanently-deleted member emails - filtered out of every roster built
  // below, regardless of real payment history. Mock Admin has no session to
  // fetch against, so deletions there stay local-only for the session.
  const [deletedEmails, setDeletedEmails] = useState(new Set());

  useEffect(() => {
    if (isMockSession) return; // loadingSavedMemberData already starts false in this case
    let cancelled = false;
    Promise.all([fetchMemberProfiles(), fetchManualMembers(), fetchEftPayments(), fetchDeletedMemberEmails()])
      .then(([profiles, manual, eft, deleted]) => {
        if (cancelled) return;
        setMemberProfiles(profiles);
        setManualMembers(manual);
        setPayments((prev) => [...eft, ...prev.filter((p) => p.fundingType !== 'EFT')]);
        setDeletedEmails(new Set(deleted));
      })
      .catch((err) => !cancelled && setSavedMemberDataError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingSavedMemberData(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  // Reviews/feedback - admins see everything (RLS grants full access), including
  // reviews members marked private, which is the whole point of that option existing.
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(!isMockSession);
  const [reviewsError, setReviewsError] = useState(null);
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState('All');

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchReviews()
      .then((data) => !cancelled && setReviews(data))
      .catch((err) => !cancelled && setReviewsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingReviews(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  // Member-submitted events awaiting approval (019_events.sql) - admins can
  // see every event regardless of status via their own RLS policy, filtered
  // down to Pending here. Approval itself is further restricted server-side
  // to exactly siya@hackinghub.co.za, not every admin account.
  const [communityEvents, setCommunityEvents] = useState([]);
  const [loadingCommunityEvents, setLoadingCommunityEvents] = useState(!isMockSession);
  const [approvingEventId, setApprovingEventId] = useState(null);
  const [approveEventError, setApproveEventError] = useState(null);
  const [selectedPendingEvent, setSelectedPendingEvent] = useState(null);
  const canApproveEvents = (user?.email || '').toLowerCase() === 'siya@hackinghub.co.za';

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchCommunityEvents()
      .then((data) => !cancelled && setCommunityEvents(data))
      .catch(() => {})
      .finally(() => !cancelled && setLoadingCommunityEvents(false));
    return () => { cancelled = true; };
  }, [isMockSession, dataRefreshKey]);

  const pendingCommunityEvents = communityEvents.filter((e) => e.status === 'Pending');
  // The exact same approved events the member-side Events tab shows -
  // already sorted soonest-first by fetchCommunityEvents()'s own query.
  const liveCommunityEvents = communityEvents.filter((e) => e.status === 'Approved');

  const handleApproveEvent = async (eventId) => {
    setApprovingEventId(eventId);
    setApproveEventError(null);
    try {
      await approveCommunityEvent(eventId);
      setCommunityEvents(await fetchCommunityEvents());
    } catch (err) {
      setApproveEventError(friendlyErrorMessage(err));
    } finally {
      setApprovingEventId(null);
    }
  };

  const [rejectingEventId, setRejectingEventId] = useState(null);

  // Rejecting = deleting the pending submission outright, not a tracked
  // 'Rejected' status - there's nowhere in the member's own Events tab that
  // would meaningfully show a rejected submission, so there's nothing to
  // preserve by keeping the row around.
  const handleRejectEvent = async (eventId) => {
    if (!window.confirm('Reject and permanently remove this event submission?')) return false;
    setRejectingEventId(eventId);
    setApproveEventError(null);
    try {
      if (isMockSession) {
        setCommunityEvents((prev) => prev.filter((e) => e.id !== eventId));
      } else {
        await deleteCommunityEvent(eventId);
        setCommunityEvents(await fetchCommunityEvents());
      }
      return true;
    } catch (err) {
      setApproveEventError(friendlyErrorMessage(err));
      return true;
    } finally {
      setRejectingEventId(null);
    }
  };

  // Admin-side "Add Event" - this tab could only approve/reject events
  // members already submitted, with no way for an admin to create one
  // directly. Reuses createCommunityEvent exactly as the member Events tab
  // does (self-attributed to the admin's own email, lands 'Pending'
  // server-side same as any submission), then immediately approves it if
  // this admin is allowed to (canApproveEvents, above) - the event is
  // already saved either way, so if this admin can't auto-approve it just
  // sits in the same Pending queue below for whoever can.
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ type: 'HH Meetup', title: '', description: '', date: '', time: '', location: '', link: '' });
  const [addingEvent, setAddingEvent] = useState(false);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) return;
    setAddingEvent(true);
    setApproveEventError(null);
    try {
      const created = await createCommunityEvent({ ...newEvent, createdBy: user?.email });
      if (canApproveEvents) {
        await approveCommunityEvent(created.id);
      }
      setCommunityEvents(await fetchCommunityEvents());
      setNewEvent({ type: 'HH Meetup', title: '', description: '', date: '', time: '', location: '', link: '' });
      setShowAddEventForm(false);
    } catch (err) {
      setApproveEventError(friendlyErrorMessage(err));
    } finally {
      setAddingEvent(false);
    }
  };

  const [showEftModal, setShowEftModal] = useState(false);

  // EFT payments land straight in the same `payments` list as PayFast transactions,
  // tagged with fundingType 'EFT' - so revenue totals, the audit table, and each
  // member's spend all pick them up automatically, no separate accounting needed.
  const handleRecordEftPayment = async (form) => {
    const amount = Number(form.amount) || 0;
    const basePayment = {
      pfId: `EFT-${form.bankReference.trim() || Date.now()}`,
      member: form.member.trim(),
      email: form.email.trim(),
      type: 'Funds Received',
      plan: form.plan,
      amount,
      fee: 0,
      net: amount,
      fundingType: 'EFT',
      date: `${form.date} 00:00`,
      status: 'COMPLETE',
      bankReference: form.bankReference || undefined,
      notes: form.notes || undefined,
    };
    if (isMockSession) {
      setPayments((prev) => [{ id: Date.now(), ...basePayment }, ...prev]);
      return;
    }
    try {
      const saved = await insertEftPayment(basePayment);
      setPayments((prev) => [saved, ...prev]);
      // Grants/reactivates portal access for whoever this payment is for -
      // previously this required a separate manual step (or was missed
      // entirely). The payment itself is already saved at this point, so a
      // grant failure surfaces as a warning rather than losing the payment.
      try {
        await grantMemberPortalAccess(basePayment.email, basePayment.member);
      } catch (grantErr) {
        setSavedMemberDataError(
          `Payment saved, but granting portal access to ${basePayment.member} failed - check the Members tab: ${friendlyErrorMessage(grantErr)}`
        );
      }
    } catch (err) {
      setSavedMemberDataError(friendlyErrorMessage(err));
    }
  };

  // EFT rows are admin-entered, not a real gateway record like PayFast, so
  // deleting one just corrects a mistake (e.g. a duplicate entry) rather than
  // hiding a real charge - PayFast-sourced rows deliberately have no delete
  // path here for that reason. `payment.id` is the mapped `10000 + real id`
  // from fetchEftPayments/insertEftPayment, so it has to be un-offset before
  // hitting the table.
  const handleDeleteEftPayment = async (payment) => {
    if (!window.confirm(`Delete this EFT payment of R${payment.amount.toFixed(2)} from ${payment.member}? This can't be undone.`)) return;
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    if (!isMockSession) {
      try {
        await deleteEftPayment(payment.id - 10000);
      } catch (err) {
        setSavedMemberDataError(friendlyErrorMessage(err));
        setPayments((prev) => [payment, ...prev]);
      }
    }
  };

  // Anchored to the PayFast export's "as-of" date, so trend/renewal math stays
  // consistent with the transaction data rather than drifting with wall-clock time.
  const today = new Date('2026-08-07');

  // The real wall-clock date, for windows that need to genuinely track "now" -
  // upcoming renewal countdowns and rolling revenue windows (MRR, weekly) -
  // rather than the frozen export-date anchor above. Live/EFT payments are
  // recorded with real dates, so measuring "trailing 30 days" or "days until
  // renewal" against the frozen anchor made those tiles drift stale instead
  // of updating as new transactions came in.
  const realNow = new Date();

  // "Passed" is only counted once someone has explicitly marked the result - an
  // exam date simply being in the past doesn't mean it was taken, let alone passed.
  const certsPassedThisMonth = certs.filter(c => {
    if (c.result !== 'Passed') return false;
    const d = new Date(c.date);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }).length;
  const certsPassedThisYear = certs.filter(c => {
    if (c.result !== 'Passed') return false;
    return new Date(c.date).getFullYear() === today.getFullYear();
  }).length;

  // PayFast Financial Metrics
  const totalGrossRevenue = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalFeesPaid = payments.reduce((acc, p) => acc + (p.fee || 0), 0);
  const totalNetRevenue = payments.reduce((acc, p) => acc + (p.net || (p.amount - (p.fee || 0))), 0);
  const totalTransactions = payments.length;

  const emailsPaidBetween = (start, end) => new Set(
    payments
      .filter(p => p.type === 'Funds Received' && new Date(p.date) >= start && new Date(p.date) < end)
      .map(p => p.email.toLowerCase())
  );

  // Recurring revenue run-rate: Basic Access + Monthly Operative payments in the trailing 30 days
  const last30DaysStart = new Date(realNow.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthlyRecurringRevenue = payments
    .filter(p => (p.plan === 'Monthly Operative' || p.plan === 'Basic Access') && new Date(p.date) >= last30DaysStart)
    .reduce((acc, p) => acc + p.amount, 0);

  // Monthly churn = last full month's payers who didn't pay again the following month
  const lastFullMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const twoMonthsAgoStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const priorMonthPayers = emailsPaidBetween(twoMonthsAgoStart, lastFullMonthStart);
  const lastMonthPayers = emailsPaidBetween(lastFullMonthStart, today);
  const churnedCount = [...priorMonthPayers].filter(email => !lastMonthPayers.has(email)).length;
  const monthlyChurnRate = priorMonthPayers.size ? (churnedCount / priorMonthPayers.size) * 100 : 0;
  const churnMonthLabel = `${twoMonthsAgoStart.toLocaleDateString('en-ZA', { month: 'short' })} → ${lastFullMonthStart.toLocaleDateString('en-ZA', { month: 'short' })}`;

  // All-time paying members & average revenue per member
  const allTimeMemberEmails = new Set(
    payments.filter(p => p.type === 'Funds Received').map(p => p.email.toLowerCase())
  );
  const avgRevenuePerMember = allTimeMemberEmails.size ? totalGrossRevenue / allTimeMemberEmails.size : 0;

  // Repeat payment rate: share of members who have paid more than once
  const paymentCountsByEmail = payments
    .filter(p => p.type === 'Funds Received')
    .reduce((acc, p) => {
      const key = p.email.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const repeatPayerCount = Object.values(paymentCountsByEmail).filter(n => n > 1).length;
  const repeatPaymentRate = allTimeMemberEmails.size ? (repeatPayerCount / allTimeMemberEmails.size) * 100 : 0;

  // Monthly gross revenue trend, split by funding source, computed directly
  // from the transaction history (PayFast card payments vs. manually-recorded
  // EFT bank transfers).
  const revenueTrendMonths = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  const revenueTrend = revenueTrendMonths.map(month => {
    const monthPayments = payments.filter(p => p.type === 'Funds Received' && p.date.startsWith(month));
    const payfast = monthPayments.filter(p => p.fundingType !== 'EFT').reduce((acc, p) => acc + p.amount, 0);
    const eft = monthPayments.filter(p => p.fundingType === 'EFT').reduce((acc, p) => acc + p.amount, 0);
    return {
      month,
      label: new Date(`${month}-01`).toLocaleDateString('en-ZA', { month: 'short' }),
      payfast,
      eft,
      total: payfast + eft,
    };
  });
  const revenueTrendMax = Math.max(...revenueTrend.map(m => m.total), 1);
  // Round the axis top up to a clean step so the y-axis ticks read as round
  // numbers (R5,000 / R10,000 / ...) instead of an arbitrary max value.
  const revenueTrendStep = revenueTrendMax <= 5000 ? 1000 : revenueTrendMax <= 20000 ? 5000 : revenueTrendMax <= 50000 ? 10000 : 20000;
  const revenueTrendNiceMax = Math.max(revenueTrendStep, Math.ceil(revenueTrendMax / revenueTrendStep) * revenueTrendStep);

  const filteredPayments = payments
    .filter(p =>
      p.member.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.pfId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.plan.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Member roster: one row per distinct payer, aggregated from the real transaction
  // history (name, email, tenure, plan, and total spend). Demographic/profile fields
  // (age, location, specialty, etc.) come from `memberProfiles` if the admin has filled
  // them in, since they have no source in the PayFast data.
  const memberRosterMap = new Map();
  payments
    .filter(p => (p.type === 'Funds Received' || p.type === 'Funds Received (Reversal)') && !deletedEmails.has(p.email.toLowerCase()))
    .forEach(p => {
      const key = p.email.toLowerCase();
      const entry = memberRosterMap.get(key) || {
        email: p.email,
        member: p.member,
        firstPaymentDate: p.date,
        lastPaymentDate: p.date,
        lastPlan: p.plan,
        totalSpent: 0,
        paymentCount: 0,
      };
      if (new Date(p.date) < new Date(entry.firstPaymentDate)) {
        entry.firstPaymentDate = p.date;
      }
      if (new Date(p.date) >= new Date(entry.lastPaymentDate)) {
        entry.lastPaymentDate = p.date;
        entry.lastPlan = p.plan;
        entry.member = p.member;
      }
      entry.totalSpent += p.amount;
      if (p.type === 'Funds Received') entry.paymentCount += 1;
      memberRosterMap.set(key, entry);
    });

  // Manually-added members fill in anyone with no PayFast payment yet. If an email
  // already exists from real transactions, the real data wins.
  manualMembers.forEach(m => {
    const key = m.email.toLowerCase();
    if (!memberRosterMap.has(key) && !deletedEmails.has(key)) memberRosterMap.set(key, m);
  });

  // Real members exist who are allowlisted (a real member_profiles row, real
  // portal access) but have neither a PayFast payment nor a manual-member
  // entry - without this pass they're invisible in every admin member list
  // (Roadmaps, Matchmaker, Room Logs, Referrals), even though they can sign
  // in and use the app right now. firstPaymentDate/lastPaymentDate stay null
  // rather than a fabricated date - handled explicitly below and in
  // MemberProfileModal rather than defaulted to something misleading.
  Object.entries(memberProfiles).forEach(([email, profile]) => {
    if (memberRosterMap.has(email) || deletedEmails.has(email)) return;
    memberRosterMap.set(email, {
      email,
      member: profile.fullName || email,
      firstPaymentDate: null,
      lastPaymentDate: null,
      lastPlan: 'No Payment Yet',
      totalSpent: 0,
      paymentCount: 0,
    });
  });

  const memberRoster = [...memberRosterMap.values()]
    .map(m => {
      const profile = memberProfiles[m.email.toLowerCase()] || null;
      const daysSinceLastPayment = m.lastPaymentDate
        ? Math.floor((today - new Date(m.lastPaymentDate)) / (1000 * 60 * 60 * 24))
        : null;
      const status = profile?.status === 'Left'
        ? 'Left'
        : profile?.status === 'Leaving'
        ? 'Leaving'
        : profile?.status === 'Active (Permanent)'
        ? 'Active'
        : (daysSinceLastPayment !== null && daysSinceLastPayment > LAPSED_AFTER_DAYS) ? 'Lapsed' : 'Active';
      return {
        ...m,
        monthsInHH: m.firstPaymentDate ? Math.max(0, Math.round((today - new Date(m.firstPaymentDate)) / (1000 * 60 * 60 * 24 * 30))) : 0,
        profile,
        status,
        lastMeetingDate: lastMeetingByEmail[m.email.toLowerCase()] || null,
      };
    })
    .sort((a, b) => new Date(b.lastPaymentDate) - new Date(a.lastPaymentDate));

  const filteredMemberRoster = memberRoster.filter(m =>
    (m.member.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearchQuery.toLowerCase())) &&
    (memberStatusFilter === 'all' || m.status === memberStatusFilter)
  );

  const memberStatusCounts = memberRoster.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});

  // Onboarding checklist progress, keyed by lowercased email - feeds the
  // "New Members Onboarding" queue on the Members tab below.
  const onboardingProgressByEmail = allOnboardingSteps.reduce((acc, row) => {
    const key = row.member_email.toLowerCase();
    acc[key] = acc[key] || {};
    acc[key][row.step_key] = row.completed_at;
    return acc;
  }, {});

  // Only members who joined recently and haven't finished the checklist -
  // without this window the queue would list the entire multi-year active
  // roster at "0/6 done" forever, since checklist rows only exist from when
  // this feature shipped onward. "Joined" falls back to onboarded_at (first
  // login) for allowlist-only members who have no payment at all.
  const ONBOARDING_QUEUE_WINDOW_DAYS = 30;
  const newMembersOnboarding = memberRoster
    .filter((m) => m.status === 'Active')
    .map((m) => {
      const steps = onboardingProgressByEmail[m.email.toLowerCase()] || {};
      const doneCount = ONBOARDING_STEPS.filter((s) => !!steps[s.key]).length;
      const joinedAt = m.firstPaymentDate || m.profile?.onboardedAt || null;
      const daysSinceJoined = joinedAt ? Math.floor((today - new Date(joinedAt)) / (1000 * 60 * 60 * 24)) : null;
      return { member: m, doneCount, steps, daysSinceJoined };
    })
    .filter(({ doneCount, daysSinceJoined }) => doneCount < ONBOARDING_STEPS.length && daysSinceJoined !== null && daysSinceJoined <= ONBOARDING_QUEUE_WINDOW_DAYS)
    .sort((a, b) => a.doneCount - b.doneCount);

  // Most recent roadmap item touch per member, keyed by lowercased email -
  // feeds the "Stale Roadmaps" queue below. Same threshold the member's own
  // dashboard banner uses (ROADMAP_STALE_AFTER_DAYS), so both sides agree on
  // what "gone quiet" means.
  const roadmapLastTouchedByEmail = allRoadmapItems.reduce((acc, item) => {
    const key = item.memberEmail.toLowerCase();
    if (item.updatedAt && (!acc[key] || new Date(item.updatedAt) > new Date(acc[key]))) acc[key] = item.updatedAt;
    return acc;
  }, {});

  // Excludes members with no roadmap items at all - that's "nothing
  // assigned yet," a different problem from "assigned but gone quiet."
  const staleRoadmaps = memberRoster
    .filter((m) => m.status === 'Active')
    .map((m) => {
      const lastTouchedAt = roadmapLastTouchedByEmail[m.email.toLowerCase()] || null;
      const daysSinceTouch = lastTouchedAt ? Math.floor((today - new Date(lastTouchedAt)) / (1000 * 60 * 60 * 24)) : null;
      return { member: m, daysSinceTouch };
    })
    .filter(({ daysSinceTouch }) => daysSinceTouch !== null && daysSinceTouch >= ROADMAP_STALE_AFTER_DAYS)
    .sort((a, b) => b.daysSinceTouch - a.daysSinceTouch);

  // Counted from an explicit "Date Placed" field, not just who's currently marked
  // Job Placed - that would answer "how many are placed right now", not "this year".
  const jobPlacementsThisYear = memberRoster.filter(m =>
    m.profile?.jobReadiness === 'Job Placed' &&
    m.profile?.jobPlacedDate &&
    new Date(m.profile.jobPlacedDate).getFullYear() === today.getFullYear()
  ).length;

  const selectedMember = selectedMemberEmail
    ? memberRoster.find(m => m.email.toLowerCase() === selectedMemberEmail.toLowerCase())
    : null;

  // RENDER SECTIONS BASED ON ACTIVE TAB
  switch (activeTab) {
    case 'dashboard':
      return (
        <div>
          <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Admin Overview</h1>
              <p>Analytics and growth stats for Hacking Hub, as of your last refresh.</p>
            </div>
            {!isMockSession && (
              <button className="btn btn-secondary" onClick={handleRefreshData} disabled={refreshingData}>
                <RefreshCw size={16} className={refreshingData ? 'animate-spin' : ''} />
                {refreshingData ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="dashboard-grid">
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Active Members</span>
                <Users size={20} color="var(--accent-cyan)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>{memberStatusCounts['Active'] || 0}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>{memberStatusCounts['Lapsed'] || 0} lapsed · {memberStatusCounts['Leaving'] || 0} leaving</span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Monthly Churn Rate</span>
                <TrendingUp size={20} color="var(--danger)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>{monthlyChurnRate.toFixed(1)}%</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>{churnMonthLabel} payers who didn't return</span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Repeat Payment Rate</span>
                <Clock size={20} color="var(--warning)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>{repeatPaymentRate.toFixed(0)}%</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>{repeatPayerCount} of {allTimeMemberEmails.size} members have paid more than once</span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Avg Revenue per Member</span>
                <DollarSign size={20} color="var(--accent-purple)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>R {avgRevenuePerMember.toFixed(0)}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Since Jan 2026, across {allTimeMemberEmails.size} paying members</span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Job Placements This Year</span>
                <Award size={20} color="var(--success)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>{jobPlacementsThisYear}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Members marked "Job Placed" with a {today.getFullYear()} placement date</span>
              </div>
            </div>
          </div>

          {/* Quick Info Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '32px' }}>
            {/* Quick Chart + Expenses by Category, stacked in the same
                (wider) grid column so both live directly under each other
                without disturbing the Administrative Alerts card's own
                column to the right. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>Gross Revenue Trend (ZAR)</h3>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--accent-cyan)', display: 'inline-block', flexShrink: 0 }} />
                    PayFast
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--warning)', display: 'inline-block', flexShrink: 0 }} />
                    EFT
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {/* Y-axis ticks */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '160px', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right', minWidth: '54px' }}>
                  <span>R {revenueTrendNiceMax.toLocaleString('en-ZA')}</span>
                  <span>R {Math.round(revenueTrendNiceMax / 2).toLocaleString('en-ZA')}</span>
                  <span>R 0</span>
                </div>

                {/* Plot area */}
                <div style={{ position: 'relative', flex: 1 }}>
                  {/* Recessive gridlines */}
                  <div style={{ position: 'absolute', inset: 0, height: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                    <div style={{ borderTop: '1px solid var(--border-color)' }} />
                    <div style={{ borderTop: '1px solid var(--border-color)' }} />
                    <div style={{ borderTop: '1px solid var(--border-color)' }} />
                  </div>

                  <div style={{ height: '160px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', position: 'relative' }}>
                    {revenueTrend.map((m) => {
                      const payfastHeight = (m.payfast / revenueTrendNiceMax) * 160;
                      const eftHeight = (m.eft / revenueTrendNiceMax) * 160;
                      const isHovered = hoveredTrendMonth === m.month;
                      return (
                        <div
                          key={m.month}
                          style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}
                          onMouseEnter={() => setHoveredTrendMonth(m.month)}
                          onMouseLeave={() => setHoveredTrendMonth(null)}
                        >
                          {isHovered && (
                            <div
                              role="tooltip"
                              style={{
                                position: 'absolute',
                                bottom: `${payfastHeight + eftHeight + 30}px`,
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--border-radius-sm)',
                                padding: '10px 14px',
                                fontSize: '0.78rem',
                                whiteSpace: 'nowrap',
                                zIndex: 10,
                                boxShadow: 'var(--glass-shadow)',
                              }}
                            >
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{m.label} 2026</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '2px', background: 'var(--accent-cyan)', display: 'inline-block' }} /> PayFast
                                </span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>R {m.payfast.toLocaleString('en-ZA')}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '2px', background: 'var(--warning)', display: 'inline-block' }} /> EFT
                                </span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>R {m.eft.toLocaleString('en-ZA')}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', borderTop: '1px solid var(--border-color)', marginTop: '6px', paddingTop: '6px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Total</span>
                                <span style={{ color: 'var(--success)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>R {m.total.toLocaleString('en-ZA')}</span>
                              </div>
                            </div>
                          )}

                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', fontVariantNumeric: 'tabular-nums' }}>
                            {m.total > 0 ? `R${Math.round(m.total).toLocaleString('en-ZA')}` : 'R 0'}
                          </span>

                          <div style={{ width: '22px', display: 'flex', flexDirection: 'column', filter: isHovered ? 'brightness(1.2)' : 'none', transition: 'filter 0.15s ease' }}>
                            {m.eft > 0 && (
                              <div style={{ width: '100%', height: `${Math.max(eftHeight, 3)}px`, background: 'var(--warning)', borderRadius: '4px 4px 0 0' }} />
                            )}
                            {m.payfast > 0 && m.eft > 0 && <div style={{ height: '2px', background: 'var(--bg-primary)' }} />}
                            {m.payfast > 0 && (
                              <div style={{ width: '100%', height: `${Math.max(payfastHeight, 3)}px`, background: 'var(--accent-cyan)', borderRadius: m.eft > 0 ? '0' : '4px 4px 0 0' }} />
                            )}
                            {m.total === 0 && (
                              <div style={{ width: '100%', height: '2px', background: 'var(--border-color)' }} />
                            )}
                          </div>

                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses by Month - same card treatment and same months as
                the Gross Revenue chart above it, one stacked bar per month
                (one segment per category, each its own
                EXPENSE_CATEGORY_COLORS color) so both charts read as a
                matched pair. */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>Expenses by Month (ZAR)</h3>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  {EXPENSE_CATEGORIES.filter((c) => expenses.some((x) => x.category === c)).map((c) => (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: EXPENSE_CATEGORY_COLORS[c], display: 'inline-block', flexShrink: 0 }} />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
              {expenses.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No expenses logged yet - add one on the Finances tab.</p>
              ) : (() => {
                // Same months as revenueTrendMonths above, so the two
                // charts line up side by side as a matched pair.
                const monthlyExpenseData = revenueTrendMonths.map((month) => {
                  const monthExpenses = expenses.filter((x) => x.date?.startsWith(month));
                  const row = { month, label: new Date(`${month}-01`).toLocaleDateString('en-ZA', { month: 'short' }) };
                  EXPENSE_CATEGORIES.forEach((category) => {
                    row[category] = monthExpenses.filter((x) => x.category === category).reduce((sum, x) => sum + Number(x.amount), 0);
                  });
                  row.total = EXPENSE_CATEGORIES.reduce((sum, category) => sum + row[category], 0);
                  return row;
                });

                const formatTotalLabel = (value) => (value > 0 ? `R${Math.round(value).toLocaleString('en-ZA')}` : 'R 0');

                // Recharts' own LabelList turned out unreliable here - it
                // silently renders nothing for a stacked bar whenever the
                // specific category it's attached to is 0 that month (the
                // real, common case for a catch-all category like "Other"),
                // confirmed by inspecting the actual rendered SVG. Rendering
                // the totals as a plain flex row directly above the chart -
                // exactly how the Gross Revenue chart above already does
                // it, no chart library involved - sidesteps that entirely
                // and always shows every month's real total.
                return (
                  <div>
                    <div style={{ display: 'flex', paddingLeft: '44px' }}>
                      {monthlyExpenseData.map((m) => (
                        <div key={m.month} style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatTotalLabel(m.total)}
                        </div>
                      ))}
                    </div>
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer>
                        <BarChart data={monthlyExpenseData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} width={44} tickFormatter={(v) => `R${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                          <Tooltip
                            formatter={(value, name) => [`R ${Number(value).toLocaleString('en-ZA')}`, name]}
                            contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem' }}
                            labelStyle={{ color: 'var(--text-primary)' }}
                          />
                          {EXPENSE_CATEGORIES.map((category, i) => (
                            <Bar
                              key={category}
                              dataKey={category}
                              stackId="expenses"
                              fill={EXPENSE_CATEGORY_COLORS[category] || 'var(--text-muted)'}
                              radius={i === EXPENSE_CATEGORIES.length - 1 ? [4, 4, 0, 0] : 0}
                              isAnimationActive={false}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>

            {/* Focus 5 - editable (supabase/038_focus_five.sql), matched
                against the real roster by email. Click a name to jump
                straight to their Roadmap. */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={18} color="var(--warning)" />
                  <h3 style={{ margin: 0 }}>Focus 5</h3>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  onClick={() => { setEditingFocusFive((v) => !v); setFocusFiveSearch(''); }}
                >
                  <Pencil size={12} /> {editingFocusFive ? 'Done' : 'Edit'}
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>The {FOCUS_FIVE_MAX} members getting the most attention this month.</p>
              {focusFiveError && <p style={{ fontSize: '0.78rem', color: 'var(--danger)', margin: 0 }}>{focusFiveError}</p>}

              {!editingFocusFive ? (
                loadingFocusFive ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Loading...</p>
                ) : focusFive.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Nobody's on the list yet - click Edit to add up to {FOCUS_FIVE_MAX} members.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {focusFive.map((f) => {
                      const match = memberRoster.find((m) => m.email.toLowerCase() === f.memberEmail.toLowerCase());
                      const displayName = match?.member || f.memberEmail;
                      const initials = displayName.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                      return (
                        <button
                          key={f.id}
                          onClick={() => match && jumpToMemberRoadmap(match.email)}
                          disabled={!match}
                          className={match ? 'hover-glow' : undefined}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            cursor: match ? 'pointer' : 'default',
                            width: '100%',
                          }}
                        >
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              color: 'var(--accent-ink)',
                              flexShrink: 0,
                              marginTop: '2px',
                            }}
                          >
                            {initials}
                          </div>
                          <div style={{ overflow: 'hidden', flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{displayName}</div>
                            {match ? (
                              <>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '5px' }}>
                                  <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>
                                    {match.profile?.specialty && match.profile.specialty !== 'Not Set' ? match.profile.specialty : 'Specialty not set'}
                                  </span>
                                  <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>
                                    {match.profile?.jobReadiness || 'Not Started'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                                  Last 1on1: {match.lastMeetingDate ? formatDate(match.lastMeetingDate) : '—'}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '5px' }}>No longer in the roster</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {focusFive.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {focusFive.map((f) => {
                        const match = memberRoster.find((m) => m.email.toLowerCase() === f.memberEmail.toLowerCase());
                        return (
                          <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-tertiary)' }}>
                            <span style={{ fontSize: '0.82rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{match?.member || f.memberEmail}</span>
                            <button onClick={() => handleRemoveFromFocusFive(f.memberEmail)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {focusFive.length >= FOCUS_FIVE_MAX ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Focus 5 is full - remove someone to add another.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '8px 10px' }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input
                          type="text"
                          placeholder="Search members to add..."
                          value={focusFiveSearch}
                          onChange={(e) => setFocusFiveSearch(e.target.value)}
                          style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.82rem', width: '100%' }}
                        />
                      </div>
                      {focusFiveSearch.trim() && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
                          {memberRoster
                            .filter((m) =>
                              !focusFive.some((f) => f.memberEmail.toLowerCase() === m.email.toLowerCase()) &&
                              (m.member.toLowerCase().includes(focusFiveSearch.toLowerCase()) || m.email.toLowerCase().includes(focusFiveSearch.toLowerCase()))
                            )
                            .slice(0, 8)
                            .map((m) => (
                              <button
                                key={m.email}
                                className="hover-glow"
                                onClick={() => { handleAddToFocusFive(m.email); setFocusFiveSearch(''); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.82rem', textAlign: 'left' }}
                              >
                                <UserPlus size={13} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.member} <span style={{ color: 'var(--text-muted)' }}>· {m.email}</span></span>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );

    case 'members': {
      // Extracted so the exact same card renders both in the flat grid
      // below and inside an expanded group in the "By Domain" view - one
      // card design to maintain, not two.
      const renderMemberCard = (m) => {
        const initials = m.member
          .split(' ')
          .map((part) => part[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <div
            onClick={() => setSelectedMemberEmail(m.email)}
            className="hover-glow"
            style={{
              padding: '20px',
              borderRadius: 'var(--border-radius-md)',
              background: 'rgba(var(--overlay-rgb), 0.02)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: 'var(--accent-ink)',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.member}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span className={`badge ${m.status === 'Left' ? 'badge-danger' : (m.status === 'Lapsed' || m.status === 'Leaving') ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>{m.status}</span>
              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{m.lastPlan}</span>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{m.profile?.specialty && m.profile.specialty !== 'Not Set' ? m.profile.specialty : 'Specialty not set'}</span>
              {m.profile?.employmentStatus && m.profile.employmentStatus !== 'Not Set' && (
                <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{m.profile.employmentStatus}</span>
              )}
            </div>

            {(m.profile?.location || m.profile?.linkedin || m.profile?.phone || m.lastMeetingDate || (m.profile?.employmentStatus === 'Employed' && m.profile?.jobTitle)) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {m.profile?.employmentStatus === 'Employed' && m.profile?.jobTitle && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Building2 size={12} /> {m.profile.jobTitle}</span>
                )}
                {m.profile?.location && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={12} /> {m.profile.location}</span>}
                {m.profile?.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} /> {m.profile.phone}</span>}
                {m.profile?.linkedin && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Link size={12} /> LinkedIn on file</span>}
                {m.lastMeetingDate && (() => {
                  const daysSinceMeeting = Math.floor((today - new Date(m.lastMeetingDate)) / (1000 * 60 * 60 * 24));
                  const overdue = daysSinceMeeting > MEETING_OVERDUE_AFTER_DAYS;
                  return (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: overdue ? 'var(--danger)' : 'inherit', fontWeight: overdue ? 600 : 400 }}>
                      {overdue ? <Flag size={12} color="var(--danger)" /> : <Calendar size={12} />}
                      Last 1on1: {formatDate(m.lastMeetingDate)}
                      {overdue && ` (${daysSinceMeeting}d ago)`}
                    </span>
                  );
                })()}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '0.8rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Months in HH</div>
                <strong>{m.monthsInHH}</strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Total Spent</div>
                <strong style={{ color: 'var(--success)' }}>R {m.totalSpent.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}</strong>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Owed</div>
                <strong style={{ color: m.profile?.moneyOwed ? 'var(--warning)' : 'var(--text-secondary)' }}>
                  R {(m.profile?.moneyOwed || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}
                </strong>
              </div>
            </div>
          </div>
        );
      };

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Members</h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                {memberRoster.length} members, built from the PayFast transaction history. Click a card to view or fill in the rest of their profile.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {providerToken ? (
                <button className="btn btn-secondary" onClick={handleSyncLastMeetings} disabled={loadingMeetingSync}>
                  <RefreshCw size={16} className={loadingMeetingSync ? 'animate-spin' : ''} />
                  {loadingMeetingSync ? 'Syncing...' : 'Sync Last 1on1 Dates'}
                </button>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                  Sign in with Google to sync last 1on1 dates
                </span>
              )}
              <button className="btn btn-primary" onClick={() => setShowAddMemberModal(true)}>
                <UserPlus size={16} /> Add Member Manually
              </button>
            </div>
          </div>

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login. Sign in with Google to save for real.
            </div>
          )}
          {!isMockSession && savedMemberDataError && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.85rem' }}>
              Couldn't save/load member data from Supabase: {savedMemberDataError}
            </div>
          )}
          {!isMockSession && loadingSavedMemberData && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Loading saved member data...</div>
          )}

          {meetingSyncError && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.85rem' }}>
              Couldn't sync from Google Calendar: {meetingSyncError}
            </div>
          )}
          {Object.keys(lastMeetingByEmail).length > 0 && !meetingSyncError && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '20px', marginTop: '-16px' }}>
              Last 1on1 dates matched by attendee email against your Google Calendar since Jan 2026 — a member booked under a different email won't be caught.
            </p>
          )}

          {/* Member Sheet - a flat, scannable spreadsheet-style view of the
              whole roster (not the search/status filter below - this is a
              quick-scan overview, independent of that). Defaults to name
              order; the four data columns (meeting/spent/owed/start date)
              are click-to-sort via memberSheetSort. */}
          {(() => {
            // Same join-date fallback chain as Insights' joinDateFor (manual
            // start date > real onboarding timestamp > first real payment) -
            // one definition of "when did this member actually start" reused
            // everywhere it's needed, not redefined per view.
            const startDateFor = (m) => {
              const raw = m.profile?.manualStartDate || m.profile?.onboardedAt || m.firstPaymentDate;
              return raw ? new Date(raw) : null;
            };

            const sheetSortValue = (m, key) => {
              switch (key) {
                case 'lastMeeting': return m.lastMeetingDate ? new Date(m.lastMeetingDate).getTime() : null;
                case 'moneySpent': return m.totalSpent;
                case 'moneyOwed': return m.profile?.moneyOwed || 0;
                case 'startDate': { const d = startDateFor(m); return d ? d.getTime() : null; }
                default: return null;
              }
            };

            // Active and Active (Permanent) only - memberRoster's computed
            // `status` already collapses both of those real profile
            // statuses into a single 'Active' bucket (see memberRoster's
            // build above), distinct from 'Lapsed' (derived from a stale
            // last payment, not an admin-set status), 'Leaving', and
            // 'Left'. Filtering on 'Active' here is exactly "Active or
            // Active (Permanent)", nothing else.
            const activeMemberRoster = memberRoster.filter((m) => m.status === 'Active');

            const { key: sortKey, dir: sortDir } = memberSheetSort;
            const sortedRows = [...activeMemberRoster].sort((a, b) => {
              if (!sortKey) return a.member.localeCompare(b.member);
              const va = sheetSortValue(a, sortKey);
              const vb = sheetSortValue(b, sortKey);
              // A missing value (no synced meeting, no known start date)
              // isn't meaningfully "low" or "high" - it's just unknown, so
              // it always sorts last regardless of direction rather than
              // clustering at whichever end the direction happens to favor.
              if (va === null && vb === null) return a.member.localeCompare(b.member);
              if (va === null) return 1;
              if (vb === null) return -1;
              return (va - vb) * (sortDir === 'asc' ? 1 : -1);
            });

            const toggleSort = (key) => setMemberSheetSort((prev) => (
              prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
            ));

            const sortableHeader = (label, key) => {
              const active = sortKey === key;
              return (
                <th
                  onClick={() => toggleSort(key)}
                  style={{
                    padding: '10px 8px',
                    color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-secondary)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label} {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              );
            };

            return (
              <div className="glass-card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <ListChecks size={18} color="var(--accent-cyan)" />
                  <h3 style={{ margin: 0 }}>Member Sheet</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({activeMemberRoster.length} active)</span>
                </div>
                <div style={{ maxHeight: '440px', overflowY: 'auto', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-secondary)' }}>Name</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-secondary)' }}>Specialty</th>
                        {sortableHeader('Last 1on1 Meeting', 'lastMeeting')}
                        <th style={{ padding: '10px 8px', color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-secondary)' }}>Job Readiness</th>
                        {sortableHeader('Money Spent', 'moneySpent')}
                        {sortableHeader('Money Owed', 'moneyOwed')}
                        {sortableHeader('Start Date', 'startDate')}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((m) => {
                        const daysSinceMeeting = m.lastMeetingDate ? Math.floor((today - new Date(m.lastMeetingDate)) / (1000 * 60 * 60 * 24)) : null;
                        const meetingOverdue = daysSinceMeeting !== null && daysSinceMeeting > MEETING_OVERDUE_AFTER_DAYS;
                        const owed = m.profile?.moneyOwed || 0;
                        const startDate = startDateFor(m);
                        return (
                          <tr
                            key={m.email}
                            onClick={() => setSelectedMemberEmail(m.email)}
                            className="hover-glow"
                            style={{ borderBottom: '1px solid rgba(var(--overlay-rgb), 0.02)', cursor: 'pointer' }}
                          >
                            <td style={{ padding: '10px 8px', fontWeight: 600 }}>{m.member}</td>
                            <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{m.profile?.specialty || 'Not Set'}</td>
                            <td style={{ padding: '10px 8px', color: meetingOverdue ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: meetingOverdue ? 600 : 400 }}>
                              {m.lastMeetingDate ? `${formatDate(m.lastMeetingDate)}${meetingOverdue ? ` (${daysSinceMeeting}d ago)` : ''}` : '—'}
                            </td>
                            <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{m.profile?.jobReadiness || 'Not Started'}</td>
                            <td style={{ padding: '10px 8px', color: 'var(--success)' }}>R {m.totalSpent.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}</td>
                            <td style={{ padding: '10px 8px', color: owed ? 'var(--warning)' : 'var(--text-secondary)' }}>R {owed.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}</td>
                            <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{startDate ? formatDate(startDate) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* New Members Onboarding - anyone who joined in the last 30 days
              and hasn't finished the checklist (watch the video, book a
              1-on-1, join WhatsApp, etc.), across the whole roster - not
              just whoever's card happens to be open. Previously this was
              completely invisible; a stalled new member had no signal at
              all on the admin side. */}
          <div className="glass-card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Sparkles size={18} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0 }}>New Members Onboarding</h3>
              {newMembersOnboarding.length > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{newMembersOnboarding.length}</span>
              )}
            </div>
            {newMembersOnboarding.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Nobody who joined in the last {ONBOARDING_QUEUE_WINDOW_DAYS} days is still mid-checklist.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {newMembersOnboarding.map(({ member, doneCount, steps, daysSinceJoined }) => {
                  const pendingLabels = ONBOARDING_STEPS.filter((s) => !steps[s.key]).map((s) => s.label);
                  return (
                    <div key={member.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.member}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {member.email} · joined {daysSinceJoined === 0 ? 'today' : `${daysSinceJoined}d ago`}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Pending: {pendingLabels.join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{doneCount}/{ONBOARDING_STEPS.length} done</span>
                        <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setSelectedMemberEmail(member.email)}>
                          View
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stale Roadmaps - active members whose roadmap hasn't been
              touched in ROADMAP_STALE_AFTER_DAYS, so a coach can reach out
              directly instead of relying only on the member's own in-app
              nudge. Excludes anyone with no roadmap assigned yet - that's a
              different problem (see staleRoadmaps above). */}
          <div className="glass-card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Milestone size={18} color="var(--warning)" />
              <h3 style={{ margin: 0 }}>Stale Roadmaps</h3>
              {staleRoadmaps.length > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{staleRoadmaps.length}</span>
              )}
            </div>
            {staleRoadmaps.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No active member has gone {ROADMAP_STALE_AFTER_DAYS}+ days without touching their roadmap.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {staleRoadmaps.map(({ member, daysSinceTouch }) => (
                  <div key={member.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.member}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{member.email} · {member.profile?.roadmapTrack || 'No track assigned'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{daysSinceTouch}d quiet</span>
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setSelectedMemberEmail(member.email)}>
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(var(--overlay-rgb), 0.02)', padding: '10px 16px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', maxWidth: '360px', flexGrow: 1 }}>
              <Search size={18} color="var(--text-muted)" style={{ marginTop: '2px' }} />
              <input
                type="text"
                placeholder="Search members by name or email..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.9rem', outline: 'none', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['all', 'Active', 'Lapsed', 'Leaving', 'Left'].map((status) => (
                <button
                  key={status}
                  onClick={() => setMemberStatusFilter(status)}
                  className={`btn ${memberStatusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                >
                  {status === 'all' ? 'All' : status} ({status === 'all' ? memberRoster.length : (memberStatusCounts[status] || 0)})
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setMemberViewMode('grid')}
                className={`btn ${memberViewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '8px 14px' }}
              >
                <Users size={14} /> Grid
              </button>
              <button
                onClick={() => setMemberViewMode('domain')}
                className={`btn ${memberViewMode === 'domain' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '8px 14px' }}
              >
                <Milestone size={14} /> By Domain
              </button>
            </div>
          </div>

          {memberViewMode === 'domain' ? (
            <GroupedMemberDirectory
              members={filteredMemberRoster}
              getEmail={(m) => m.email}
              getName={(m) => m.member}
              getTrack={(m) => m.profile?.roadmapTrack || null}
              onSelectMember={(m) => setSelectedMemberEmail(m.email)}
              renderCard={renderMemberCard}
            />
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filteredMemberRoster.map((m) => (
              <div key={m.email}>{renderMemberCard(m)}</div>
            ))}
          </div>
          )}

          {/* Refer a Friend submissions - who members have referred to the
              community, and who referred them. */}
          <div className="glass-card" style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <UserPlus size={20} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0 }}>Referrals</h3>
            </div>

            {isMockSession && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                You're using Mock Admin — referrals only load for a real signed-in session.
              </div>
            )}
            {!isMockSession && referralsError && (
              <div style={{ padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.85rem' }}>
                {referralsError}
              </div>
            )}

            {loadingReferrals ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading referrals...</p>
            ) : referrals.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No referrals submitted yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Referred By</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Referred Person</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>LinkedIn</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Phone</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Status (R{REFERRAL_REWARD_AMOUNT} reward)</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const referrer = memberRoster.find((m) => m.email.toLowerCase() === r.referrerEmail.toLowerCase());
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(var(--overlay-rgb), 0.02)' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontWeight: 600 }}>{referrer?.member || r.referrerEmail}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.referrerEmail}</div>
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '12px 8px' }}>
                          {isSafeUrl(r.linkedin) ? (
                            <a href={r.linkedin} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Link size={13} /> Profile
                            </a>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{r.phone || '—'}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <select
                            className="form-input"
                            value={r.status || 'Pending'}
                            disabled={updatingReferralId === r.id}
                            onChange={(e) => handleUpdateReferralStatus(r.id, e.target.value)}
                            style={{ fontSize: '0.8rem', padding: '6px 8px', width: 'auto' }}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Joined">Joined</option>
                            <option value="Reward Paid">Reward Paid</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selectedMember && (
            <MemberProfileModal
              member={selectedMember}
              profile={selectedMember.profile}
              onSave={handleSaveMemberProfile}
              onDelete={handleDeleteMemberProfile}
              onClose={() => setSelectedMemberEmail(null)}
              today={today}
            />
          )}

          {showAddMemberModal && (
            <AddMemberModal
              onSave={handleAddManualMember}
              onClose={() => setShowAddMemberModal(false)}
            />
          )}
        </div>
      );
    }

    case 'roadmaps': {
      const roadmapSelected = roadmapMemberEmail
        ? memberRoster.find((m) => m.email.toLowerCase() === roadmapMemberEmail.toLowerCase())
        : null;
      // Only active members are worth authoring a live coaching plan for -
      // Lapsed/Leaving/Left members drop out of the picker entirely (though a
      // member already mid-track who later lapses/leaves keeps their existing
      // roadmap data untouched; they just won't show up here to pick again).
      const activeRoadmapRoster = memberRoster.filter((m) => m.status === 'Active');
      const filteredRoadmapRoster = activeRoadmapRoster.filter((m) =>
        (roadmapTrackFilter === 'All' || (m.profile?.roadmapTrack || 'Not Assigned') === roadmapTrackFilter) &&
        (m.member.toLowerCase().includes(roadmapMemberSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(roadmapMemberSearch.toLowerCase()))
      );
      const roadmapTrackCounts = ROADMAP_TRACKS.map((track) => ({
        track,
        count: activeRoadmapRoster.filter((m) => (m.profile?.roadmapTrack || 'Not Assigned') === track).length,
      }));

      // Per-member % complete for the picker list, without needing to open
      // each member's checklist first. Real session: grouped from the one
      // bulk fetchAllRoadmapItems() call. Mock Admin: reuses
      // mockRoadmapItemsByEmail, the same per-email store the picker already
      // maintains when you add/edit/delete items locally.
      const roadmapItemsByEmail = isMockSession
        ? mockRoadmapItemsByEmail
        : allRoadmapItems.reduce((acc, item) => {
            const key = item.memberEmail.toLowerCase();
            (acc[key] = acc[key] || []).push(item);
            return acc;
          }, {});
      const getRoadmapProgressPct = (email) => {
        const items = roadmapItemsByEmail[email.toLowerCase()];
        if (!items || items.length === 0) return null;
        return Math.round((items.filter((i) => i.completed).length / items.length) * 100);
      };
      const existingCategories = [...new Set(roadmapItems.map((i) => i.category))];
      const completedCount = roadmapItems.filter((i) => i.completed).length;
      const roadmapProgress = roadmapItems.length ? Math.round((completedCount / roadmapItems.length) * 100) : 0;
      const catalogTitles = new Set(CORE_FOUNDATIONS_CATALOG.map((c) => c.title));
      const coreFoundationsDone = roadmapItems.filter((i) => i.phase === 'Core Foundations' && i.category === 'Certifications' && catalogTitles.has(i.title) && i.completed).length;
      const coreFoundationsMet = coreFoundationsDone >= CORE_FOUNDATIONS_MIN_REQUIRED;
      const missingFoundationsCount = CORE_FOUNDATIONS_CATALOG.length - roadmapItems.filter((i) => i.phase === 'Core Foundations' && i.category === 'Certifications' && catalogTitles.has(i.title)).length;
      const specializationEligible = coreFoundationsDone >= SPECIALIZATION_UNLOCK_MIN;
      const foundationsApproved = !!roadmapSelected?.profile?.roadmapFoundationsApproved;
      const specializationUnlocked = specializationEligible && foundationsApproved;
      const specializationCatalog = roadmapSelected?.profile?.roadmapTrack ? SPECIALIZATION_CATALOGS[roadmapSelected.profile.roadmapTrack] : null;
      const missingSpecializationCount = specializationCatalog
        ? specializationCatalog.items.length - roadmapItems.filter((i) => i.phase === 'Specialization' && i.category === specializationCatalog.category).length
        : 0;

      // Every active member who's hit the Specialization completion count but
      // hasn't been approved yet, across the whole roster - not just whoever
      // happens to be selected. This is the "awaiting approval" queue that
      // was previously invisible unless you opened each member's roadmap one
      // by one to check.
      const awaitingApprovalMembers = activeRoadmapRoster
        .map((m) => {
          const items = roadmapItemsByEmail[m.email.toLowerCase()] || [];
          const doneCount = items.filter((i) => i.phase === 'Core Foundations' && i.category === 'Certifications' && catalogTitles.has(i.title) && i.completed).length;
          return { member: m, doneCount };
        })
        .filter(({ member, doneCount }) => doneCount >= SPECIALIZATION_UNLOCK_MIN && !member.profile?.roadmapFoundationsApproved)
        .sort((a, b) => b.doneCount - a.doneCount);

      const phaseGroups = ROADMAP_PHASES.map((phase) => ({
        phase,
        categories: [...new Set(roadmapItems.filter((i) => i.phase === phase).map((i) => i.category))].map((category) => ({
          category,
          items: roadmapItems.filter((i) => i.phase === phase && i.category === category).sort((a, b) => a.sortOrder - b.sortOrder),
        })),
      })).filter((g) => g.categories.length > 0);

      const handleTrackChange = (email, value) => {
        const rm = memberRoster.find((m) => m.email.toLowerCase() === email.toLowerCase());
        handleSaveMemberProfile(email, { ...(rm?.profile || {}), roadmapTrack: value });
      };

      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Roadmaps</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Assign a track and curate a member's checklist. They can only mark items done - the plan itself is yours to author.</p>
          </div>

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login.
            </div>
          )}

          {/* Breakdown of active members per specialization track - click a
              chip to filter the member picker down to just that track. */}
          <div className="glass-card" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Milestone size={16} color="var(--accent-cyan)" /> Active Members by Track
              <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>· click to filter</span>
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {roadmapTrackCounts.map(({ track, count }) => (
                <button
                  key={track}
                  onClick={() => setRoadmapTrackFilter((prev) => (prev === track ? 'All' : track))}
                  className="hover-glow"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: 'var(--border-radius-md)',
                    background: roadmapTrackFilter === track ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(var(--overlay-rgb), 0.02)',
                    border: '1px solid ' + (roadmapTrackFilter === track ? 'var(--accent-cyan)' : 'var(--border-color)'),
                    cursor: 'pointer', font: 'inherit', color: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{track}</span>
                  <span className={`badge ${track === 'Not Assigned' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'flex-start' }}>
            {/* Member picker */}
            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(var(--overlay-rgb), 0.02)', padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', marginBottom: '10px' }}>
                <Search size={16} color="var(--text-muted)" style={{ marginTop: '2px' }} />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={roadmapMemberSearch}
                  onChange={(e) => setRoadmapMemberSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none', width: '100%' }}
                />
              </div>
              <select
                className="form-input"
                value={roadmapTrackFilter}
                onChange={(e) => setRoadmapTrackFilter(e.target.value)}
                style={{ fontSize: '0.82rem', marginBottom: '14px' }}
              >
                <option value="All">All Tracks</option>
                {ROADMAP_TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '520px', overflowY: 'auto' }}>
                {filteredRoadmapRoster.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 4px' }}>No active members on this track.</p>
                )}
                {filteredRoadmapRoster.map((m) => {
                  const pct = getRoadmapProgressPct(m.email);
                  return (
                    <button
                      key={m.email}
                      onClick={() => loadRoadmapForMember(m.email)}
                      className="hover-glow"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '2px',
                        padding: '10px 12px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid ' + (roadmapMemberEmail?.toLowerCase() === m.email.toLowerCase() ? 'var(--accent-cyan)' : 'var(--border-color)'),
                        background: roadmapMemberEmail?.toLowerCase() === m.email.toLowerCase() ? 'rgba(var(--accent-rgb), 0.06)' : 'rgba(var(--overlay-rgb), 0.01)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.member}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: pct === null ? 'var(--text-muted)' : pct === 100 ? 'var(--success)' : 'var(--accent-cyan)', flexShrink: 0 }}>
                          {pct === null ? '—' : `${pct}%`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>
                          {m.profile?.roadmapTrack && m.profile.roadmapTrack !== 'Not Assigned' ? m.profile.roadmapTrack : 'No track assigned'}
                        </span>
                        <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>
                          {m.profile?.jobReadiness || 'Not Started'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected member's roadmap */}
            <div className="glass-card" style={{ padding: '24px' }}>
              {!roadmapSelected ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Pick a member on the left to assign a track and build their checklist.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{roadmapSelected.member}</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{roadmapSelected.email}</p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Track</label>
                      <select
                        className="form-input"
                        value={roadmapSelected.profile?.roadmapTrack || 'Not Assigned'}
                        onChange={(e) => handleTrackChange(roadmapSelected.email, e.target.value)}
                      >
                        {ROADMAP_TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {roadmapItemsError && (
                    <div style={{ padding: '10px 14px', marginBottom: '16px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.82rem' }}>
                      {roadmapItemsError}
                    </div>
                  )}

                  {!isMockSession && loadingRoadmapItems ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading checklist...</p>
                  ) : (
                    <>
                      {roadmapItems.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                          <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${roadmapProgress}%`, height: '100%', background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))', borderRadius: '4px' }}></div>
                          </div>
                          <span className="badge badge-success" style={{ fontSize: '0.75rem', flexShrink: 0 }}>{completedCount}/{roadmapItems.length} done</span>
                        </div>
                      )}

                      {phaseGroups.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '20px' }}>No checklist items yet.</p>
                      ) : (
                        phaseGroups.map((g) => (
                          <div key={g.phase} style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-purple)' }}>{g.phase}</div>
                              {g.phase === 'Core Foundations' && (
                                <span className={`badge ${coreFoundationsMet ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.62rem' }}>
                                  {coreFoundationsDone}/{CORE_FOUNDATIONS_CATALOG.length} Foundation Certs
                                </span>
                              )}
                              {g.phase === 'Specialization' && (
                                <span
                                  className={`badge ${specializationUnlocked ? 'badge-success' : specializationEligible ? 'badge-warning' : 'badge-warning'}`}
                                  style={{ fontSize: '0.62rem' }}
                                  title={specializationUnlocked ? 'Visible to the member' : specializationEligible ? 'Member has hit the completion count - needs your approval to unlock' : `Needs ${SPECIALIZATION_UNLOCK_MIN} Core Foundations certs done (currently ${coreFoundationsDone})`}
                                >
                                  {specializationUnlocked ? 'Visible to member' : specializationEligible ? 'Awaiting Your Approval' : `Locked · ${coreFoundationsDone}/${SPECIALIZATION_UNLOCK_MIN} needed`}
                                </span>
                              )}
                              {g.phase === 'Specialization' && specializationEligible && (
                                <button
                                  className={`btn ${foundationsApproved ? 'btn-secondary' : 'btn-primary'}`}
                                  style={{ fontSize: '0.68rem', padding: '4px 10px' }}
                                  disabled={savingFoundationsApproval}
                                  onClick={() => handleToggleFoundationsApproval(roadmapSelected.email, !foundationsApproved)}
                                >
                                  {foundationsApproved ? 'Revoke Approval' : 'Approve Foundations'}
                                </button>
                              )}
                            </div>
                            {g.categories.map((c) => (
                              <div key={c.category} style={{ marginBottom: '14px' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>{c.category}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {c.items.map((item) => (
                                    <div key={item.id} style={{ padding: '10px 12px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.01)', border: '1px solid var(--border-color)' }}>
                                      {editingRoadmapItemId === item.id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <select className="form-input" value={editRoadmapItemForm.phase} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, phase: e.target.value })}>
                                              {ROADMAP_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                            <input className="form-input" value={editRoadmapItemForm.category} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, category: e.target.value })} placeholder="Category" />
                                          </div>
                                          <input className="form-input" value={editRoadmapItemForm.title} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, title: e.target.value })} placeholder="Item title" />
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <input className="form-input" value={editRoadmapItemForm.detail} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, detail: e.target.value })} placeholder="Detail (optional) - e.g. 9/20 collections" />
                                            <input type="date" className="form-input" value={editRoadmapItemForm.dueDate} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, dueDate: e.target.value })} />
                                          </div>
                                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setEditingRoadmapItemId(null)}>Cancel</button>
                                            <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => handleSaveRoadmapItemEdit(item)}>Save</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <button onClick={() => handleToggleRoadmapItemDone(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }} aria-label={item.completed ? 'Mark not done' : 'Mark done'}>
                                            {item.completed ? <CheckSquare size={18} color="var(--success)" /> : <Square size={18} color="var(--text-muted)" />}
                                          </button>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.9rem', textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{item.title}</div>
                                            {(item.detail || item.dueDate) && (
                                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {item.detail}{item.detail && item.dueDate ? ' · ' : ''}{item.dueDate && `Due ${formatDate(item.dueDate)}`}
                                              </div>
                                            )}
                                          </div>
                                          {ROADMAP_ITEM_LINKS[item.title] && (
                                            <a
                                              href={ROADMAP_ITEM_LINKS[item.title]}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="btn btn-secondary"
                                              style={{ fontSize: '0.72rem', padding: '5px 9px', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', flexShrink: 0 }}
                                            >
                                              <ExternalLink size={12} /> Open Link / Resource
                                            </a>
                                          )}
                                          <button onClick={() => startEditRoadmapItem(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }} aria-label="Edit item">
                                            <Pencil size={15} />
                                          </button>
                                          <button onClick={() => handleDeleteRoadmapItem(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', flexShrink: 0 }} aria-label="Delete item">
                                            <Trash2 size={15} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </>
                  )}

                  {showAddRoadmapItemForm ? (
                    <form onSubmit={handleAddRoadmapItem} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>Phase</label>
                          <select className="form-input" value={newRoadmapItem.phase} onChange={(e) => setNewRoadmapItem({ ...newRoadmapItem, phase: e.target.value })}>
                            {ROADMAP_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>Category</label>
                          <input className="form-input" list="roadmap-category-suggestions" value={newRoadmapItem.category} onChange={(e) => setNewRoadmapItem({ ...newRoadmapItem, category: e.target.value })} placeholder="e.g. Certifications" required />
                          <datalist id="roadmap-category-suggestions">
                            {existingCategories.map((c) => <option key={c} value={c} />)}
                          </datalist>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>Item title</label>
                        <input className="form-input" value={newRoadmapItem.title} onChange={(e) => setNewRoadmapItem({ ...newRoadmapItem, title: e.target.value })} placeholder="e.g. CompTIA Security+" required />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>Detail (optional)</label>
                          <input className="form-input" value={newRoadmapItem.detail} onChange={(e) => setNewRoadmapItem({ ...newRoadmapItem, detail: e.target.value })} placeholder="e.g. 9/20 collections" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>Due date (optional)</label>
                          <input type="date" className="form-input" value={newRoadmapItem.dueDate} onChange={(e) => setNewRoadmapItem({ ...newRoadmapItem, dueDate: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.82rem' }} onClick={() => setShowAddRoadmapItemForm(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.82rem' }}>Add Item</button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => setShowAddRoadmapItemForm(true)}>
                        <Plus size={16} /> Add Checklist Item
                      </button>
                      {missingFoundationsCount > 0 && (
                        <button className="btn btn-secondary" onClick={handleAddStandardFoundations} disabled={addingStandardFoundations}>
                          <Milestone size={16} /> {addingStandardFoundations ? 'Adding...' : `Add Standard Foundations (${missingFoundationsCount} missing)`}
                        </button>
                      )}
                      {specializationCatalog && missingSpecializationCount > 0 && (
                        <button className="btn btn-secondary" onClick={() => handleAddStandardSpecialization(specializationCatalog)} disabled={addingStandardSpecialization}>
                          <Milestone size={16} /> {addingStandardSpecialization ? 'Adding...' : `Add Standard Specialization (${missingSpecializationCount} missing)`}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Roadmaps Awaiting Approval - every active member who's hit the
              Specialization completion count, across the whole roster, not
              just whoever happens to be selected above. Previously this was
              only visible one member at a time, by opening each roadmap to
              check. */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <ListChecks size={18} color="var(--warning)" />
              <h3 style={{ margin: 0 }}>Roadmaps Awaiting Approval</h3>
              {awaitingApprovalMembers.length > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{awaitingApprovalMembers.length}</span>
              )}
            </div>
            {awaitingApprovalMembers.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing waiting on you right now.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {awaitingApprovalMembers.map(({ member, doneCount }) => (
                  <div key={member.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.member}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{member.email} · {member.profile?.roadmapTrack || 'No track assigned'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{doneCount}/{CORE_FOUNDATIONS_CATALOG.length} Core Foundations</span>
                      <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => loadRoadmapForMember(member.email)}>
                        View
                      </button>
                      <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} disabled={savingFoundationsApproval} onClick={() => handleToggleFoundationsApproval(member.email, true)}>
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'matchmaker': {
      const nameForEmail = (email) => memberRoster.find((m) => m.email.toLowerCase() === email?.toLowerCase())?.member || email;
      const activeGroups = groups.filter((g) => g.status === 'Active');
      const completedGroups = groups.filter((g) => g.status === 'Completed');

      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Matchmaker</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Members opt in, then a round randomly groups everyone in the pool into teams of 2-4 for a Project or a Presentation.</p>
          </div>

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login.
            </div>
          )}
          {matchmakerError && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.85rem' }}>
              {matchmakerError}
            </div>
          )}

          <div className="glass-card" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Handshake size={18} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Opt-In Pool</h3>
              </div>
              {!isMockSession && loadingMatchmaker ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</p>
              ) : optinPool.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nobody's opted in yet.</p>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {optinPool.length} waiting: {optinPool.map(nameForEmail).join(', ')}
                </p>
              )}
            </div>
            <button
              className="btn btn-primary"
              disabled={optinPool.length < 2 || runningRound}
              onClick={handleRunMatchmakerRound}
              title={optinPool.length < 2 ? 'Need at least 2 opted-in members' : undefined}
            >
              {runningRound ? 'Shuffling...' : `Run Matching Round (${optinPool.length})`}
            </button>
          </div>

          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Active Groups ({activeGroups.length})
          </div>
          {activeGroups.length === 0 ? (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '28px' }}>No active groups yet — run a round once enough members have opted in.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              {activeGroups.map((group) => (
                <div key={group.id} className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                    <span className="badge badge-warning">{group.activityType}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.memberEmails.length} members</span>
                  </div>
                  <ul style={{ margin: '0 0 14px', paddingLeft: '18px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {group.memberEmails.map((email) => <li key={email}>{nameForEmail(email)}</li>)}
                  </ul>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flexShrink: 0 }}>Due:</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ fontSize: '0.78rem', padding: '5px 8px' }}
                      value={group.dueDate || ''}
                      onChange={(e) => handleUpdateGroupDueDate(group, e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => handleUpdateGroupStatus(group, 'Completed')}>
                      <CheckCircle size={13} /> Mark Completed
                    </button>
                    <button onClick={() => handleDeleteGroup(group)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} aria-label="Delete group">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Completed ({completedGroups.length})
          </div>
          {completedGroups.length === 0 ? (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No completed groups yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {completedGroups.map((group) => (
                <div key={group.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.01)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem', marginRight: '8px' }}>{group.activityType}</span>
                    {group.memberEmails.map(nameForEmail).join(', ')}
                  </div>
                  <button onClick={() => handleDeleteGroup(group)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} aria-label="Delete group">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'roomlogs': {
      const nameForLogEmail = (email) => memberRoster.find((m) => m.email.toLowerCase() === email?.toLowerCase())?.member || email;
      const pendingLogs = roomLogs.filter((l) => l.status === 'Pending').sort((a, b) => new Date(b.logDate) - new Date(a.logDate));
      const reviewedLogs = roomLogs.filter((l) => l.status !== 'Pending').sort((a, b) => new Date(b.logDate) - new Date(a.logDate));
      const statusColor = { Approved: 'badge-success', Rejected: 'badge-danger' };

      // Stats below are scoped to Approved logs only - Pending/Rejected
      // haven't actually been credited to anyone, so counting them as
      // "completed" would overstate real activity.
      const approvedLogs = roomLogs.filter((l) => l.status === 'Approved');
      const totalRoomsCompleted = approvedLogs.reduce((sum, l) => sum + l.roomCount, 0);
      const loggerEmails = [...new Set(approvedLogs.map((l) => l.memberEmail.toLowerCase()))];
      const avgRoomsPerMember = loggerEmails.length ? (totalRoomsCompleted / loggerEmails.length).toFixed(1) : null;

      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const roomsByDayOfWeek = DAY_NAMES.map((day, idx) => ({
        day,
        rooms: approvedLogs.filter((l) => new Date(`${l.logDate}T00:00:00`).getDay() === idx).reduce((sum, l) => sum + l.roomCount, 0),
      }));
      const mostActiveDay = roomsByDayOfWeek.reduce((best, d) => (!best || d.rooms > best.rooms ? d : best), null);

      const daysLoggedByEmail = approvedLogs.reduce((acc, l) => {
        const key = l.memberEmail.toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const [topLoggerEmail, topLoggerDays] = Object.entries(daysLoggedByEmail).sort((a, b) => b[1] - a[1])[0] || [null, null];

      const bestSingleDay = approvedLogs.reduce((best, l) => (!best || l.roomCount > best.roomCount ? l : best), null);

      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}><ListChecks size={28} color="var(--accent-cyan)" /> Room Logs</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Members' self-reported daily TryHackMe room counts. Approving credits the Competitions leaderboard.</p>
          </div>

          {/* Stats - scoped to Approved logs only, so a big Pending backlog
              doesn't inflate "completed" activity. */}
          {approvedLogs.length > 0 && (
            <div className="dashboard-grid" style={{ marginBottom: '28px' }}>
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Rooms Completed</span>
                  <ListChecks size={18} color="var(--accent-cyan)" />
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{totalRoomsCompleted}</h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>Across {loggerEmails.length} member{loggerEmails.length === 1 ? '' : 's'}</div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Avg Rooms per Member</span>
                  <TrendingUp size={18} color="var(--success)" />
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{avgRoomsPerMember}</h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>Across every approved log on file</div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Most Active Day</span>
                  <Calendar size={18} color="var(--accent-purple)" />
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{mostActiveDay?.day || '—'}</h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>{mostActiveDay ? `${mostActiveDay.rooms} rooms logged, all-time` : 'No data yet'}</div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Most Days Logged</span>
                  <Award size={18} color="var(--warning)" />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{topLoggerEmail ? nameForLogEmail(topLoggerEmail) : '—'}</h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>{topLoggerDays ? `${topLoggerDays} day${topLoggerDays === 1 ? '' : 's'} logged` : 'No data yet'}</div>
              </div>

              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Best Single Day</span>
                  <Star size={18} color="var(--accent-cyan)" />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{bestSingleDay ? nameForLogEmail(bestSingleDay.memberEmail) : '—'}</h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>{bestSingleDay ? `${bestSingleDay.roomCount} room${bestSingleDay.roomCount === 1 ? '' : 's'} on ${formatDate(bestSingleDay.logDate)}` : 'No data yet'}</div>
              </div>
            </div>
          )}

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login.
            </div>
          )}
          {roomLogsError && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.85rem' }}>
              {roomLogsError}
            </div>
          )}

          {!isMockSession && loadingRoomLogs ? (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Loading room logs...</p>
          ) : (
            <>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Pending Review ({pendingLogs.length})
              </div>
              {pendingLogs.length === 0 ? (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '28px' }}>Nothing waiting on review.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  {pendingLogs.map((log) => (
                    <div key={log.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{nameForLogEmail(log.memberEmail)}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDate(log.logDate)} · {log.roomCount} room{log.roomCount === 1 ? '' : 's'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                            disabled={reviewingRoomLogId === log.id}
                            onClick={() => handleReviewRoomLog(log, true)}
                          >
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '7px 14px', color: 'var(--danger)' }}
                            disabled={reviewingRoomLogId === log.id}
                            onClick={() => handleReviewRoomLog(log, false)}
                          >
                            Reject
                          </button>
                        </div>
                        <input
                          className="form-input"
                          placeholder="Rejection note (optional)"
                          style={{ fontSize: '0.78rem', padding: '6px 10px', width: '220px' }}
                          value={rejectNoteDraft[log.id] || ''}
                          onChange={(e) => setRejectNoteDraft({ ...rejectNoteDraft, [log.id]: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Reviewed ({reviewedLogs.length})
              </div>
              {reviewedLogs.length === 0 ? (
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No reviewed logs yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {reviewedLogs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.01)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{nameForLogEmail(log.memberEmail)}</strong>
                        <span style={{ color: 'var(--text-muted)' }}> · {formatDate(log.logDate)} · {log.roomCount} room{log.roomCount === 1 ? '' : 's'}{log.adminNote ? ` · "${log.adminNote}"` : ''}</span>
                      </div>
                      <span className={`badge ${statusColor[log.status]}`} style={{ fontSize: '0.65rem' }}>{log.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    case 'meetups':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Meetups & Events</h1>
              <p>The real, live Events tab members see, plus what's still waiting on your review below.</p>
            </div>
            {!isMockSession && (
              <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setShowAddEventForm((v) => !v)}>
                <Plus size={16} /> {showAddEventForm ? 'Cancel' : 'Add Event'}
              </button>
            )}
          </div>

          {showAddEventForm && (
            <form onSubmit={handleAddEvent} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <h3 style={{ margin: 0 }}>Add Event</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                For a listing that came in via the shareable submission form instead of a member's own portal login.
              </p>
              {approveEventError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{approveEventError}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <select className="form-input" value={newEvent.type} onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}>
                  {['HH Meetup', 'Industry Event', 'Sunday Catchup', 'Study Session'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="form-input" placeholder="Title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} required />
              </div>
              <textarea className="form-input" placeholder="Description (optional)" rows={2} value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <input type="date" className="form-input" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} required />
                <input className="form-input" placeholder="Time (optional)" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} />
                <input className="form-input" placeholder="Location (optional)" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} />
              </div>
              <input className="form-input" placeholder="Link (optional)" value={newEvent.link} onChange={(e) => setNewEvent({ ...newEvent, link: e.target.value })} />
              <button type="submit" className="btn btn-primary" disabled={addingEvent} style={{ alignSelf: 'flex-end' }}>
                {addingEvent ? 'Adding...' : 'Add Event'}
              </button>
            </form>
          )}

          {/* Live Events - real, approved rows from community_events, the
              exact same data the member-side Events tab reads. Read-only
              here; members add their own via the Events tab, admins approve
              or reject below. */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Live Events</h3>
              <span className="badge badge-success">{liveCommunityEvents.length} Approved</span>
            </div>
            {isMockSession ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Not available under Mock Admin - this reads real events from Supabase.
              </div>
            ) : loadingCommunityEvents ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading...</p>
            ) : liveCommunityEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Nothing approved and upcoming yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {liveCommunityEvents.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '14px 16px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'rgba(var(--overlay-rgb), 0.02)',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{ev.type}</span>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{ev.title}</h4>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {formatDate(ev.date)}{ev.time ? ` at ${ev.time}` : ''} | {ev.location || 'No location set'}
                        {ev.createdBy && ` | Submitted by ${ev.createdBy}`}
                      </p>
                    </div>
                    {isSafeUrl(ev.link) && (
                      <a href={ev.link} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                        <Link size={13} /> Event Link
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Community Events - member-submitted events awaiting approval */}
          <div className="glass-card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3>Pending Community Events</h3>
              <span className="badge badge-warning">{pendingCommunityEvents.length} Awaiting Review</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Events members added themselves via the Events tab. Only visible to their submitter until approved.
              {!canApproveEvents && ' Only siya@hackinghub.co.za can approve these.'}
            </p>
            {approveEventError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px' }}>{approveEventError}</p>}
            {isMockSession ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Not available under Mock Admin - this reads real submissions from Supabase.
              </div>
            ) : loadingCommunityEvents ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading...</p>
            ) : pendingCommunityEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Nothing waiting on review.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingCommunityEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedPendingEvent(ev)}
                    className="hover-glow"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '14px 16px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'rgba(var(--overlay-rgb), 0.02)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>{ev.title}</h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {formatDate(ev.date)}{ev.time ? ` at ${ev.time}` : ''} | {ev.location || 'No location set'} | Submitted by {ev.createdBy}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setSelectedPendingEvent(ev)}
                        style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                      >
                        <Info size={14} /> Details
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '8px 14px', color: 'var(--danger)', borderColor: 'rgba(var(--danger-rgb), 0.3)' }}
                        disabled={rejectingEventId === ev.id}
                        onClick={() => handleRejectEvent(ev.id)}
                      >
                        <X size={14} /> {rejectingEventId === ev.id ? 'Rejecting...' : 'Reject'}
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={!canApproveEvents || approvingEventId === ev.id}
                        title={canApproveEvents ? undefined : 'Only siya@hackinghub.co.za can approve events'}
                        onClick={() => handleApproveEvent(ev.id)}
                        style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                      >
                        <CheckCircle size={14} /> {approvingEventId === ev.id ? 'Approving...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Event Details Modal */}
          {selectedPendingEvent && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'var(--modal-backdrop)',
                backdropFilter: 'blur(8px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
              }}
              onClick={() => setSelectedPendingEvent(null)}
            >
              <div
                className="glass-card"
                style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', padding: '32px', border: '1px solid var(--warning)', position: 'relative' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedPendingEvent(null)}
                  aria-label="Close"
                  style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>

                <span className="badge badge-warning" style={{ marginBottom: '12px', display: 'inline-block' }}>{selectedPendingEvent.type || 'Event'} · Pending Review</span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '16px', paddingRight: '30px' }}>{selectedPendingEvent.title}</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', fontSize: '0.88rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Calendar size={14} color="var(--accent-cyan)" />
                    {formatDate(selectedPendingEvent.date)}{selectedPendingEvent.time ? ` at ${selectedPendingEvent.time}` : ' · No time set'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Info size={14} color="var(--accent-cyan)" />
                    {selectedPendingEvent.location || 'No location set'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <Users size={14} color="var(--accent-cyan)" />
                    Submitted by {selectedPendingEvent.createdBy}
                  </div>
                  {selectedPendingEvent.link && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Link size={14} color="var(--accent-cyan)" />
                      {isSafeUrl(selectedPendingEvent.link) ? (
                        <a href={selectedPendingEvent.link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                          {selectedPendingEvent.link} <ExternalLink size={11} style={{ display: 'inline' }} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--danger)' }}>Unsafe link - not shown</span>
                      )}
                    </div>
                  )}
                </div>

                {selectedPendingEvent.description ? (
                  <div style={{ padding: '14px 16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Description</div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{selectedPendingEvent.description}</p>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '24px' }}>No description provided.</p>
                )}

                {approveEventError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '12px' }}>{approveEventError}</p>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedPendingEvent(null)}>Close</button>
                  <button
                    className="btn btn-secondary"
                    style={{ color: 'var(--danger)', borderColor: 'rgba(var(--danger-rgb), 0.3)' }}
                    disabled={rejectingEventId === selectedPendingEvent.id}
                    onClick={async () => {
                      if (await handleRejectEvent(selectedPendingEvent.id)) {
                        setSelectedPendingEvent(null);
                      }
                    }}
                  >
                    <X size={14} /> {rejectingEventId === selectedPendingEvent.id ? 'Rejecting...' : 'Reject'}
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!canApproveEvents || approvingEventId === selectedPendingEvent.id}
                    title={canApproveEvents ? undefined : 'Only siya@hackinghub.co.za can approve events'}
                    onClick={async () => {
                      await handleApproveEvent(selectedPendingEvent.id);
                      setSelectedPendingEvent(null);
                    }}
                  >
                    <CheckCircle size={14} /> {approvingEventId === selectedPendingEvent.id ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );

    case 'jobs': {
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Job Board</h1>
              <p>The real listings members see. Any approved member can already post their own here - this is for adding one on someone's behalf, e.g. from the shareable submission form.</p>
            </div>
            <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setShowAddJobForm((v) => !v)}>
              <Plus size={16} /> {showAddJobForm ? 'Cancel' : 'Add Job'}
            </button>
          </div>

          {jobListingsError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{jobListingsError}</p>
          )}

          {showAddJobForm && (
            <form onSubmit={handleAddJob} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <h3 style={{ margin: 0 }}>Add Job</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input className="form-input" placeholder="Title" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} required />
                <input className="form-input" placeholder="Company" value={newJob.company} onChange={(e) => setNewJob({ ...newJob, company: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <select className="form-input" value={newJob.type} onChange={(e) => setNewJob({ ...newJob, type: e.target.value })}>
                  {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="form-input" placeholder="Location (optional)" value={newJob.location} onChange={(e) => setNewJob({ ...newJob, location: e.target.value })} />
                <input className="form-input" placeholder="Salary (optional)" value={newJob.salary} onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })} />
              </div>
              <textarea className="form-input" placeholder="Description (optional)" rows={2} value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input className="form-input" placeholder="Tags, comma-separated (optional)" value={newJob.tags} onChange={(e) => setNewJob({ ...newJob, tags: e.target.value })} />
                <input className="form-input" placeholder="Apply link (optional)" value={newJob.link} onChange={(e) => setNewJob({ ...newJob, link: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>Add Job</button>
            </form>
          )}

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Live Listings</h3>
              <span className="badge badge-success">{jobListings.length}</span>
            </div>
            {!isMockSession && loadingJobListings ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading...</p>
            ) : jobListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No listings yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {jobListings.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                      padding: '14px 16px', borderRadius: 'var(--border-radius-md)',
                      background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)', flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{job.type}</span>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{job.title}</h4>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {job.company}{job.location ? ` · ${job.location}` : ''}{job.salary ? ` · ${job.salary}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {job.link && (
                        <a href={job.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ExternalLink size={12} /> Link
                        </a>
                      )}
                      <button onClick={() => handleDeleteJob(job)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex' }} aria-label="Delete job listing">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'insights': {
      // Join date: prefers an admin-set manual start date (Members tab) over
      // the real onboarding timestamp, which in turn falls back to first
      // real payment date for anyone who joined before onboarding existed.
      // Members with none of the three (never onboarded, never paid, no
      // manual date set) are excluded from every duration stat below -
      // there's no honest join-date signal for them, and fabricating one
      // would be worse than omitting them.
      const joinDateFor = (m) => {
        const raw = m.profile?.manualStartDate || m.profile?.onboardedAt || m.firstPaymentDate;
        return raw ? new Date(raw) : null;
      };
      const daysBetween = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));
      const formatDays = (d) => (d === null ? '—' : d < 30 ? `${d} days` : `${(d / 30).toFixed(1)} months`);

      // Retention: current members measured to today (their tenure so far,
      // still running); departed members measured to when they actually left
      // - blending the two into one number would understate how long people
      // who are still here have already stuck around.
      const currentMembers = memberRoster.filter((m) => m.status !== 'Left');
      const departedMembers = memberRoster.filter((m) => m.status === 'Left');

      const currentTenureDays = currentMembers
        .map((m) => { const j = joinDateFor(m); return j ? daysBetween(j, today) : null; })
        .filter((d) => d !== null && d >= 0);
      const avgCurrentTenure = currentTenureDays.length
        ? Math.round(currentTenureDays.reduce((a, b) => a + b, 0) / currentTenureDays.length)
        : null;

      const departedTenureDays = departedMembers
        .map((m) => {
          const j = joinDateFor(m);
          const endRaw = m.profile?.leftAt || m.lastPaymentDate;
          const end = endRaw ? new Date(endRaw) : null;
          return j && end ? daysBetween(j, end) : null;
        })
        .filter((d) => d !== null && d >= 0);
      const avgDepartedTenure = departedTenureDays.length
        ? Math.round(departedTenureDays.reduce((a, b) => a + b, 0) / departedTenureDays.length)
        : null;

      // Time to employment: join date -> jobPlacedDate, only for members
      // actually marked Job Placed with a real placement date on file.
      const employmentDays = memberRoster
        .filter((m) => m.profile?.jobReadiness === 'Job Placed' && m.profile?.jobPlacedDate)
        .map((m) => { const j = joinDateFor(m); return j ? daysBetween(j, new Date(m.profile.jobPlacedDate)) : null; })
        .filter((d) => d !== null && d >= 0);
      const avgTimeToEmployment = employmentDays.length
        ? Math.round(employmentDays.reduce((a, b) => a + b, 0) / employmentDays.length)
        : null;

      // Time to first certificate: prefers an exact match on
      // cert_calendar.member_email (43_cert_calendar_member_email.sql) -
      // always exact for a member's own self-submitted entry, and exact for
      // an admin-added one wherever the admin filled in the email. Falls
      // back to matching cert_calendar.member (a free-text name) against
      // each member's display name for older entries with no email on
      // file - approximate, and undercounts anyone whose name is formatted
      // differently between the two tables.
      const passedCerts = certs.filter((c) => c.result === 'Passed');
      const firstPassedCertByEmail = passedCerts.reduce((acc, c) => {
        if (!c.memberEmail) return acc;
        const key = c.memberEmail.toLowerCase();
        const d = new Date(c.date);
        if (!acc[key] || d < acc[key]) acc[key] = d;
        return acc;
      }, {});
      const firstPassedCertByName = passedCerts.reduce((acc, c) => {
        const key = c.member.trim().toLowerCase();
        const d = new Date(c.date);
        if (!acc[key] || d < acc[key]) acc[key] = d;
        return acc;
      }, {});
      const certMatches = memberRoster
        .map((m) => {
          const byEmail = firstPassedCertByEmail[m.email.toLowerCase()];
          const firstPass = byEmail || firstPassedCertByName[m.member.trim().toLowerCase()];
          if (!firstPass) return null;
          const j = joinDateFor(m);
          const days = j ? daysBetween(j, firstPass) : null;
          return days !== null && days >= 0 ? { days, exact: !!byEmail } : null;
        })
        .filter((entry) => entry !== null);
      const firstCertDays = certMatches.map((entry) => entry.days);
      const exactCertMatches = certMatches.filter((entry) => entry.exact).length;
      const avgTimeToFirstCert = firstCertDays.length
        ? Math.round(firstCertDays.reduce((a, b) => a + b, 0) / firstCertDays.length)
        : null;

      // Avg days between 1on1s: how often a member actually gets a session,
      // not just when their last one was. Built from meetingDatesByEmail -
      // every synced meeting date per member, matched by attendee email the
      // same way lastMeetingByEmail already is (Members tab's "Sync Last
      // 1on1 Dates"). One average gap per member first (so a member with
      // many sessions doesn't outweigh one with few), then averaged across
      // members - members with fewer than 2 synced meetings have no gap to
      // measure and are excluded rather than counted as "never".
      const memberMeetingGapAverages = Object.values(meetingDatesByEmail)
        .map((dates) => {
          const sorted = [...new Set(dates)].sort((a, b) => new Date(a) - new Date(b));
          if (sorted.length < 2) return null;
          const gaps = [];
          for (let i = 1; i < sorted.length; i++) {
            gaps.push(daysBetween(new Date(sorted[i - 1]), new Date(sorted[i])));
          }
          return gaps.reduce((a, b) => a + b, 0) / gaps.length;
        })
        .filter((v) => v !== null);
      const avgDaysBetweenMeetings = memberMeetingGapAverages.length
        ? Math.round(memberMeetingGapAverages.reduce((a, b) => a + b, 0) / memberMeetingGapAverages.length)
        : null;
      const hasMeetingSyncData = Object.keys(meetingDatesByEmail).length > 0;

      // Demographics - straight counts from member_profiles fields already
      // loaded, sorted largest bucket first.
      const bucketBy = (getKey) => {
        const counts = {};
        memberRoster.forEach((m) => {
          const key = getKey(m) || 'Not set';
          counts[key] = (counts[key] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
      };
      const ageBuckets = bucketBy((m) => m.profile?.age);
      const genderBuckets = bucketBy((m) => m.profile?.gender);
      const locationBuckets = bucketBy((m) => m.profile?.location);

      // Tab popularity - % of the last 30 days' active members who opened
      // each tab, not % of the whole roster (a member who hasn't touched
      // the portal at all in 30 days shouldn't drag every tab's number
      // down just for existing).
      const renderTabEngagementBars = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {portalTabEngagement.map(({ tab, memberCount }) => {
            const pct = portalActiveMembers30d ? Math.round((memberCount / portalActiveMembers30d) * 100) : 0;
            return (
              <div key={tab}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{tab}</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{memberCount} ({pct}%)</strong>
                </div>
                <div style={{ width: '100%', height: '7px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))', borderRadius: '4px' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      );

      const weeklyTrendData = portalWeeklyTrend.map((w) => ({
        // Short "11 Aug" form for the chart's x-axis - formatDate's usual
        // "11 - August - 2026" is too wide for weekly tick labels.
        week: new Date(`${w.weekStart}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
        'Active Members': w.activeMembers,
      }));

      // Exam Readiness nudge - members with a real, upcoming, still-Pending
      // exam (within EXAM_NUDGE_WINDOW_DAYS) whose readiness score is under
      // EXAM_NUDGE_THRESHOLD_PCT. Only certs with a defined readiness
      // catalog count (matchExamReadinessCert returns null for anything
      // else) - a cert we don't track readiness for has nothing to flag.
      const atRiskExams = certs
        .filter((c) => c.result === 'Pending')
        .map((c) => {
          // realNow, not the frozen `today` anchor above - a genuine
          // "how many real days until this exam" countdown, same reasoning
          // as the renewal countdowns elsewhere in this tab.
          const daysLeft = Math.ceil((new Date(c.date) - realNow) / (1000 * 60 * 60 * 24));
          const certKey = matchExamReadinessCert(c.cert);
          if (!certKey || daysLeft < 0 || daysLeft > EXAM_NUDGE_WINDOW_DAYS) return null;
          const catalog = EXAM_READINESS_CATALOGS[certKey];
          const row = examReadinessRows.find((r) => r.certName === certKey && r.memberEmail === (c.memberEmail || '').toLowerCase());
          const readinessPct = computeReadinessPercent(catalog.milestones, row?.checklist, row?.latestPracticeScore);
          if (readinessPct >= EXAM_NUDGE_THRESHOLD_PCT) return null;
          return { ...c, certLabel: catalog.label, daysLeft, readinessPct };
        })
        .filter((x) => x !== null)
        .sort((a, b) => a.daysLeft - b.daysLeft);

      const renderBreakdownBars = (buckets) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {buckets.map(([label, count]) => {
            const pct = Math.round((count / memberRoster.length) * 100);
            return (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{count} ({pct}%)</strong>
                </div>
                <div style={{ width: '100%', height: '7px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))', borderRadius: '4px' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      );

      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Insights</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Retention, time-to-outcome, and who the community actually is - computed from real member data, not modeled.</p>
          </div>

          <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Avg Tenure - Current Members</span>
                <Clock size={20} color="var(--accent-cyan)" />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>{formatDays(avgCurrentTenure)}</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Based on {currentTenureDays.length} of {currentMembers.length} still-here members with a known join date</div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Avg Tenure Before Leaving</span>
                <Flag size={20} color="var(--danger)" />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>{formatDays(avgDepartedTenure)}</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Based on {departedTenureDays.length} of {departedMembers.length} departed members with known join/leave dates</div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Avg Time to Employment</span>
                <Briefcase size={20} color="var(--success)" />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>{formatDays(avgTimeToEmployment)}</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Join date to placement date, {employmentDays.length} member{employmentDays.length === 1 ? '' : 's'} marked Job Placed with a date on file</div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Avg Time to First Cert</span>
                <Award size={20} color="var(--accent-purple)" />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>{formatDays(avgTimeToFirstCert)}</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {firstCertDays.length} member{firstCertDays.length === 1 ? '' : 's'} with a passed cert
                {firstCertDays.length > 0 && ` (${exactCertMatches} exact by email, ${firstCertDays.length - exactCertMatches} approximate by name)`}
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Avg Days Between 1on1s</span>
                <CalendarClock size={20} color="var(--accent-cyan)" />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>{formatDays(avgDaysBetweenMeetings)}</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {hasMeetingSyncData
                  ? memberMeetingGapAverages.length
                    ? `Based on ${memberMeetingGapAverages.length} member${memberMeetingGapAverages.length === 1 ? '' : 's'} with 2+ synced meetings since 1 Jan 2026`
                    : 'Synced, but no member has 2+ meetings yet to measure a gap'
                  : 'Sync Last 1on1 Dates on the Members tab first'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>By Age</h3>
              {ageBuckets.length ? renderBreakdownBars(ageBuckets) : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No data yet.</p>}
            </div>
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>By Gender</h3>
              {genderBuckets.length ? renderBreakdownBars(genderBuckets) : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No data yet.</p>}
            </div>
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>By Location</h3>
              {locationBuckets.length ? renderBreakdownBars(locationBuckets) : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No data yet.</p>}
            </div>
          </div>

          <div style={{ marginTop: '40px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '6px' }}>Portal Usage</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Which tabs and features members actually use - real usage events, not modeled.</p>
          </div>

          {isMockSession ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Portal usage data isn't tracked for Mock Member demo sessions.</p>
          ) : portalAnalyticsError ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>{portalAnalyticsError}</p>
          ) : loadingPortalAnalytics ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading usage data...</p>
          ) : (
            <>
              <div className="dashboard-grid" style={{ marginBottom: '20px' }}>
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Weekly Active Members</span>
                    <Activity size={20} color="var(--accent-cyan)" />
                  </div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>{portalActiveMembers7d ?? '—'}</h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Distinct members with any portal activity in the last 7 days</div>
                </div>

                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Monthly Active Members</span>
                    <LayoutGrid size={20} color="var(--accent-purple)" />
                  </div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>{portalActiveMembers30d ?? '—'}</h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Distinct members with any portal activity in the last 30 days</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                <div className="glass-card">
                  <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Tab Popularity (last 30 days)</h3>
                  {portalTabEngagement.length
                    ? renderTabEngagementBars()
                    : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No tab activity logged yet.</p>}
                </div>

                <div className="glass-card">
                  <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Engagement Trend (8 weeks)</h3>
                  {weeklyTrendData.length ? (
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer>
                        <LineChart data={weeklyTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-color)' }} tickLine={false} width={28} />
                          <Tooltip
                            contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem' }}
                            labelStyle={{ color: 'var(--text-primary)' }}
                          />
                          <Line type="monotone" dataKey="Active Members" stroke="var(--accent-cyan)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-cyan)' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No usage history yet - check back after a week or two of real portal activity.</p>
                  )}
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: '40px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '6px' }}>Exam Readiness Nudge</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Members with an exam in the next {EXAM_NUDGE_WINDOW_DAYS} days who are under {EXAM_NUDGE_THRESHOLD_PCT}% ready - worth a proactive check-in before it's too late to matter.
            </p>
          </div>

          {isMockSession ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Exam readiness data isn't tracked for Mock Member demo sessions.</p>
          ) : examReadinessError ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>{examReadinessError}</p>
          ) : loadingCerts || loadingExamReadiness ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</p>
          ) : atRiskExams.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nobody's currently at risk - every upcoming exam in the next {EXAM_NUDGE_WINDOW_DAYS} days is either on track or not yet trackable (only Security+, AZ-900, SC-200, SC-900, CySA+, and eJPT have a readiness program today).</p>
          ) : (
            <div className="glass-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {atRiskExams.map((x) => (
                  <div
                    key={x.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: 'var(--border-radius-sm)',
                      background: 'rgba(var(--danger-rgb), 0.06)',
                      border: '1px solid rgba(var(--danger-rgb), 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{x.member}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{x.certLabel}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Exam in</div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{x.daysLeft} day{x.daysLeft === 1 ? '' : 's'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Readiness</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--danger)' }}>{x.readinessPct}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'community-content':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}><Megaphone size={28} color="var(--accent-cyan)" /> Community Content</h1>
            <p style={{ color: 'var(--text-secondary)' }}>What members see on their Dashboard - the Community Broadcast feed, Recent Wins, and Suggested Content. Real content, editable here instead of a code change.</p>
          </div>

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login.
            </div>
          )}

          {/* Community Broadcast */}
          <div className="glass-card" style={{ marginBottom: '28px' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Megaphone size={18} color="var(--warning)" /> Community Broadcast
            </h3>
            {broadcastsError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{broadcastsError}</p>}

            <form onSubmit={handleAddBroadcast} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 2fr 90px auto', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
              <input className="form-input" value={newBroadcast.emoji} onChange={(e) => setNewBroadcast({ ...newBroadcast, emoji: e.target.value })} placeholder="🎯" />
              <input className="form-input" value={newBroadcast.title} onChange={(e) => setNewBroadcast({ ...newBroadcast, title: e.target.value })} placeholder="Title, e.g. Sprint 4 Active:" />
              <input className="form-input" value={newBroadcast.body} onChange={(e) => setNewBroadcast({ ...newBroadcast, body: e.target.value })} placeholder="Body text" />
              <input type="number" className="form-input" value={newBroadcast.sortOrder} onChange={(e) => setNewBroadcast({ ...newBroadcast, sortOrder: e.target.value })} placeholder="Order" />
              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '10px 16px' }}><Plus size={14} /> Add</button>
            </form>

            {loadingBroadcasts ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</p>
            ) : broadcasts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing posted yet - members will see an empty state.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {broadcasts.map((b) =>
                  editingBroadcastId === b.id ? (
                    <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 2fr 90px auto', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--accent-cyan)' }}>
                      <input className="form-input" value={editBroadcastForm.emoji} onChange={(e) => setEditBroadcastForm({ ...editBroadcastForm, emoji: e.target.value })} />
                      <input className="form-input" value={editBroadcastForm.title} onChange={(e) => setEditBroadcastForm({ ...editBroadcastForm, title: e.target.value })} />
                      <input className="form-input" value={editBroadcastForm.body} onChange={(e) => setEditBroadcastForm({ ...editBroadcastForm, body: e.target.value })} />
                      <input type="number" className="form-input" value={editBroadcastForm.sortOrder} onChange={(e) => setEditBroadcastForm({ ...editBroadcastForm, sortOrder: e.target.value })} />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 10px' }} onClick={() => handleSaveBroadcastEdit(b)}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 10px' }} onClick={() => setEditingBroadcastId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{b.emoji} {b.title}</strong>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{b.body}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {!b.active && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Inactive</span>}
                        <button onClick={() => startEditBroadcast(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }} aria-label="Edit broadcast"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteBroadcast(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex' }} aria-label="Delete broadcast"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Recent Wins */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="var(--accent-purple)" /> Recent Wins
            </h3>
            {winsError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{winsError}</p>}

            <form onSubmit={handleAddWin} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 140px 1fr auto', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
              <input className="form-input" value={newWin.member} onChange={(e) => setNewWin({ ...newWin, member: e.target.value })} placeholder="Member name" />
              <input className="form-input" value={newWin.achievement} onChange={(e) => setNewWin({ ...newWin, achievement: e.target.value })} placeholder="e.g. earned CompTIA Security+" />
              <input type="date" className="form-input" value={newWin.achievedDate} onChange={(e) => setNewWin({ ...newWin, achievedDate: e.target.value })} />
              <input className="form-input" value={newWin.linkedinUrl} onChange={(e) => setNewWin({ ...newWin, linkedinUrl: e.target.value })} placeholder="LinkedIn link (optional)" />
              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '10px 16px' }}><Plus size={14} /> Add</button>
            </form>

            {loadingWins ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</p>
            ) : wins.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No wins posted yet - members will see an empty state.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {wins.map((w) =>
                  editingWinId === w.id ? (
                    <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 140px 1fr auto', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--accent-cyan)' }}>
                      <input className="form-input" value={editWinForm.member} onChange={(e) => setEditWinForm({ ...editWinForm, member: e.target.value })} />
                      <input className="form-input" value={editWinForm.achievement} onChange={(e) => setEditWinForm({ ...editWinForm, achievement: e.target.value })} />
                      <input type="date" className="form-input" value={editWinForm.achievedDate} onChange={(e) => setEditWinForm({ ...editWinForm, achievedDate: e.target.value })} />
                      <input className="form-input" value={editWinForm.linkedinUrl} onChange={(e) => setEditWinForm({ ...editWinForm, linkedinUrl: e.target.value })} />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 10px' }} onClick={() => handleSaveWinEdit(w)}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 10px' }} onClick={() => setEditingWinId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{w.member}</strong> {w.achievement}
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                          {formatDate(w.achievedDate)}
                          {isSafeUrl(w.linkedinUrl) && (
                            <a href={w.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', marginLeft: '8px' }}>LinkedIn</a>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {!w.active && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Inactive</span>}
                        <button onClick={() => startEditWin(w)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }} aria-label="Edit win"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteWin(w)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex' }} aria-label="Delete win"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Suggested Content */}
          <div className="glass-card" style={{ marginTop: '28px' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-purple)" /> Suggested Content
            </h3>
            {suggestionsError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{suggestionsError}</p>}

            <form onSubmit={handleAddSuggestion} style={{ display: 'grid', gridTemplateColumns: '140px 1.5fr 2fr auto', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
              <select className="form-input" value={newSuggestion.contentType} onChange={(e) => setNewSuggestion({ ...newSuggestion, contentType: e.target.value })}>
                <option value="Video">Video</option>
                <option value="Article">Article</option>
                <option value="TikTok">TikTok</option>
                <option value="Meme">Meme</option>
                <option value="Screenshot">Screenshot</option>
                <option value="Other">Other</option>
              </select>
              <input className="form-input" value={newSuggestion.title} onChange={(e) => setNewSuggestion({ ...newSuggestion, title: e.target.value })} placeholder="Title, e.g. How to structure a SOC analyst CV" />
              <input className="form-input" value={newSuggestion.url} onChange={(e) => setNewSuggestion({ ...newSuggestion, url: e.target.value })} placeholder="Link" />
              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '10px 16px' }}><Plus size={14} /> Add</button>
            </form>

            {loadingSuggestions ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading...</p>
            ) : suggestions.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing suggested yet - members will see an empty state.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {suggestions.map((s) =>
                  editingSuggestionId === s.id ? (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '140px 1.5fr 2fr auto', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--accent-cyan)' }}>
                      <select className="form-input" value={editSuggestionForm.contentType} onChange={(e) => setEditSuggestionForm({ ...editSuggestionForm, contentType: e.target.value })}>
                        <option value="Video">Video</option>
                        <option value="Article">Article</option>
                        <option value="TikTok">TikTok</option>
                        <option value="Meme">Meme</option>
                        <option value="Screenshot">Screenshot</option>
                        <option value="Other">Other</option>
                      </select>
                      <input className="form-input" value={editSuggestionForm.title} onChange={(e) => setEditSuggestionForm({ ...editSuggestionForm, title: e.target.value })} />
                      <input className="form-input" value={editSuggestionForm.url} onChange={(e) => setEditSuggestionForm({ ...editSuggestionForm, url: e.target.value })} />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 10px' }} onClick={() => handleSaveSuggestionEdit(s)}>Save</button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 10px' }} onClick={() => setEditingSuggestionId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.62rem', marginRight: '8px' }}>{s.contentType}</span>
                        <strong>{s.title}</strong>
                        {isSafeUrl(s.url) && (
                          <div style={{ marginTop: '2px' }}>
                            <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', fontSize: '0.78rem' }}>{s.url}</a>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {!s.active && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Inactive</span>}
                        <button onClick={() => startEditSuggestion(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }} aria-label="Edit suggestion"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteSuggestion(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex' }} aria-label="Delete suggestion"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      );

    case 'certifications':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Member Certification Tracker</h1>
            <p>Monitor member target exam dates, active certification cohorts, and days remaining until exam day.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="glass-card" style={{ border: '1px solid var(--success)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Certifications Passed This Month</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--success)', fontWeight: 700 }}>{certsPassedThisMonth}</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{today.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}</div>
            </div>
            <div className="glass-card" style={{ border: '1px solid var(--accent-cyan)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Certifications Passed This Year</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--accent-cyan)', fontWeight: 700 }}>{certsPassedThisYear}</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{today.getFullYear()} to date</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            {/* Add Member Exam Form */}
            <div className="glass-card" style={{ height: 'fit-content' }}>
              <h3 style={{ marginBottom: '20px' }}>Add Member Exam</h3>
              <form onSubmit={handleAddCert} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Member Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sanele Khumalo"
                    value={newCert.member}
                    onChange={(e) => setNewCert({ ...newCert, member: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Member Email (optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. sanele@gmail.com"
                    value={newCert.memberEmail}
                    onChange={(e) => setNewCert({ ...newCert, memberEmail: e.target.value })}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Makes "time to first cert" on Insights exact instead of matched by name.
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Certification Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. OSCP Penetration Tester"
                    value={newCert.cert}
                    onChange={(e) => setNewCert({ ...newCert, cert: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Target Exam Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newCert.date}
                      onChange={(e) => setNewCert({ ...newCert, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Cohort Tag</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. OSCP-26B"
                      value={newCert.cohort}
                      onChange={(e) => setNewCert({ ...newCert, cohort: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '8px' }}>
                  <Plus size={16} /> Save Member Exam Target
                </button>
              </form>
            </div>

            {/* Member Cert Countdown Cards */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>Upcoming Member Exams</h3>
                <span className="badge badge-success">{certs.length} Members Scheduled</span>
              </div>

              {certsError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{certsError}</p>}
              {loadingCerts && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>Loading cert calendar...</p>}

              {/* Passed exams sink to the bottom - this section is about what's
                  still upcoming, so a resolved cert shouldn't compete for the
                  same visual priority as one still awaiting a result. */}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {[...certs]
                  .sort((a, b) => (a.result === 'Passed' ? 1 : 0) - (b.result === 'Passed' ? 1 : 0))
                  .map((c) => {
                  const targetDate = new Date(c.date);
                  const today = new Date();
                  const diffTime = targetDate - today;
                  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const isUrgent = daysLeft <= 14;

                  if (editingCertId === c.id) {
                    return (
                      <div key={c.id} style={{ padding: '20px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--accent-cyan)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input className="form-input" value={editCertForm.member} onChange={(e) => setEditCertForm({ ...editCertForm, member: e.target.value })} placeholder="Member name" />
                        <input type="email" className="form-input" value={editCertForm.memberEmail} onChange={(e) => setEditCertForm({ ...editCertForm, memberEmail: e.target.value })} placeholder="Member email (optional)" />
                        <input className="form-input" value={editCertForm.cert} onChange={(e) => setEditCertForm({ ...editCertForm, cert: e.target.value })} placeholder="Certification" />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <input type="date" className="form-input" value={editCertForm.date} onChange={(e) => setEditCertForm({ ...editCertForm, date: e.target.value })} />
                          <input className="form-input" value={editCertForm.cohort} onChange={(e) => setEditCertForm({ ...editCertForm, cohort: e.target.value })} placeholder="Cohort" />
                        </div>
                        <select className="form-input" value={editCertForm.result} onChange={(e) => setEditCertForm({ ...editCertForm, result: e.target.value })}>
                          <option value="Pending">Pending</option>
                          <option value="Passed">Passed</option>
                          <option value="Failed">Failed</option>
                        </select>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setEditingCertId(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => handleSaveCertEdit(c)}>Save</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCert(c)}
                      style={{
                        padding: '20px',
                        borderRadius: 'var(--border-radius-md)',
                        background: 'rgba(var(--overlay-rgb), 0.02)',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {c.result === 'Passed' ? (
                              <span className="badge badge-success">Passed</span>
                            ) : c.result === 'Failed' ? (
                              <span className="badge badge-danger">Failed</span>
                            ) : (
                              <span className={`badge ${daysLeft <= 7 ? 'badge-danger' : isUrgent ? 'badge-warning' : 'badge-success'}`}>
                                {daysLeft > 0 ? `${daysLeft} Day${daysLeft === 1 ? '' : 's'} Left` : daysLeft === 0 ? 'Exam Today!' : 'Awaiting Result'}
                              </span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); startEditCert(c); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }} aria-label="Edit entry">
                              <Pencil size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteCert(c); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }} aria-label="Delete entry">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{c.member}</h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.cert} <Info size={14} color="var(--accent-cyan)" />
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Target Exam Date:</span>
                        <strong style={{ color: 'var(--accent-cyan)' }}>{formatDate(c.date)}</strong>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Result</label>
                        <select
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                          value={c.result || 'Pending'}
                          onChange={(e) => handleUpdateCertResult(c.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Passed">Passed</option>
                          <option value="Failed">Failed</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cert Details Modal */}
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

    case 'payments':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>PayFast Subscriptions & Audit Log</h1>
            <p>Official statement of Hacking Hub transactions processed via PayFast SA since Jan 1, 2026.</p>
          </div>

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '24px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — any EFT payment you record here is local only and will be lost on your next login. Sign in with Google to save for real.
            </div>
          )}
          {!isMockSession && savedMemberDataError && (
            <div style={{ padding: '12px 16px', marginBottom: '24px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.85rem' }}>
              Couldn't save/load payment data from Supabase: {savedMemberDataError}
            </div>
          )}

          {/* PayFast Gateway Status & Realtime Metrics */}
          <div className="metrics-row" style={{ marginBottom: '32px' }}>
            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Gross Sales (ZAR)</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--success)' }}>
                R {totalGrossRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{totalTransactions} Total Transactions</div>
            </div>

            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Net Payout Received</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--accent-cyan)' }}>
                R {totalNetRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>After PayFast processing fees</div>
            </div>

            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PayFast Merchant Fees Paid</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--warning)' }}>
                R {totalFeesPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Avg Fee: 3.5% + R2.00 per tx</div>
            </div>
          </div>

          {/* PayFast Gateway Status Banner */}
          <div className="glass-card" style={{ marginBottom: '32px', border: '1px solid var(--success)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <CreditCard size={22} color="var(--success)" />
                  <h3 style={{ margin: 0 }}>PayFast Gateway Status</h3>
                  {isMockSession ? (
                    <span className="badge badge-warning">MOCK ADMIN - LIVE FEED UNAVAILABLE</span>
                  ) : loadingLivePayments ? (
                    <span className="badge badge-warning">SYNCING...</span>
                  ) : livePaymentsError ? (
                    <span className="badge badge-danger">LIVE FEED ERROR</span>
                  ) : (
                    <span className="badge badge-success">LIVE via payfast-webhook</span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {livePaymentsError
                    ? `Couldn't reach the live transaction feed: ${livePaymentsError}`
                    : 'Historical snapshot (Jan 1 - Aug 5, 2026) plus everything recorded live since, straight from PayFast\'s payment notification.'}
                  {' '}+ manually recorded EFT payments
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setShowEftModal(true)}>
                  <Landmark size={16} /> Record EFT Payment
                </button>
              </div>
            </div>
          </div>

          {/* PayFast Filterable Transactions Table */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>PayFast Transaction Audit Table</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Showing {filteredPayments.length} of {payments.length} transactions</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', background: 'rgba(var(--overlay-rgb), 0.02)', padding: '8px 14px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', minWidth: '280px' }}>
                <Search size={18} color="var(--text-muted)" style={{ marginTop: '2px' }} />
                <input
                  type="text"
                  placeholder="Search member, email, or reference ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none', width: '100%' }}
                />
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Date & Time</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Reference ID</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Member & Email</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Plan Type</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Funding</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Gross</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Fee</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Net Payout</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(var(--overlay-rgb), 0.02)' }}>
                    <td style={{ padding: '16px 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{formatDate(p.date)}</td>
                    <td style={{ padding: '16px 12px', fontFamily: 'monospace', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{p.pfId}</td>
                    <td style={{ padding: '16px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{p.member}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.email}</div>
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{p.plan}</span>
                    </td>
                    <td style={{ padding: '16px 12px', fontSize: '0.8rem' }}>
                      {p.fundingType === 'EFT' ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>EFT · Manually Recorded</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{p.fundingType || 'Credit Card'}</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 12px', fontWeight: 700, color: '#fff' }}>R {p.amount.toFixed(2)}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--warning)', fontSize: '0.85rem' }}>-R {(p.fee || 0).toFixed(2)}</td>
                    <td style={{ padding: '16px 12px', fontWeight: 700, color: 'var(--success)' }}>R {(p.net || (p.amount - (p.fee || 0))).toFixed(2)}</td>
                    <td style={{ padding: '16px 12px' }}>
                      {p.fundingType === 'EFT' && (
                        <button onClick={() => handleDeleteEftPayment(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }} aria-label="Delete EFT payment">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showEftModal && (
            <RecordEftPaymentModal
              members={memberRoster}
              onSave={handleRecordEftPayment}
              onClose={() => setShowEftModal(false)}
            />
          )}
        </div>
      );

    case 'finances':
      // Calculate Year (2026), Month (Aug 2026), and Week (Past 7 days) Gross Revenue
      const yearlyRevenue = payments.reduce((acc, p) => acc + p.amount, 0);

      const monthlyRevenue = payments
        .filter(p => p.date.startsWith('2026-08'))
        .reduce((acc, p) => acc + p.amount, 0);

      const past7DaysCutoff = new Date(realNow.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weeklyRevenue = payments
        .filter(p => new Date(p.date) >= past7DaysCutoff)
        .reduce((acc, p) => acc + p.amount, 0);

      // Last 5 Transactions, newest first - `payments` isn't kept in date order
      // (it's assembled from separate live/EFT/historical sources), so this has
      // to sort explicitly rather than trust array position.
      const last5Transactions = [...payments]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      // Next 5 Upcoming Recurring Payments (Calculated 30 days after each member's MOST
      // RECENT payment date). Only plans that actually renew monthly qualify - Permanent
      // Access, Maintenance Fees, and Refunds don't have a "next renewal". Renewals already
      // in the past (member likely churned) are excluded rather than shown as overdue.
      const recurringPlans = ['Basic Access', 'Monthly Operative', 'Custom Plan'];
      const latestRecurringPaymentByEmail = new Map();
      payments
        .filter(p => p.type === 'Funds Received' && recurringPlans.includes(p.plan))
        .forEach(p => {
          const key = p.email.toLowerCase();
          const existing = latestRecurringPaymentByEmail.get(key);
          if (!existing || new Date(p.date) > new Date(existing.date)) {
            latestRecurringPaymentByEmail.set(key, p);
          }
        });

      const upcomingPayments = [...latestRecurringPaymentByEmail.values()]
        .map(p => {
          const lastDate = new Date(p.date);
          const nextDate = new Date(lastDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          const nextDateStr = nextDate.toISOString().split('T')[0];
          const daysUntil = Math.ceil((nextDate - realNow) / (1000 * 60 * 60 * 24));
          return {
            id: p.id,
            member: p.member,
            email: p.email,
            plan: p.plan,
            amount: p.amount,
            nextDateStr,
            daysUntil,
          };
        })
        .filter(u => u.daysUntil >= 0)
        .sort((a, b) => new Date(a.nextDateStr) - new Date(b.nextDateStr))
        .slice(0, 5);

      // Revenue Distribution by Plan
      const planBreakdown = payments.reduce((acc, p) => {
        acc[p.plan] = (acc[p.plan] || 0) + p.amount;
        return acc;
      }, {});

      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Financial Ledger & PayFast Intelligence</h1>
            <p>Live gross income breakdowns (Yearly, Monthly, Weekly), transaction history, and upcoming recurring subscription renewals.</p>
          </div>

          {/* Gross Revenue Timeframe Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="glass-card" style={{ border: '1px solid var(--success)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yearly Gross Revenue (2026)</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--success)', fontWeight: 700 }}>
                R {yearlyRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Jan 1 – Aug 7, 2026</div>
            </div>

            <div className="glass-card" style={{ border: '1px solid var(--accent-cyan)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Gross Revenue (Aug)</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                R {monthlyRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>August 2026 to date</div>
            </div>

            <div className="glass-card" style={{ border: '1px solid var(--accent-purple)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weekly Gross Revenue</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--accent-purple)', fontWeight: 700 }}>
                R {weeklyRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Past 7 Days</div>
            </div>

            <div className="glass-card">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Recurring (MRR)</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: '#fff', fontWeight: 700 }}>
                R {monthlyRecurringRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Active Membership Run-Rate</div>
            </div>
          </div>

          {/* Last 5 Transactions & Next 5 Upcoming Renewals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            {/* Last 5 Transactions */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={20} color="var(--success)" />
                  <h3 style={{ margin: 0 }}>Last 5 Transactions</h3>
                </div>
                <span className="badge badge-success">Processed</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Member</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Plan</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {last5Transactions.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(var(--overlay-rgb), 0.02)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{t.member}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.email}</div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{t.plan}</span>
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.date.split(' ')[0]}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--success)' }}>R {t.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Next 5 Upcoming Recurring Payments */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color="var(--accent-cyan)" />
                  <h3 style={{ margin: 0 }}>Next 5 Upcoming Renewals</h3>
                </div>
                <span className="badge badge-warning">Recurring Subscriptions</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Member</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Plan</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Next Billing</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Expected Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingPayments.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(var(--overlay-rgb), 0.02)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{u.member}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{u.plan}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '0.82rem' }}>{u.nextDateStr}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>In {u.daysUntil} days</div>
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: '#fff' }}>R {u.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue Distribution & Net Profit Analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Revenue Distribution by Membership Tier */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px' }}>Revenue Distribution by Clearance Tier</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(planBreakdown).map(([planName, amount]) => {
                  const percent = Math.round((amount / yearlyRevenue) * 100);
                  return (
                    <div key={planName}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600 }}>{planName}</span>
                        <strong style={{ color: 'var(--accent-cyan)' }}>R {amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} ({percent}%)</strong>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-purple))', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Net Settlement vs Gateway Fees Summary */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px' }}>PayFast Settlement & Net Margin</h3>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Gross Volume Processed:</span>
                  <strong>R {totalGrossRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>PayFast Processing Fees Paid:</span>
                  <strong style={{ color: 'var(--warning)' }}>-R {totalFeesPaid.toFixed(2)}</strong>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700 }}>
                  <span style={{ color: '#fff' }}>Net Bank Settlement:</span>
                  <strong style={{ color: 'var(--success)' }}>R {totalNetRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Net Retention Rate: <strong style={{ color: 'var(--success)' }}>{((totalNetRevenue / totalGrossRevenue) * 100).toFixed(1)}%</strong> of gross revenue retained after card processing fees.
              </div>
            </div>
          </div>

          {/* Business Expenses - the money-out side, kept as its own log
              rather than folded into the PayFast net-margin figures above. */}
          <div className="glass-card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} color="var(--warning)" />
                <h3 style={{ margin: 0 }}>Business Expenses</h3>
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--warning)' }}>
                Total: R {expenses.reduce((acc, x) => acc + x.amount, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {isMockSession && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                You're using Mock Admin — expenses only persist for a real signed-in session.
              </div>
            )}
            {!isMockSession && expensesError && (
              <div style={{ padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.85rem' }}>
                {expensesError}
              </div>
            )}

            <form onSubmit={handleAddExpense} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 160px auto', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
              <select className="form-input" value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="form-input" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} placeholder="Description" />
              <input type="number" step="0.01" className="form-input" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} placeholder="Amount (R)" />
              <input type="date" className="form-input" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} />
              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '10px 16px' }}>
                <Plus size={14} /> Add
              </button>
            </form>

            {loadingExpenses ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading expenses...</p>
            ) : expenses.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No expenses logged yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Category</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Description</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>Amount</th>
                    <th style={{ padding: '10px 8px', color: 'var(--text-muted)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((x) =>
                    editingExpenseId === x.id ? (
                      <tr key={x.id} style={{ borderBottom: '1px solid rgba(var(--overlay-rgb), 0.02)' }}>
                        <td style={{ padding: '10px 8px' }}>
                          <input type="date" className="form-input" style={{ fontSize: '0.8rem', padding: '6px 8px' }} value={editExpenseForm.date} onChange={(e) => setEditExpenseForm({ ...editExpenseForm, date: e.target.value })} />
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <select className="form-input" style={{ fontSize: '0.8rem', padding: '6px 8px' }} value={editExpenseForm.category} onChange={(e) => setEditExpenseForm({ ...editExpenseForm, category: e.target.value })}>
                            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <input className="form-input" style={{ fontSize: '0.8rem', padding: '6px 8px' }} value={editExpenseForm.description} onChange={(e) => setEditExpenseForm({ ...editExpenseForm, description: e.target.value })} />
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <input type="number" step="0.01" className="form-input" style={{ fontSize: '0.8rem', padding: '6px 8px', width: '100px' }} value={editExpenseForm.amount} onChange={(e) => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })} />
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '6px 12px', marginRight: '6px' }} onClick={() => handleSaveExpenseEdit(x)}>Save</button>
                          <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setEditingExpenseId(null)}>Cancel</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={x.id} style={{ borderBottom: '1px solid rgba(var(--overlay-rgb), 0.02)' }}>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{x.date}</td>
                        <td style={{ padding: '12px 8px' }}><span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{x.category}</span></td>
                        <td style={{ padding: '12px 8px' }}>{x.description}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700 }}>R {x.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => startEditExpense(x)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', marginRight: '10px' }} aria-label="Edit expense">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteExpense(x)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex' }} aria-label="Delete expense">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      );

    case 'reviews': {
      const reviewCategories = ['All', 'Praise', 'Criticism', 'Recommendation', 'Feature Request', 'General'];
      const filteredReviews = reviewCategoryFilter === 'All'
        ? reviews
        : reviews.filter(r => r.category === reviewCategoryFilter);

      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Star size={28} color="var(--accent-cyan)" /> Member Reviews & Feedback
            </h1>
            <p>Everything members have submitted, including reviews they've kept private to admins only.</p>
          </div>

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '24px', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--warning-rgb), 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — real member reviews only load for a real signed-in session.
            </div>
          )}
          {!isMockSession && reviewsError && (
            <div style={{ padding: '12px 16px', marginBottom: '24px', color: 'var(--danger)', background: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(var(--danger-rgb), 0.2)', fontSize: '0.85rem' }}>
              Couldn't load reviews: {reviewsError}
            </div>
          )}
          {!isMockSession && loadingReviews && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Loading reviews...</div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {reviewCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setReviewCategoryFilter(cat)}
                className={`btn ${reviewCategoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '8px 14px' }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredReviews.map((r) => (
              <div key={r.id} className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{r.category}</span>
                    <span className={`badge ${r.visibility === 'Public' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
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
                  {r.memberName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {r.email}</span>
                </div>
              </div>
            ))}
            {!loadingReviews && filteredReviews.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No reviews {reviewCategoryFilter === 'All' ? 'yet' : `in "${reviewCategoryFilter}"`}.
              </div>
            )}
          </div>
        </div>
      );
    }

    default:
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Executive Control Center</h1>
            <p>Real-time overview of community growth, finances, 1on1 coaching, and platform metrics.</p>
          </div>
          <div className="metrics-row" style={{ marginBottom: '32px' }}>
            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Members</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px' }}>148</h2>
            </div>
            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Monthly Subscriptions</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--accent-cyan)' }}>94</h2>
            </div>
            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gross Revenue (YTD)</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--success)' }}>R {totalGrossRevenue.toLocaleString()}</h2>
            </div>
          </div>
        </div>
      );
  }
}
