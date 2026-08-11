import React, { useState, useEffect } from 'react';
import { fetchCalendarEvents, fetchCertCalendarEvents, fetchPastCalendarEvents } from '../../lib/googleCalendar';
import CertDetailsModal from '../../components/CertDetailsModal';
import MemberProfileModal from '../../components/MemberProfileModal';
import AddMemberModal from '../../components/AddMemberModal';
import RecordEftPaymentModal from '../../components/RecordEftPaymentModal';
import payfastTransactionsData from '../../data/payfastTransactions.json';
import { LAPSED_AFTER_DAYS, MEETING_OVERDUE_AFTER_DAYS } from '../../lib/memberOptions';
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
} from 'lucide-react';

export default function AdminDashboard({ activeTab, providerToken, isMockSession }) {
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  // Certifications state
  const [selectedCert, setSelectedCert] = useState(null);
  const [certEvents, setCertEvents] = useState([]);
  const [loadingCertEvents, setLoadingCertEvents] = useState(false);
  const [certEventsError, setCertEventsError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  // Member profile fields with no source in the PayFast export (age, location, gender,
  // specialty, LinkedIn, phone, money owed, job readiness) are admin-entered and kept
  // here rather than invented for real, named members. Keyed by lowercased email.
  const [memberProfiles, setMemberProfiles] = useState({});
  const [selectedMemberEmail, setSelectedMemberEmail] = useState(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('all');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

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
      .catch((err) => setMeetingSyncError(err.message))
      .finally(() => setLoadingMeetingSync(false));
  };

  const handleSaveMemberProfile = (email, profileData) => {
    setMemberProfiles((prev) => ({ ...prev, [email.toLowerCase()]: profileData }));
    if (!isMockSession) {
      upsertMemberProfile(email, profileData).catch((err) => setSavedMemberDataError(err.message));
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
      insertManualMember({ member, email, startDate, lastPlan, totalSpent }).catch((err) => setSavedMemberDataError(err.message));
    }
  };

  const [certs, setCerts] = useState([
    { id: 1, member: 'Sanele Khumalo', name: 'OSCP Penetration Tester', date: '2026-09-12', cohort: 'OSCP-26B', result: 'Pending' },
    { id: 2, member: '[REDACTED]', name: 'CompTIA Security+', date: '2026-08-28', cohort: 'SecPlus-Aug', result: 'Pending' },
    { id: 3, member: 'Khody Netshifhefhe', name: 'eLearnSecurity eCPPT', date: '2026-10-05', cohort: 'eCPPT-Intro', result: 'Pending' },
    { id: 4, member: 'Joshua Harrop', name: 'Microsoft Azure Security (AZ-500)', date: '2026-09-01', cohort: 'Azure-Q3', result: 'Pending' },
    { id: 5, member: 'Thabo Ndlovu', name: 'OSCP Penetration Tester', date: '2026-08-02', cohort: 'OSCP-26A', result: 'Passed' },
    { id: 6, member: 'Palesa Dlamini', name: 'CompTIA Security+', date: '2026-07-15', cohort: 'SecPlus-Jul', result: 'Passed' },
  ]);

  const [newCert, setNewCert] = useState({ member: '', name: '', date: '', cohort: '' });

  const handleAddCert = (e) => {
    e.preventDefault();
    if (!newCert.member || !newCert.name || !newCert.date) return;
    setCerts([
      ...certs,
      {
        id: certs.length + 1,
        member: newCert.member,
        name: newCert.name,
        date: newCert.date,
        cohort: newCert.cohort || 'General',
        result: 'Pending',
      },
    ]);
    setNewCert({ member: '', name: '', date: '', cohort: '' });
  };

  const handleUpdateCertResult = (id, result) => {
    setCerts(certs.map(c => c.id === id ? { ...c, result } : c));
  };

  // PayFast Transactions initialized from exported CSV
  const [payments, setPayments] = useState(payfastTransactionsData);

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
      .catch((err) => !cancelled && setSavedMemberDataError(err.message))
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
      .catch((err) => !cancelled && setReviewsError(err.message))
      .finally(() => !cancelled && setLoadingReviews(false));
    return () => { cancelled = true; };
  }, [isMockSession]);

  const [oneOnOnes, setOneOnOnes] = useState([
    {
      id: 1,
      member: 'Sanele Khumalo',
      mentor: '[REDACTED]',
      nextMeetingDate: '2026-08-10 14:00',
      daysUntil: 3,
      previousMeetingDate: '2026-07-27',
      isRecurring: true,
      frequency: 'Weekly (Mon)',
      topic: 'OSCP Prep Roadmap & Buffer Overflows',
      status: 'scheduled',
    },
    {
      id: 2,
      member: 'Liam O\'Connor',
      mentor: '[REDACTED]',
      nextMeetingDate: '2026-08-08 10:00',
      daysUntil: 1,
      previousMeetingDate: '2026-07-25',
      isRecurring: true,
      frequency: 'Bi-weekly (Sat)',
      topic: 'Web Security & PortSwigger Labs Review',
      status: 'scheduled',
    },
    {
      id: 3,
      member: 'Fatima Patel',
      mentor: 'Jaco du Toit',
      nextMeetingDate: '2026-08-14 16:30',
      daysUntil: 7,
      previousMeetingDate: '2026-07-31',
      isRecurring: false,
      frequency: 'One-off Session',
      topic: 'Malware Analysis & Ghidra Basics',
      status: 'scheduled',
    },
    {
      id: 4,
      member: 'Zoe van der Merwe',
      mentor: '[REDACTED]',
      nextMeetingDate: '2026-08-12 11:00',
      daysUntil: 5,
      previousMeetingDate: '2026-07-15',
      isRecurring: true,
      frequency: 'Monthly Sync',
      topic: 'Career Transition & Salary Negotiation',
      status: 'scheduled',
    },
  ]);

  const handleSimulatePayfastPayment = () => {
    const plans = [
      { name: 'Basic Access', amount: 200, fee: 9.66, net: 190.34 },
      { name: 'Monthly Operative', amount: 600, fee: 24.38, net: 575.62 },
      { name: 'Permanent Access', amount: 1000, fee: 39.10, net: 960.90 },
    ];
    const randomPlan = plans[Math.floor(Math.random() * plans.length)];
    const names = ['Thabo Mokoena', 'Anika Reddy', 'Bongani Sithole', 'Chantel Marais', 'David Botha'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomEmail = `${randomName.toLowerCase().replace(' ', '.')}@gmail.com`;

    const newPayment = {
      id: payments.length + 1,
      pfId: `PF-${Math.floor(318000000 + Math.random() * 2000000)}`,
      member: randomName,
      email: randomEmail,
      plan: randomPlan.name,
      amount: randomPlan.amount,
      fee: randomPlan.fee,
      net: randomPlan.net,
      fundingType: 'Credit Card',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'COMPLETE',
    };

    setPayments([newPayment, ...payments]);
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
      insertEftPayment(newPayment).catch((err) => setSavedMemberDataError(err.message));
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
                <strong>[REDACTED] (Lead Mentor & Founder)</strong>
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
                      .catch(err => setEventsError(err.message))
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

          {/* Active Bookings Table */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '20px' }}>Dashboard Bookings List</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Member</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Assigned Mentor</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Next Meeting & Countdown</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Previous Meeting Date</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Recurring Setup</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Focus Topic</th>
                </tr>
              </thead>
              <tbody>
                {oneOnOnes.map((session) => (
                  <tr key={session.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 600 }}>{session.member}</td>
                    <td style={{ padding: '16px 12px' }}>{session.mentor}</td>
                    <td style={{ padding: '16px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                        {formatDate(session.nextMeetingDate.split(' ')[0])} · {session.nextMeetingDate.split(' ')[1]}
                      </div>
                      <span className={`badge ${session.daysUntil <= 1 ? 'badge-danger' : session.daysUntil <= 3 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                        {session.daysUntil === 0 ? 'Today!' : session.daysUntil === 1 ? 'Tomorrow' : `In ${session.daysUntil} days`}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {session.previousMeetingDate ? formatDate(session.previousMeetingDate) : 'None (First Session)'}
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      {session.isRecurring ? (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          Yes ({session.frequency})
                        </span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                          No (One-off)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 12px', fontSize: '0.85rem' }}>{session.topic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    value={newCert.name}
                    onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {certs.map((c) => {
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
                          {c.result === 'Passed' ? (
                            <span className="badge badge-success">Passed</span>
                          ) : c.result === 'Failed' ? (
                            <span className="badge badge-danger">Failed</span>
                          ) : (
                            <span className={`badge ${daysLeft <= 7 ? 'badge-danger' : isUrgent ? 'badge-warning' : 'badge-success'}`}>
                              {daysLeft > 0 ? `${daysLeft} Days Left` : daysLeft === 0 ? 'Exam Today!' : 'Awaiting Result'}
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{c.member}</h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.name} <Info size={14} color="var(--accent-cyan)" />
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
              certName={selectedCert.name}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <CreditCard size={22} color="var(--success)" />
                  <h3 style={{ margin: 0 }}>PayFast Gateway Status</h3>
                  <span className="badge badge-success">MERCHANT ID: 18467178 (ACTIVE)</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Data Source: <strong style={{ color: '#fff' }}>payfast_transactions_2026.csv</strong> (Processed Jan 1 - Aug 7, 2026) + manually recorded EFT payments
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setShowEftModal(true)}>
                  <Landmark size={16} /> Record EFT Payment
                </button>
                <button className="btn btn-primary" onClick={handleSimulatePayfastPayment}>
                  <Plus size={16} /> Simulate PayFast ITN Transaction
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
