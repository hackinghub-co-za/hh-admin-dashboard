import React, { useState, useEffect } from 'react';
import { fetchCalendarEvents, fetchCertCalendarEvents, fetchPastCalendarEvents } from '../../lib/googleCalendar';
import CertDetailsModal from '../../components/CertDetailsModal';
import MemberProfileModal from '../../components/MemberProfileModal';
import AddMemberModal from '../../components/AddMemberModal';
import RecordEftPaymentModal from '../../components/RecordEftPaymentModal';
import payfastTransactionsData from '../../data/payfastTransactions.json';
import { LAPSED_AFTER_DAYS, MEETING_OVERDUE_AFTER_DAYS, ROADMAP_TRACKS, ROADMAP_PHASES, CORE_FOUNDATIONS_CATALOG, CORE_FOUNDATIONS_MIN_REQUIRED, SPECIALIZATION_UNLOCK_MIN, SPECIALIZATION_CATALOGS } from '../../lib/memberOptions';
import { formatDate } from '../../lib/dateFormat';
import {
  fetchMemberProfiles,
  upsertMemberProfile,
  fetchManualMembers,
  insertManualMember,
  fetchEftPayments,
  insertEftPayment,
} from '../../lib/memberData';
import { fetchReviews } from '../../lib/reviewsData';
import { fetchAllReferrals } from '../../lib/referralsData';
import { friendlyErrorMessage } from '../../lib/errorMessages';
import { isSafeUrl } from '../../lib/safeUrl';
import { fetchCertCalendar, addCertCalendarEntry, updateCertCalendarResult, updateCertCalendarEntry, deleteCertCalendarEntry } from '../../lib/certCalendarData';
import { fetchExpenses, addExpense, updateExpense, deleteExpense } from '../../lib/expensesData';
import { fetchCommunityEvents, approveCommunityEvent } from '../../lib/eventsData';
import { fetchRoadmapForMember, addRoadmapItem, updateRoadmapItem, deleteRoadmapItem, setRoadmapFoundationsApproval } from '../../lib/roadmapData';
import { fetchOptinPool, fetchAllGroups, runMatchmakerRound, updateGroupStatus, deleteGroup } from '../../lib/matchmakerData';
import { fetchAllRoomLogs, reviewRoomLog } from '../../lib/roomLogData';
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
  ArrowUpRight,
  ArrowDownRight,
  Video,
  ExternalLink,
  RefreshCw,
  Award,
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
} from 'lucide-react';

