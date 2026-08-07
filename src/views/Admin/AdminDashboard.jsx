import React, { useState, useEffect } from 'react';
import { fetchCalendarEvents, fetchCertCalendarEvents } from '../../lib/googleCalendar';
import CertDetailsModal from '../../components/CertDetailsModal';
import payfastTransactionsData from '../../data/payfastTransactions.json';
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
} from 'lucide-react';

export default function AdminDashboard({ activeTab, providerToken }) {
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  // Certifications state
  const [selectedCert, setSelectedCert] = useState(null);
  const [certEvents, setCertEvents] = useState([]);
  const [loadingCertEvents, setLoadingCertEvents] = useState(false);
  const [certEventsError, setCertEventsError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [certs, setCerts] = useState([
    { id: 1, member: 'Sanele Khumalo', name: 'OSCP Penetration Tester', date: '2026-09-12', cohort: 'OSCP-26B' },
    { id: 2, member: 'Nonhlanhla Sindane', name: 'CompTIA Security+', date: '2026-08-28', cohort: 'SecPlus-Aug' },
    { id: 3, member: 'Khody Netshifhefhe', name: 'eLearnSecurity eCPPT', date: '2026-10-05', cohort: 'eCPPT-Intro' },
    { id: 4, member: 'Joshua Harrop', name: 'Microsoft Azure Security (AZ-500)', date: '2026-09-01', cohort: 'Azure-Q3' },
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
      },
    ]);
    setNewCert({ member: '', name: '', date: '', cohort: '' });
  };

  // PayFast Transactions initialized from exported CSV
  const [payments, setPayments] = useState(payfastTransactionsData);

  const [oneOnOnes, setOneOnOnes] = useState([
    { id: 1, member: 'Sanele Khumalo', mentor: 'Siyambonga Gladile', time: 'Today, 14:00', topic: 'OSCP Prep Roadmap', status: 'scheduled' },
    { id: 2, member: 'Liam O\'Connor', mentor: 'Siyambonga Gladile', time: 'Tomorrow, 10:00', topic: 'Web Security Portfolio Review', status: 'scheduled' },
    { id: 3, member: 'Fatima Patel', mentor: 'Jaco du Toit', time: 'Yesterday, 16:30', topic: 'Malware Analysis Basics', status: 'completed' },
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

  // PayFast Financial Metrics
  const totalGrossRevenue = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalFeesPaid = payments.reduce((acc, p) => acc + (p.fee || 0), 0);
  const totalNetRevenue = payments.reduce((acc, p) => acc + (p.net || (p.amount - (p.fee || 0))), 0);
  const monthlyRecurringRevenue = payments.filter(p => p.plan === 'Monthly Operative' || p.plan === 'Basic Access').reduce((acc, p) => acc + p.amount, 0);
  const totalTransactions = payments.length;

  const filteredPayments = payments.filter(p =>
    p.member.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.pfId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.plan.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>1,248</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--success)' }}>
                <ArrowUpRight size={16} /> <span>+4.2% this month</span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Monthly Churn Rate</span>
                <TrendingUp size={20} color="var(--danger)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>2.1%</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--success)' }}>
                <ArrowDownRight size={16} /> <span>-0.4% improvement</span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Average Stay (Length)</span>
                <Clock size={20} color="var(--warning)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>14.8 m</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Average membership duration</span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Avg Revenue per Member</span>
                <DollarSign size={20} color="var(--accent-purple)" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>R 632</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--success)' }}>
                <ArrowUpRight size={16} /> <span>+R 14 from cross-sells</span>
              </div>
            </div>
          </div>

          {/* Quick Info Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '32px' }}>
            {/* Quick Chart */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '24px' }}>MRR Growth Trend (ZAR)</h3>
              <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', padding: '10px 0' }}>
                {[380, 420, 480, 520, 610, 680, 788].map((val, idx) => (
                  <div key={idx} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100%', height: `${(val / 800) * 160}px`, background: 'linear-gradient(to top, var(--accent-purple), var(--accent-cyan))', borderRadius: '4px' }}></div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>M{idx + 1}</span>
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
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Unpaid Invoices</div>
                  <p style={{ fontSize: '0.8rem' }}>14 memberships have failing subscription charges.</p>
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
                        {m.date} at {m.time} | <strong>{m.location}</strong>
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
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Date/Time</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Discussion Topic</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {oneOnOnes.map((session) => (
                  <tr key={session.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 600 }}>{session.member}</td>
                    <td style={{ padding: '16px 12px' }}>{session.mentor}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--accent-cyan)' }}>{session.time}</td>
                    <td style={{ padding: '16px 12px' }}>{session.topic}</td>
                    <td style={{ padding: '16px 12px' }}>
                      <span className={`badge ${session.status === 'scheduled' ? 'badge-warning' : 'badge-success'}`}>
                        {session.status}
                      </span>
                    </td>
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
                          <span className={`badge ${daysLeft <= 7 ? 'badge-danger' : isUrgent ? 'badge-warning' : 'badge-success'}`}>
                            {daysLeft > 0 ? `${daysLeft} Days Left` : daysLeft === 0 ? 'Exam Today!' : 'Exam Passed'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{c.member}</h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.name} <Info size={14} color="var(--accent-cyan)" />
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
                  Data Source: <strong style={{ color: '#fff' }}>payfast_transactions_2026.csv</strong> (Processed Jan 1 - Aug 7, 2026)
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSimulatePayfastPayment}>
                <Plus size={16} /> Simulate PayFast ITN Transaction
              </button>
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
                  placeholder="Search member, email, or PF Ref ID..."
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
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>PayFast Ref ID</th>
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
                    <td style={{ padding: '16px 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.date}</td>
                    <td style={{ padding: '16px 12px', fontFamily: 'monospace', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{p.pfId}</td>
                    <td style={{ padding: '16px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{p.member}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.email}</div>
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{p.plan}</span>
                    </td>
                    <td style={{ padding: '16px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.fundingType || 'Credit Card'}</td>
                    <td style={{ padding: '16px 12px', fontWeight: 700, color: '#fff' }}>R {p.amount.toFixed(2)}</td>
                    <td style={{ padding: '16px 12px', color: 'var(--warning)', fontSize: '0.85rem' }}>-R {(p.fee || 0).toFixed(2)}</td>
                    <td style={{ padding: '16px 12px', fontWeight: 700, color: 'var(--success)' }}>R {(p.net || (p.amount - (p.fee || 0))).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'finances':
      // Calculate Year (2026), Month (Aug 2026), and Week (Past 7 days) Gross Revenue
      const yearlyRevenue = payments.reduce((acc, p) => acc + p.amount, 0);

      const monthlyRevenue = payments
        .filter(p => p.date.startsWith('2026-08'))
        .reduce((acc, p) => acc + p.amount, 0);

      const past7DaysCutoff = new Date(new Date('2026-08-07').getTime() - 7 * 24 * 60 * 60 * 1000);
      const weeklyRevenue = payments
        .filter(p => new Date(p.date) >= past7DaysCutoff)
        .reduce((acc, p) => acc + p.amount, 0);

      // Last 5 PayFast Transactions
      const last5Transactions = payments.slice(0, 5);

      // Next 5 Upcoming Recurring Payments (Calculated 30 days after last payment date)
      const upcomingPayments = payments
        .filter(p => p.plan !== 'One-off' && p.type === 'Funds Received')
        .map(p => {
          const lastDate = new Date(p.date);
          const nextDate = new Date(lastDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          const nextDateStr = nextDate.toISOString().split('T')[0];
          const today = new Date('2026-08-07');
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
