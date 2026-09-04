import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, Link, Calendar, CalendarClock, CreditCard, Wallet, Briefcase, Shield, UserCheck, Building2, Banknote, Flag, LogOut, Star, Milestone, Trash2, CheckCircle2, IdCard } from 'lucide-react';
import { SPECIALTIES, JOB_READINESS_STAGES, GENDERS, LOCATIONS, AGES, MEMBERSHIP_STATUSES, EMPLOYMENT_STATUSES, OFFBOARDING_REASONS, LAPSED_AFTER_DAYS, MEETING_OVERDUE_AFTER_DAYS, ROADMAP_TRACKS } from '../lib/memberOptions';
import { formatDate } from '../lib/dateFormat';
import { fetchMemberInterviews } from '../lib/memberInterviewsData';
import { fetchMemberLinkedInPostStatus } from '../lib/linkedInPostData';

export default function MemberProfileModal({ member, profile, onSave, onDelete, onClose, today, isMockSession }) {
  const [form, setForm] = useState({
    // Defaults to the real first-payment date (still shown separately,
    // read-only, as "First Payment" below) - editable here since it's wrong
    // for anyone who joined before ever paying, or whose coaching
    // relationship started on a genuinely different date.
    startDate: profile?.manualStartDate || (member?.firstPaymentDate ? member.firstPaymentDate.split(' ')[0] : ''),
    age: profile?.age || '',
    gender: profile?.gender || '',
    location: profile?.location || '',
    specialty: profile?.specialty || 'Not Set',
    linkedin: profile?.linkedin || '',
    phone: profile?.phone || '',
    moneyOwed: profile?.moneyOwed ?? 0,
    jobReadiness: profile?.jobReadiness || 'Not Started',
    // Not derived from anything - there's no real interview activity
    // tracked elsewhere in the app (Interview Prep only logs AI practice
    // sessions), so this is a simple manual count, same trust level as
    // Job Readiness. Feeds the member-side "My Journey So Far" storyline.
    interviewsHad: profile?.interviewsHad ?? 0,
    roadmapTrack: profile?.roadmapTrack || 'Not Assigned',
    status: profile?.status || 'Active',
    employmentStatus: profile?.employmentStatus || 'Not Set',
    jobTitle: profile?.jobTitle || '',
    monthlyRemuneration: profile?.monthlyRemuneration ?? '',
    jobPlacedDate: profile?.jobPlacedDate || '',
    offboardingReason: profile?.offboardingReason || '',
    offboardingNotes: profile?.offboardingNotes || '',
    offboardingStartedAt: profile?.offboardingStartedAt || '',
  });

  // Real interviews this member has logged via Interview Prep
  // (supabase/058_member_interviews.sql) - read-only here, self-fetched the
  // same way InterviewPrepModal.jsx fetches its own history. Skipped under
  // Mock Admin (no real Supabase session to query).
  const [realInterviews, setRealInterviews] = useState([]);
  useEffect(() => {
    if (isMockSession || !member?.email) return;
    fetchMemberInterviews(member.email).then(setRealInterviews).catch(() => {});
  }, [isMockSession, member?.email]);

  // Whether this member has confirmed posting on LinkedIn this week
  // (supabase/059_linkedin_weekly_post.sql) - same self-fetching,
  // mock-guarded pattern as realInterviews above.
  const [linkedInStatus, setLinkedInStatus] = useState(null);
  useEffect(() => {
    if (isMockSession || !member?.email) return;
    fetchMemberLinkedInPostStatus(member.email).then(setLinkedInStatus).catch(() => {});
  }, [isMockSession, member?.email]);

  if (!member) return null;

  // member.lastPaymentDate is null for a real, allowlisted member who's never
  // actually made a PayFast payment (or been added manually) - "lapsed"
  // doesn't apply when there's no payment history to have lapsed from.
  const daysSinceLastPayment = member.lastPaymentDate
    ? Math.floor((today - new Date(member.lastPaymentDate)) / (1000 * 60 * 60 * 24))
    : null;
  const isLapsed = form.status === 'Active' && daysSinceLastPayment !== null && daysSinceLastPayment > LAPSED_AFTER_DAYS;

  // Total Interviews Had = the manual baseline below + real interviews
  // logged in the portal whose date has already passed (supabase/058_
  // member_interviews.sql redefines get_my_interviews_had() to sum these
  // same two things) - one merged number, computed the same way here and
  // on the member's own Journey tile, so they can never drift apart.
  const todayStr = today.toISOString().split('T')[0];
  const pastRealInterviewsCount = realInterviews.filter((i) => i.interviewDate <= todayStr).length;
  const totalInterviewsHad = (Number(form.interviewsHad) || 0) + pastRealInterviewsCount;

  const daysSinceLastMeeting = member.lastMeetingDate
    ? Math.floor((today - new Date(member.lastMeetingDate)) / (1000 * 60 * 60 * 24))
    : null;
  const isMeetingOverdue = daysSinceLastMeeting !== null && daysSinceLastMeeting > MEETING_OVERDUE_AFTER_DAYS;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const updateStatus = (e) => {
    const value = e.target.value;
    setForm({
      ...form,
      status: value,
      // Stamp the start of the grace period once, the first time - editing other
      // fields while still 'Leaving' shouldn't keep resetting it.
      offboardingStartedAt: value === 'Leaving' && !form.offboardingStartedAt
        ? today.toISOString().split('T')[0]
        : form.offboardingStartedAt,
    });
  };

  const updateJobReadiness = (e) => {
    const value = e.target.value;
    const isNowPlaced = value === 'Job Placed';
    setForm({
      ...form,
      jobReadiness: value,
      // Default to today so a fresh placement doesn't sit with a blank date -
      // still fully editable below.
      jobPlacedDate: isNowPlaced && !form.jobPlacedDate
        ? today.toISOString().split('T')[0]
        : form.jobPlacedDate,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(member.email, {
      ...form,
      manualStartDate: form.startDate,
      moneyOwed: Number(form.moneyOwed) || 0,
      interviewsHad: Number(form.interviewsHad) || 0,
      monthlyRemuneration: form.employmentStatus === 'Employed' ? (Number(form.monthlyRemuneration) || 0) : 0,
      jobTitle: form.employmentStatus === 'Employed' ? form.jobTitle : '',
      jobPlacedDate: form.jobReadiness === 'Job Placed' ? form.jobPlacedDate : '',
      offboardingReason: (form.status === 'Leaving' || form.status === 'Left') ? form.offboardingReason : '',
      offboardingNotes: (form.status === 'Leaving' || form.status === 'Left') ? form.offboardingNotes : '',
      offboardingStartedAt: (form.status === 'Leaving' || form.status === 'Left') ? form.offboardingStartedAt : '',
      // Not part of this form - only ever written by the member's own exit feedback
      // submission. Carried forward from the existing profile so a routine admin
      // edit doesn't make it vanish from the UI until the next refetch.
      exitFeedbackRating: profile?.exitFeedbackRating ?? null,
      exitFeedbackText: profile?.exitFeedbackText || '',
      leftAt: profile?.leftAt || '',
    });
    onClose();
  };

  return (
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
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-success">{member.lastPlan}</span>
            <span className="badge badge-warning">{form.jobReadiness}</span>
            <span className={`badge ${form.status === 'Left' ? 'badge-danger' : form.status === 'Leaving' ? 'badge-warning' : isLapsed ? 'badge-warning' : 'badge-success'}`}>
              {form.status === 'Left' ? 'Left'
                : form.status === 'Leaving' ? 'Leaving · pending exit'
                : form.status === 'Active (Permanent)' ? 'Active · Permanent'
                : isLapsed ? `Lapsed · ${daysSinceLastPayment}d since last payment`
                : 'Active'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{member.member}</h2>
          <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={14} /> {member.email}
          </p>
        </div>

        {/* Derived-from-payments facts (read-only) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
            background: 'rgba(var(--overlay-rgb), 0.02)',
            padding: '16px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} /> First Payment
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {member.firstPaymentDate ? formatDate(member.firstPaymentDate.split(' ')[0]) : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>No payment on record</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={12} /> Months in HH
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.monthsInHH}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CreditCard size={12} /> Total Spent on HH
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--success)' }}>R {member.totalSpent.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wallet size={12} /> Payments Made
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.paymentCount}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CalendarClock size={12} /> Last 1on1 Meeting
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', color: isMeetingOverdue ? 'var(--danger)' : 'inherit' }}>
              {member.lastMeetingDate ? (
                <>
                  {isMeetingOverdue && <Flag size={14} color="var(--danger)" />}
                  {new Date(member.lastMeetingDate).toLocaleDateString('en-ZA', { weekday: 'short' })}, {formatDate(member.lastMeetingDate)}
                  {isMeetingOverdue && <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>· {daysSinceLastMeeting} days ago</span>}
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Not synced from Google Calendar yet</span>
              )}
            </div>
          </div>
        </div>

        {!isMockSession && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={14} /> Total Interviews Had: {totalInterviewsHad}
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              {form.interviewsHad || 0} manual baseline + {pastRealInterviewsCount} logged for real in the portal.
            </p>
            {realInterviews.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {realInterviews.map((i) => (
                  <div key={i.id} style={{ padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>
                        {i.company}
                        {i.interviewDomain && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {i.interviewDomain}</span>}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{formatDate(i.interviewDate)}</span>
                    </div>
                    {i.reviewedAt ? (
                      <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', marginBottom: '6px' }}>
                          <CheckCircle2 size={13} /> {i.interviewMode} · Playbook helped: {i.playbookHelped} · Confidence {i.confidenceLevel}/5
                        </p>
                        <p><strong>Questions asked:</strong> {i.questionsAsked}</p>
                      </div>
                    ) : (
                      <p style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>No review submitted yet.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No real interviews logged in the portal yet.</p>
            )}
          </div>
        )}

        {!isMockSession && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IdCard size={14} /> LinkedIn Post This Week
            </h4>
            {linkedInStatus === null ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading...</p>
            ) : (
              <span className={`badge ${linkedInStatus.confirmedThisWeek ? 'badge-success' : 'badge-warning'}`}>
                {linkedInStatus.confirmedThisWeek ? 'Confirmed this week' : 'Not confirmed yet this week'}
              </span>
            )}
            {linkedInStatus?.lastConfirmedAt && !linkedInStatus.confirmedThisWeek && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Last confirmed {formatDate(linkedInStatus.lastConfirmedAt.split('T')[0])}.
              </p>
            )}
          </div>
        )}

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          The fields below aren't in the PayFast export — fill them in and they'll be remembered for this member.
        </p>

        {/* Editable profile fields */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <Calendar size={13} /> Start Date
            </label>
            <input type="date" className="form-input" value={form.startDate} onChange={update('startDate')} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Defaults to their first payment date - override this if they joined before ever paying, or if their real start date is different. Drives tenure and time-to-outcome stats on the Insights tab.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Age</label>
              <select className="form-input" value={form.age} onChange={update('age')}>
                <option value="">Not set</option>
                {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Gender</label>
              <select className="form-input" value={form.gender} onChange={update('gender')}>
                <option value="">Not set</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <MapPin size={13} /> Location
            </label>
            <select className="form-input" value={form.location} onChange={update('location')}>
              <option value="">Not set</option>
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Specialty</label>
              <select className="form-input" value={form.specialty} onChange={update('specialty')}>
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Briefcase size={13} /> Job Readiness
              </label>
              <select className="form-input" value={form.jobReadiness} onChange={updateJobReadiness}>
                {JOB_READINESS_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <Briefcase size={13} /> Interviews Had (Manual Baseline)
            </label>
            <input type="number" min="0" step="1" className="form-input" style={{ maxWidth: '160px' }} value={form.interviewsHad} onChange={update('interviewsHad')} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Only for interviews that happened before real tracking existed, or ones a member never logged themselves - it's added to whatever they log for real in Interview Prep for one combined total, so there's no need to keep bumping this up per interview going forward.
            </p>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <Milestone size={13} /> Roadmap Track
            </label>
            <select className="form-input" value={form.roadmapTrack} onChange={update('roadmapTrack')}>
              {ROADMAP_TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Determines which checklist shows up under "My Roadmap" for this member. Manage the actual checklist items from the Roadmaps tab.
            </p>
          </div>

          {form.jobReadiness === 'Job Placed' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Calendar size={13} /> Date Placed
              </label>
              <input type="date" className="form-input" value={form.jobPlacedDate} onChange={update('jobPlacedDate')} />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Powers the "job placements this year" count on the dashboard.
              </p>
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <Building2 size={13} /> Employment Status
            </label>
            <select className="form-input" value={form.employmentStatus} onChange={update('employmentStatus')}>
              {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {form.employmentStatus === 'Employed' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', background: 'rgba(var(--overlay-rgb), 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  <Briefcase size={13} /> Job Title
                </label>
                <input type="text" className="form-input" placeholder="e.g. SOC Analyst" value={form.jobTitle} onChange={update('jobTitle')} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  <Banknote size={13} /> Monthly Remuneration (R)
                </label>
                <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={form.monthlyRemuneration} onChange={update('monthlyRemuneration')} />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              <UserCheck size={13} /> Membership Status
            </label>
            <select className="form-input" value={form.status} onChange={updateStatus}>
              {MEMBERSHIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {isLapsed && (
              <p style={{ fontSize: '0.78rem', color: 'var(--warning)', marginTop: '6px' }}>
                No payment in {daysSinceLastPayment} days. If they've paid in full or don't owe recurring dues (e.g. Permanent Access), set this to <strong>"Active (Permanent)"</strong> so it stops flagging. Set to <strong>"Leaving"</strong> to start their exit, or <strong>"Left"</strong> for an immediate cutoff.
              </p>
            )}
            {form.status === 'Leaving' && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                They can still sign in one more time - they'll see a farewell screen with optional exit feedback instead of the normal portal. Submitting (or skipping) it finalizes them to "Left" and cuts off access.
              </p>
            )}
          </div>

          {(form.status === 'Leaving' || form.status === 'Left') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', background: 'rgba(var(--danger-rgb), 0.04)', border: '1px solid rgba(var(--danger-rgb), 0.15)', borderRadius: 'var(--border-radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)' }}>
                <LogOut size={14} /> Offboarding
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Reason</label>
                  <select className="form-input" value={form.offboardingReason} onChange={update('offboardingReason')}>
                    <option value="">Not set</option>
                    {OFFBOARDING_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Started</label>
                  <input type="date" className="form-input" value={form.offboardingStartedAt} onChange={update('offboardingStartedAt')} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Internal Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Context for other admins - not visible to the member."
                  value={form.offboardingNotes}
                  onChange={update('offboardingNotes')}
                />
              </div>
              {Number(form.moneyOwed) > 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--warning)' }}>
                  Still shows R {Number(form.moneyOwed).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} owed - worth reconciling before they're gone.
                </p>
              )}
              {profile?.exitFeedbackText || profile?.exitFeedbackRating ? (
                <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(var(--danger-rgb), 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <Star size={13} /> Exit feedback from the member
                    {profile.exitFeedbackRating && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{profile.exitFeedbackRating}/5</span>}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: profile.exitFeedbackText ? 'normal' : 'italic' }}>
                    {profile.exitFeedbackText || 'No written feedback left.'}
                  </p>
                  {profile.leftAt && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Finalized {formatDate(profile.leftAt)}
                    </p>
                  )}
                </div>
              ) : form.status === 'Leaving' ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Waiting on their next sign-in to see if they leave feedback.</p>
              ) : null}

              {form.status === 'Left' && onDelete && (
                <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(var(--danger-rgb), 0.15)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ color: 'var(--danger)', borderColor: 'rgba(var(--danger-rgb), 0.3)' }}
                    onClick={() => {
                      if (window.confirm(`Permanently delete ${member.member}'s profile? This can't be undone - they'll disappear from every member list. Their payment history, reviews, and other records stay intact.`)) {
                        onDelete(member.email);
                      }
                    }}
                  >
                    <Trash2 size={14} /> Delete Permanently
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Removes their profile and hides them from every member list. Doesn't touch their payment history, reviews, or other records.
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Link size={13} /> LinkedIn Profile
              </label>
              <input type="url" className="form-input" placeholder="https://linkedin.com/in/..." value={form.linkedin} onChange={update('linkedin')} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                <Phone size={13} /> Phone Number
              </label>
              <input type="tel" className="form-input" placeholder="+27 ..." value={form.phone} onChange={update('phone')} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Money Owed (R)</label>
            <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00" value={form.moneyOwed} onChange={update('moneyOwed')} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Profile</button>
          </div>
        </form>
      </div>
    </div>
  );
}