export default function AdminDashboard({ activeTab, providerToken, isMockSession, user }) {
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  // Certifications state
  const [selectedCert, setSelectedCert] = useState(null);
  const [certEvents, setCertEvents] = useState([]);
  const [loadingCertEvents, setLoadingCertEvents] = useState(false);
  const [certEventsError, setCertEventsError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Roadmaps tab - one member's checklist at a time, admin-authored. Real
  // Supabase data for a real session (RLS grants admins full visibility via
  // is_admin()); Mock Admin has no real session, so it stays purely local.
  const [roadmapMemberEmail, setRoadmapMemberEmail] = useState(null);
  const [roadmapMemberSearch, setRoadmapMemberSearch] = useState('');
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [loadingRoadmapItems, setLoadingRoadmapItems] = useState(false);
  const [roadmapItemsError, setRoadmapItemsError] = useState(null);
  const [showAddRoadmapItemForm, setShowAddRoadmapItemForm] = useState(false);
  const [newRoadmapItem, setNewRoadmapItem] = useState({ phase: 'Core Foundations', category: '', title: '', detail: '' });
  const [editingRoadmapItemId, setEditingRoadmapItemId] = useState(null);
  const [editRoadmapItemForm, setEditRoadmapItemForm] = useState({ phase: '', category: '', title: '', detail: '' });
  // Mock Admin only - keeps locally-added/edited items around when switching
  // between members, since there's no real session to persist them to.
  const [mockRoadmapItemsByEmail, setMockRoadmapItemsByEmail] = useState({});

  // Mock Admin only - updates both the visible list and the per-email store
  // that survives switching to a different member and back.
  const applyMockRoadmapItems = (email, items) => {
    setRoadmapItems(items);
    setMockRoadmapItemsByEmail((prev) => ({ ...prev, [email.toLowerCase()]: items }));
  };

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
    setNewRoadmapItem({ phase: 'Core Foundations', category: '', title: '', detail: '' });
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
    setEditRoadmapItemForm({ phase: item.phase, category: item.category, title: item.title, detail: item.detail });
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
  }, [isMockSession]);

  const handleRunMatchmakerRound = async () => {
    setMatchmakerError(null);
    if (isMockSession) {
      if (optinPool.length < 2) {
        setMatchmakerError('Need at least 2 opted-in members to run a round.');
        return;
      }
      const shuffled = [...optinPool].sort(() => Math.random() - 0.5);
      const numGroups = Math.ceil(shuffled.length / 4);
      const newGroups = Array.from({ length: numGroups }, (_, i) => ({
        id: Date.now() + i,
        activityType: Math.random() < 0.5 ? 'Project' : 'Presentation',
        memberEmails: shuffled.filter((_, idx) => idx % numGroups === i),
        status: 'Active',
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
  }, [isMockSession]);

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
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Refer a Friend submissions - real Supabase data for a real session, a
  // small local demo set under Mock Admin since there's no session to fetch
  // against.
  const [referrals, setReferrals] = useState(isMockSession ? [
    { id: 1, referrerEmail: 'twala.ww@gmail.com', name: 'Nomvula Radebe', linkedin: 'https://www.linkedin.com/in/example', phone: '071 234 5678', createdAt: '2026-08-15T00:00:00Z' },
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
  }, [isMockSession]);

  // Members added by hand (no PayFast payment yet) - kept separate from the
  // payment-derived roster and merged in for display.
  const [manualMembers, setManualMembers] = useState([]);

  // Last 1on1 date per member, matched by email against Google Calendar attendees.
  // Pulled on demand (not automatically) since it's one real API call per sync.
  const [lastMeetingByEmail, setLastMeetingByEmail] = useState({});
  const [loadingMeetingSync, setLoadingMeetingSync] = useState(false);
  const [meetingSyncError, setMeetingSyncError] = useState(null);

  const handleSyncLastMeetings = () => {
    setLoadingMeetingSync(true);
    setMeetingSyncError(null);
    fetchPastCalendarEvents(providerToken, { sinceDate: '2026-01-01T00:00:00Z' })
      .then((events) => {
        const map = {};
        events.forEach((evt) => {
          evt.attendees.forEach((a) => {
            const key = a.email.toLowerCase();
            if (!map[key] || new Date(evt.start) > new Date(map[key])) {
              map[key] = evt.start;
            }
          });
        });
        setLastMeetingByEmail(map);
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
  }, [isMockSession]);

  const [newCert, setNewCert] = useState({ member: '', cert: '', date: '', cohort: '' });

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
        },
      ]);
    } else {
      try {
        await addCertCalendarEntry({ member: newCert.member, cert: newCert.cert, date: newCert.date, cohort: newCert.cohort, createdBy: user?.email });
        setCerts(await fetchCertCalendar());
      } catch (err) {
        setCertsError(friendlyErrorMessage(err));
        return;
      }
    }
    setNewCert({ member: '', cert: '', date: '', cohort: '' });
  };

  const handleUpdateCertResult = async (id, result) => {
    setCerts(certs.map(c => c.id === id ? { ...c, result } : c));
    if (!isMockSession) {
      try {
        await updateCertCalendarResult(id, result);
      } catch (err) {
        setCertsError(friendlyErrorMessage(err));
      }
    }
  };

  const [editingCertId, setEditingCertId] = useState(null);
  const [editCertForm, setEditCertForm] = useState({ member: '', cert: '', date: '', cohort: '', result: 'Pending' });

  const startEditCert = (c) => {
    setEditingCertId(c.id);
    setEditCertForm({ member: c.member, cert: c.cert, date: c.date, cohort: c.cohort || '', result: c.result || 'Pending' });
  };

  const handleSaveCertEdit = async (cert) => {
    const updated = { ...cert, ...editCertForm };
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
    { id: 1, category: 'Coach / Mentor Pay', description: 'Siya - August coaching hours', amount: 4500, date: '2026-08-01' },
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
  }, [isMockSession]);

  const EXPENSE_CATEGORIES = ['Tools & Software', 'Coach / Mentor Pay', 'Marketing', 'Hosting / Infrastructure', 'Events', 'Other'];
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

  // PayFast Transactions - the one-time exported-CSV snapshot (up to
  // 2026-08-05) merged with everything the payfast-webhook Edge Function has
  // recorded live since. Real Supabase data for a real session; Mock Admin
  // has no session, so it only ever sees the static historical snapshot.
  const [payments, setPayments] = useState(payfastTransactionsData);
  const [loadingLivePayments, setLoadingLivePayments] = useState(!isMockSession);
  const [livePaymentsError, setLivePaymentsError] = useState(null);

  useEffect(() => {
    if (isMockSession) return;
    let cancelled = false;
    fetchPayfastPayments()
      .then((live) => !cancelled && setPayments([...live, ...payfastTransactionsData]))
      .catch((err) => !cancelled && setLivePaymentsError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingLivePayments(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  // Loaded once for real admin sessions - Mock Admin has no Supabase session, so
  // these calls would just be rejected by RLS, and edits stay local-only for it.
  const [loadingSavedMemberData, setLoadingSavedMemberData] = useState(!isMockSession);
  const [savedMemberDataError, setSavedMemberDataError] = useState(null);

  useEffect(() => {
    if (isMockSession) return; // loadingSavedMemberData already starts false in this case
    let cancelled = false;
    Promise.all([fetchMemberProfiles(), fetchManualMembers(), fetchEftPayments()])
      .then(([profiles, manual, eft]) => {
        if (cancelled) return;
        setMemberProfiles(profiles);
        setManualMembers(manual);
        if (eft.length) setPayments((prev) => [...eft, ...prev]);
      })
      .catch((err) => !cancelled && setSavedMemberDataError(friendlyErrorMessage(err)))
      .finally(() => !cancelled && setLoadingSavedMemberData(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

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
  }, [isMockSession]);

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
  }, [isMockSession]);

  const pendingCommunityEvents = communityEvents.filter((e) => e.status === 'Pending');

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

  const [showEftModal, setShowEftModal] = useState(false);

  // EFT payments land straight in the same `payments` list as PayFast transactions,
  // tagged with fundingType 'EFT' - so revenue totals, the audit table, and each
  // member's spend all pick them up automatically, no separate accounting needed.
  const handleRecordEftPayment = (form) => {
    const amount = Number(form.amount) || 0;
    const newPayment = {
      id: payments.length + 1,
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
    setPayments([newPayment, ...payments]);
    if (!isMockSession) {
      insertEftPayment(newPayment).catch((err) => setSavedMemberDataError(friendlyErrorMessage(err)));
    }
  };

  // Anchored to the PayFast export's "as-of" date, so trend/renewal math stays
  // consistent with the transaction data rather than drifting with wall-clock time.
  const today = new Date('2026-08-07');

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
  const last30DaysStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthlyRecurringRevenue = payments
    .filter(p => (p.plan === 'Monthly Operative' || p.plan === 'Basic Access') && new Date(p.date) >= last30DaysStart)
    .reduce((acc, p) => acc + p.amount, 0);

  // Active members = distinct payers within one trailing 35-day billing window
  const last35DaysStart = new Date(today.getTime() - 35 * 24 * 60 * 60 * 1000);
  const prev35DaysStart = new Date(today.getTime() - 70 * 24 * 60 * 60 * 1000);
  const activeMemberEmails = emailsPaidBetween(last35DaysStart, today);
  const previousActiveMemberEmails = emailsPaidBetween(prev35DaysStart, last35DaysStart);
  const activeMemberGrowthPct = previousActiveMemberEmails.size
    ? ((activeMemberEmails.size - previousActiveMemberEmails.size) / previousActiveMemberEmails.size) * 100
    : 0;

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

  // Refunded transactions (Funds Received Reversals)
  const refundCount = payments.filter(p => p.type === 'Funds Received (Reversal)').length;

  // Monthly gross revenue trend, computed directly from the transaction history
  const mrrTrendMonths = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  const mrrTrend = mrrTrendMonths.map(month => ({
    label: new Date(`${month}-01`).toLocaleDateString('en-ZA', { month: 'short' }),
    value: payments
      .filter(p => p.type === 'Funds Received' && p.date.startsWith(month))
      .reduce((acc, p) => acc + p.amount, 0),
  }));
  const mrrTrendMax = Math.max(...mrrTrend.map(m => m.value), 1);

  const filteredPayments = payments.filter(p =>
    p.member.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.pfId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.plan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Member roster: one row per distinct payer, aggregated from the real transaction
  // history (name, email, tenure, plan, and total spend). Demographic/profile fields
  // (age, location, specialty, etc.) come from `memberProfiles` if the admin has filled
  // them in, since they have no source in the PayFast data.
  const memberRosterMap = new Map();
  payments
    .filter(p => p.type === 'Funds Received' || p.type === 'Funds Received (Reversal)')
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
    if (!memberRosterMap.has(key)) memberRosterMap.set(key, m);
  });

  const memberRoster = [...memberRosterMap.values()]
    .map(m => {
      const profile = memberProfiles[m.email.toLowerCase()] || null;
      const daysSinceLastPayment = Math.floor((today - new Date(m.lastPaymentDate)) / (1000 * 60 * 60 * 24));
      const status = profile?.status === 'Left'
        ? 'Left'
        : profile?.status === 'Leaving'
        ? 'Leaving'
        : profile?.status === 'Active (Permanent)'
        ? 'Active'
        : daysSinceLastPayment > LAPSED_AFTER_DAYS ? 'Lapsed' : 'Active';
      return {
        ...m,
        monthsInHH: Math.max(0, Math.round((today - new Date(m.firstPaymentDate)) / (1000 * 60 * 60 * 24 * 30))),
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

  const [meetups, setMeetups] = useState([
    { id: 1, title: 'Cyber War Games: Capture The Flag', date: '2026-08-16', time: '18:00', location: 'Discord', rsvps: 34, status: 'upcoming' },
    { id: 2, title: 'OSINT Fundamentals Workshop', date: '2026-08-23', time: '17:30', location: 'Online (Zoom)', rsvps: 21, status: 'upcoming' },
    { id: 3, title: 'July Community Meetup', date: '2026-07-19', time: '18:00', location: 'Discord', rsvps: 58, status: 'completed' },
  ]);

  const [newMeetup, setNewMeetup] = useState({ title: '', date: '', time: '', location: '' });

  const handleAddMeetup = (e) => {
    e.preventDefault();
    if (!newMeetup.title || !newMeetup.date) return;
    setMeetups([
      ...meetups,
      {
        id: meetups.length + 1,
        title: newMeetup.title,
        date: newMeetup.date,
        time: newMeetup.time || '18:00',
        location: newMeetup.location || 'Online',
        rsvps: 0,
        status: 'upcoming',
      },
    ]);
    setNewMeetup({ title: '', date: '', time: '', location: '' });
  };

  // RENDER SECTIONS BASED ON ACTIVE TAB
  switch (activeTab) {
    case 'dashboard':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Admin Overview</h1>
            <p>Real-time analytics and growth stats for Hacking Hub.</p>
          </div>

          {/* Key Metrics Grid */}
          <div className="dashboard-grid">
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Active Members</span>
                <Users size={20} color="var(--accent-cyan)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>{activeMemberEmails.size}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: activeMemberGrowthPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {activeMemberGrowthPct >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                <span>{activeMemberGrowthPct >= 0 ? '+' : ''}{activeMemberGrowthPct.toFixed(1)}% vs prior 35 days</span>
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
            {/* Quick Chart */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '24px' }}>Gross Revenue Trend (ZAR)</h3>
              <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', padding: '10px 0' }}>
                {mrrTrend.map((m, idx) => (
                  <div key={idx} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100%', height: `${(m.value / mrrTrendMax) * 160}px`, background: 'linear-gradient(to top, var(--accent-purple), var(--accent-cyan))', borderRadius: '4px' }}></div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Tasks/Pending */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3>Administrative Alerts</h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Refunded Transactions</div>
                  <p style={{ fontSize: '0.8rem' }}>{refundCount} refund{refundCount === 1 ? '' : 's'} recorded since Jan 2026.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <CheckCircle size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Certs cohort synced</div>
                  <p style={{ fontSize: '0.8rem' }}>OSCP cohort data updated successfully.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'members':
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login. Sign in with Google to save for real.
            </div>
          )}
          {!isMockSession && savedMemberDataError && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
              Couldn't save/load member data from Supabase: {savedMemberDataError}
            </div>
          )}
          {!isMockSession && loadingSavedMemberData && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Loading saved member data...</div>
          )}

          {meetingSyncError && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
              Couldn't sync from Google Calendar: {meetingSyncError}
            </div>
          )}
          {Object.keys(lastMeetingByEmail).length > 0 && !meetingSyncError && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '20px', marginTop: '-16px' }}>
              Last 1on1 dates matched by attendee email against your Google Calendar since Jan 2026 — a member booked under a different email won't be caught.
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px 16px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', maxWidth: '360px', flexGrow: 1 }}>
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filteredMemberRoster.map((m) => {
              const initials = m.member
                .split(' ')
                .map((part) => part[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={m.email}
                  onClick={() => setSelectedMemberEmail(m.email)}
                  className="hover-glow"
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'rgba(255,255,255,0.02)',
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
                        color: '#12132b',
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
            })}
          </div>

          {/* Refer a Friend submissions - who members have referred to the
              community, and who referred them. */}
          <div className="glass-card" style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <UserPlus size={20} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0 }}>Referrals</h3>
            </div>

            {isMockSession && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                You're using Mock Admin — referrals only load for a real signed-in session.
              </div>
            )}
            {!isMockSession && referralsError && (
              <div style={{ padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
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
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const referrer = memberRoster.find((m) => m.email.toLowerCase() === r.referrerEmail.toLowerCase());
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
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

    case 'roadmaps': {
      const roadmapSelected = roadmapMemberEmail
        ? memberRoster.find((m) => m.email.toLowerCase() === roadmapMemberEmail.toLowerCase())
        : null;
      const filteredRoadmapRoster = memberRoster.filter((m) =>
        m.member.toLowerCase().includes(roadmapMemberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(roadmapMemberSearch.toLowerCase())
      );
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'flex-start' }}>
            {/* Member picker */}
            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                <Search size={16} color="var(--text-muted)" style={{ marginTop: '2px' }} />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={roadmapMemberSearch}
                  onChange={(e) => setRoadmapMemberSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none', width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '520px', overflowY: 'auto' }}>
                {filteredRoadmapRoster.map((m) => (
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
                      background: roadmapMemberEmail?.toLowerCase() === m.email.toLowerCase() ? 'rgba(94, 227, 122, 0.06)' : 'rgba(255,255,255,0.01)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.member}</span>
                    <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>
                      {m.profile?.roadmapTrack && m.profile.roadmapTrack !== 'Not Assigned' ? m.profile.roadmapTrack : 'No track assigned'}
                    </span>
                  </button>
                ))}
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
                    <div style={{ padding: '10px 14px', marginBottom: '16px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.82rem' }}>
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
                                    <div key={item.id} style={{ padding: '10px 12px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                                      {editingRoadmapItemId === item.id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <select className="form-input" value={editRoadmapItemForm.phase} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, phase: e.target.value })}>
                                              {ROADMAP_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                            <input className="form-input" value={editRoadmapItemForm.category} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, category: e.target.value })} placeholder="Category" />
                                          </div>
                                          <input className="form-input" value={editRoadmapItemForm.title} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, title: e.target.value })} placeholder="Item title" />
                                          <input className="form-input" value={editRoadmapItemForm.detail} onChange={(e) => setEditRoadmapItemForm({ ...editRoadmapItemForm, detail: e.target.value })} placeholder="Detail (optional) - e.g. 9/20 collections, by 28 Aug" />
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
                                            {item.detail && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.detail}</div>}
                                          </div>
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
                    <form onSubmit={handleAddRoadmapItem} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
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
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>Detail (optional)</label>
                        <input className="form-input" value={newRoadmapItem.detail} onChange={(e) => setNewRoadmapItem({ ...newRoadmapItem, detail: e.target.value })} placeholder="e.g. 9/20 collections, by 28th of August" />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login.
            </div>
          )}
          {matchmakerError && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
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
                <div key={group.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
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

      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}><ListChecks size={28} color="var(--accent-cyan)" /> Room Logs</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Members' self-reported daily TryHackMe room counts. Approving credits the Competitions leaderboard.</p>
          </div>

          {isMockSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — changes here are local only and will be lost on your next login.
            </div>
          )}
          {roomLogsError && (
            <div style={{ padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
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
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
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
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Meetups & Events</h1>
            <p>Organize, schedule, and view Hacking Hub meetups.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            {/* Create Meetup Form */}
            <div className="glass-card" style={{ height: 'fit-content' }}>
              <h3 style={{ marginBottom: '20px' }}>Create Event</h3>
              <form onSubmit={handleAddMeetup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Event Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Cyber War games"
                    value={newMeetup.title}
                    onChange={(e) => setNewMeetup({ ...newMeetup, title: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newMeetup.date}
                    onChange={(e) => setNewMeetup({ ...newMeetup, date: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={newMeetup.time}
                      onChange={(e) => setNewMeetup({ ...newMeetup, time: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Location</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Discord"
                      value={newMeetup.location}
                      onChange={(e) => setNewMeetup({ ...newMeetup, location: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '8px' }}>
                  <Plus size={16} /> Schedule Meetup
                </button>
              </form>
            </div>

            {/* Meetup List */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3>Event List</h3>
                <span className="badge badge-success">{meetups.length} Total</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {meetups.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>{m.title}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {formatDate(m.date)} at {m.time} | <strong>{m.location}</strong>
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>{m.rsvps}</strong> RSVPs
                      </span>
                      <span className={`badge ${m.status === 'upcoming' ? 'badge-success' : 'badge-danger'}`}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                      background: 'rgba(255,255,255,0.02)',
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
                backgroundColor: 'rgba(3, 7, 18, 0.85)',
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
                  <div style={{ padding: '14px 16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
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

    case '1on1s':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>1on1 Session Facilitator</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Live Google Calendar sync and student coaching roadmap progress.</p>
          </div>

          {/* Mentor Appointment Booking Links */}
          <div className="glass-card" style={{ marginBottom: '32px', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={20} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0 }}>Mentor Appointment Links</h3>
              </div>
              <span className="badge badge-success">Live Google Appointment Slots</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
              <div>
                <strong>Siyambonga Gladile (Lead Mentor & Founder)</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Direct Booking Page: https://calendar.app.google/eKVRpXkHCKKcnhYT6</div>
              </div>
              <a
                href="https://calendar.app.google/eKVRpXkHCKKcnhYT6"
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                Open Google Calendar <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Live Google Calendar Feed */}
          <div className="glass-card" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={22} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0 }}>Live Google Calendar 1on1s</h3>
              </div>
              {providerToken && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => {
                    setLoadingEvents(true);
                    fetchCalendarEvents(providerToken)
                      .then(setGoogleEvents)
                      .catch(err => setEventsError(friendlyErrorMessage(err)))
                      .finally(() => setLoadingEvents(false));
                  }}
                >
                  <RefreshCw size={14} className={loadingEvents ? 'animate-spin' : ''} />
                  Refresh
                </button>
              )}
            </div>

            {!providerToken ? (
              <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--border-radius-md)', border: '1px dashed var(--border-color)' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Log in using <strong>Sign in with Google</strong> to grant Google Calendar permission and auto-sync your 1on1s live from <code>siya@hackinghub.co.za</code>.
                </p>
              </div>
            ) : loadingEvents ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Fetching your Google Calendar 1on1 sessions...
              </div>
            ) : eventsError ? (
              <div style={{ padding: '16px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                Failed to load Google Calendar: {eventsError}
              </div>
            ) : googleEvents.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No upcoming Google Calendar events found for <code>siya@hackinghub.co.za</code>.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {googleEvents.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--border-radius-md)',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '4px' }}>
                        {evt.startFormatted}
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>{evt.title}</h4>
                      {evt.attendees.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <strong>Attendees:</strong> {evt.attendees.map(a => a.name || a.email).join(', ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      {evt.meetLink && (
                        <a
                          href={evt.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        >
                          <Video size={14} /> Join Call
                        </a>
                      )}
                      <a
                        href={evt.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                      >
                        <ExternalLink size={14} /> Google Calendar
                      </a>
                    </div>
                  </div>
                ))}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {certs.map((c) => {
                  const targetDate = new Date(c.date);
                  const today = new Date();
                  const diffTime = targetDate - today;
                  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const isUrgent = daysLeft <= 14;

                  if (editingCertId === c.id) {
                    return (
                      <div key={c.id} style={{ padding: '20px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--accent-cyan)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input className="form-input" value={editCertForm.member} onChange={(e) => setEditCertForm({ ...editCertForm, member: e.target.value })} placeholder="Member name" />
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {c.result === 'Passed' ? (
                              <span className="badge badge-success">Passed</span>
                            ) : c.result === 'Failed' ? (
                              <span className="badge badge-danger">Failed</span>
                            ) : (
                              <span className={`badge ${daysLeft <= 7 ? 'badge-danger' : isUrgent ? 'badge-warning' : 'badge-success'}`}>
                                {daysLeft > 0 ? `${daysLeft} Days Left` : daysLeft === 0 ? 'Exam Today!' : 'Awaiting Result'}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '24px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — any EFT payment you record here is local only and will be lost on your next login. Sign in with Google to save for real.
            </div>
          )}
          {!isMockSession && savedMemberDataError && (
            <div style={{ padding: '12px 16px', marginBottom: '24px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
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

              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '8px 14px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', minWidth: '280px' }}>
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
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showEftModal && (
            <RecordEftPaymentModal
              activeMembers={memberRoster.filter(m => m.status === 'Active')}
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

      const past7DaysCutoff = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weeklyRevenue = payments
        .filter(p => new Date(p.date) >= past7DaysCutoff)
        .reduce((acc, p) => acc + p.amount, 0);

      // Last 5 PayFast Transactions
      const last5Transactions = payments.slice(0, 5);

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
          const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
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
            {/* Last 5 PayFast Transactions */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={20} color="var(--success)" />
                  <h3 style={{ margin: 0 }}>Last 5 PayFast Transactions</h3>
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
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
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
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
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
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                You're using Mock Admin — expenses only persist for a real signed-in session.
              </div>
            )}
            {!isMockSession && expensesError && (
              <div style={{ padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
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
                      <tr key={x.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
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
                      <tr key={x.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '24px', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              You're using Mock Admin — real member reviews only load for a real signed-in session.
            </div>
          )}
          {!isMockSession && reviewsError && (
            <div style={{ padding: '12px 16px', marginBottom: '24px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
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
