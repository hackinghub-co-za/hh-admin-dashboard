import React, { useState, useEffect } from 'react';
import { fetchCalendarEvents } from '../../lib/googleCalendar';
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
} from 'lucide-react';

export default function AdminDashboard({ activeTab, providerToken }) {
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  useEffect(() => {
    if (activeTab === '1on1s' && providerToken) {
      setLoadingEvents(true);
      setEventsError(null);
      fetchCalendarEvents(providerToken)
        .then((events) => {
          setGoogleEvents(events);
          setLoadingEvents(false);
        })
        .catch((err) => {
          console.error('Calendar error:', err);
          setEventsError(err.message);
          setLoadingEvents(false);
        });
    }
  }, [activeTab, providerToken]);
  // Mock State for dynamic interactions
  const [meetups, setMeetups] = useState([
    { id: 1, title: 'Intro to Zero-Knowledge Proofs', date: '2026-08-15', time: '18:30', location: 'HH Discord & Hybrid JHB', rsvps: 42, status: 'upcoming' },
    { id: 2, title: 'Wargaming & CTF Walkthroughs', date: '2026-08-22', time: '14:00', location: 'Hacking Hub HQ, Cape Town', rsvps: 58, status: 'upcoming' },
    { id: 3, title: 'Active Directory Exploitation 101', date: '2026-08-01', time: '19:00', location: 'Online', rsvps: 89, status: 'completed' },
  ]);

  const [oneOnOnes, setOneOnOnes] = useState([
    { id: 1, member: 'Sanele Khumalo', mentor: 'Jaco du Toit', time: 'Today, 14:00', topic: 'OSCP Prep Roadmap', status: 'scheduled' },
    { id: 2, member: 'Liam O\'Connor', mentor: 'Sarah Jenkins', time: 'Tomorrow, 10:00', topic: 'Web Security Portfolio Review', status: 'scheduled' },
    { id: 3, member: 'Fatima Patel', mentor: 'Jaco du Toit', time: 'Yesterday, 16:30', topic: 'Malware Analysis Basics', status: 'completed' },
  ]);

  const [certs, setCerts] = useState([
    { id: 1, name: 'Offensive Security Certified Professional (OSCP)', date: '2026-09-12', candidates: 5, cohort: 'OSCP-26B' },
    { id: 2, name: 'Certified Information Systems Security Professional (CISSP)', date: '2026-09-28', candidates: 3, cohort: 'CISSP-Autumn' },
    { id: 3, name: 'eLearnSecurity Certified Professional Penetration Tester (eCPPT)', date: '2026-10-05', candidates: 8, cohort: 'eCPPT-Intro' },
  ]);

  const [payments, setPayments] = useState([
    { id: 1, member: 'Kabelo Modise', plan: 'Core Member (Monthly)', amount: 'R 650', date: '2026-08-07', status: 'paid' },
    { id: 2, member: 'Zoe van der Merwe', plan: 'Elite Member (Annual)', amount: 'R 6,500', date: '2026-08-06', status: 'paid' },
    { id: 3, member: 'Devon Smith', plan: 'Core Member (Monthly)', amount: 'R 650', date: '2026-08-04', status: 'unpaid' },
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

    case 'payments':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Subscriptions & Payments</h1>
            <p>Track membership billing statuses and logs.</p>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3>Recent Transactions</h3>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <Search size={16} style={{ marginTop: '2px' }} />
                <input type="text" placeholder="Search billing..." style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none' }} />
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Member</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Plan Type</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Invoice Date</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Amount</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 600 }}>{p.member}</td>
                    <td style={{ padding: '16px 12px' }}>{p.plan}</td>
                    <td style={{ padding: '16px 12px' }}>{p.date}</td>
                    <td style={{ padding: '16px 12px', fontWeight: 600 }}>{p.amount}</td>
                    <td style={{ padding: '16px 12px' }}>
                      <span className={`badge ${p.status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                        {p.status}
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
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Certification Calendar</h1>
            <p>Track student target exam dates and review cohorts.</p>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '20px' }}>Exam Cohort Deadlines</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {certs.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span className="badge badge-warning" style={{ fontSize: '0.65rem', marginBottom: '12px' }}>
                      {c.cohort}
                    </span>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '8px', lineHeight: '1.4' }}>{c.name}</h4>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Target Exam Date:</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{c.date}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Candidates:</span>
                    <strong>{c.candidates} Active</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'finances':
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Financial Ledger</h1>
            <p>Hacking Hub gross income, expenses, and cash reserves.</p>
          </div>

          {/* Finances Metric Cards */}
          <div className="metrics-row" style={{ marginBottom: '32px' }}>
            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Gross Cash Reserves</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--success)' }}>R 482,900.00</h2>
            </div>
            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Net Monthly Revenue</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--accent-cyan)' }}>R 78,800.00</h2>
            </div>
            <div className="glass-card">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Operational Costs (Monthly)</span>
              <h2 style={{ fontSize: '1.75rem', marginTop: '8px', color: 'var(--danger)' }}>R 12,400.00</h2>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '20px' }}>Budget Allocations</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Ledger Category</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Monthly Allocation</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '16px 12px', fontWeight: 600 }}>Mentorship Stipends</td>
                  <td style={{ padding: '16px 12px' }}><span className="badge badge-success">active</span></td>
                  <td style={{ padding: '16px 12px' }}>R 8,500.00</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '16px 12px', fontWeight: 600 }}>Infra Hosting (AWS/Vercel/Supabase)</td>
                  <td style={{ padding: '16px 12px' }}><span className="badge badge-success">active</span></td>
                  <td style={{ padding: '16px 12px' }}>R 1,200.00</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '16px 12px', fontWeight: 600 }}>Domain Renewal & Admin Tools</td>
                  <td style={{ padding: '16px 12px' }}><span className="badge badge-success">active</span></td>
                  <td style={{ padding: '16px 12px' }}>R 350.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );

    default:
      return null;
  }
}
