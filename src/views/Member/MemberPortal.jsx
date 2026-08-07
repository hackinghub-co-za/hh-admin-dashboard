import React, { useState } from 'react';
import { createPayfastCheckoutUrl } from '../../lib/payfast';
import CertDetailsModal from '../../components/CertDetailsModal';
import {
  Calendar,
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
} from 'lucide-react';

export default function MemberPortal({ activeTab }) {
  const [selectedCert, setSelectedCert] = useState(null);
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
                  <Video size={16} /> Join Discord Call
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
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Book a 1on1 Session</h1>
            <p>Connect with your assigned mentor for technical review or roadmap check-in.</p>
          </div>

          <div className="glass-card" style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '20px' }}>Schedule Session</h3>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={e => e.preventDefault()}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Mentor</label>
                <input type="text" className="form-input" value="Jaco du Toit (Assigned)" disabled />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Preferred Date</label>
                  <input type="date" className="form-input" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Preferred Time Slot</label>
                  <select className="form-input">
                    <option>09:00 - 10:00</option>
                    <option>10:30 - 11:30</option>
                    <option>14:00 - 15:00</option>
                    <option>16:00 - 17:00</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>Focus Topic</label>
                <textarea className="form-input" placeholder="Explain what you want to cover..." style={{ height: '80px', resize: 'vertical' }}></textarea>
              </div>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                Submit Booking Request
              </button>
            </form>
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
      return null;
  }
}
