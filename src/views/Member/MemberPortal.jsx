import React, { useState } from 'react';
import { createPayfastCheckoutUrl } from '../../lib/payfast';
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
} from 'lucide-react';

export default function MemberPortal({ activeTab }) {
  // Mock roadmap tasks
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Complete PortSwigger Web Security Academy: Directory Traversal', completed: true },
    { id: 2, text: 'Submit write-up for HackTheBox: "Internal" machine', completed: false },
    { id: 3, text: 'Review Windows Active Directory privilege escalation notes', completed: false },
    { id: 4, text: 'Schedule mock OSCP exam run with Jaco (Mentor)', completed: false },
  ]);

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

  // Router for Member Dashboard
  switch (activeTab) {
    case 'dashboard':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Welcome back, Sanele!</h1>
            <p>Here is your current cybersecurity progression overview.</p>
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
                  <strong>Core Member</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Next Payment Date:</span>
                  <strong>2026-09-01</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '16px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Monthly Fee:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>R 650.00</strong>
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
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Target Certifications</h1>
            <p>Track targets and calendars for security certifications.</p>
          </div>

          <div className="glass-card" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3>My Cohorts</h3>
            <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="badge badge-warning">OSCP-26B</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cohort Target</span>
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>OSCP Certification Exam</h4>
              <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>A 24-hour practical penetration testing examination compiled by Offensive Security.</p>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Target Date:</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>2026-09-12</strong>
              </div>
            </div>
          </div>
        </div>
      );

    case 'billing':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>My Subscription & PayFast Billing</h1>
            <p>Manage active subscriptions and upgrade your Hacking Hub clearance level.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div className="glass-card">
              <h3 style={{ marginBottom: '16px' }}>Current Active Subscription</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Plan Name</span>
                <strong>Monthly Operative</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Price</span>
                <strong>R 600.00 / month</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment Gateway</span>
                <span className="badge badge-success">PayFast (ZAR)</span>
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Manage PayFast Subscription</button>
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
                Subscriptions automatically sync with your profile upon Instant Payment Notification (ITN).
              </p>
            </div>
          </div>

          <h3 style={{ marginBottom: '20px' }}>Upgrade / Pay via PayFast</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            {/* Basic Access */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span className="badge badge-warning" style={{ marginBottom: '12px' }}>BASIC ACCESS</span>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>R 200.00 <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ month</span></h4>
                <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>Discord community access, CV & LinkedIn reviews.</p>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handlePayfastPay('Basic Access', 200)}
              >
                Pay R200 via PayFast <ExternalLink size={14} />
              </button>
            </div>

            {/* Monthly Operative */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--accent-cyan)' }}>
              <div>
                <span className="badge badge-success" style={{ marginBottom: '12px' }}>MONTHLY OPERATIVE</span>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>R 600.00 <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ month</span></h4>
                <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>Accountability, 1on1 sessions, private channels, CompTIA discounts.</p>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handlePayfastPay('Monthly Operative', 600)}
              >
                Pay R600 via PayFast <ExternalLink size={14} />
              </button>
            </div>

            {/* Permanent Access */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span className="badge badge-success" style={{ marginBottom: '12px', background: 'rgba(192, 132, 252, 0.2)', color: 'var(--accent-purple)' }}>PERMANENT ACCESS</span>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>R 1,000.00 <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ 6 months</span></h4>
                <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>Lifetime access via 6 monthly installments, free Azure exams, priority support.</p>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' }}
                onClick={() => handlePayfastPay('Permanent Access', 1000)}
              >
                Pay R1,000 via PayFast <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
