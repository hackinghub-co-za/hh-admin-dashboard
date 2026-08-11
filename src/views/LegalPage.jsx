import { ShieldCheck } from 'lucide-react';
import logo from '../assets/hacking-hub-logo-sm.png';

// Public, unauthenticated pages required for Google OAuth verification - the
// consent screen's Privacy Policy / Terms of Service links must point to real,
// distinct content (not the app's login screen). Rendered by App.jsx via a
// plain window.location.pathname check, before any Supabase session check, so
// they load instantly for both real visitors and Google's verification review.

const SUPPORT_EMAIL = 'siya.gladile@gmail.com';
const EFFECTIVE_DATE = '11 August 2026';

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>{title}</h2>
      <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {children}
      </div>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <Section title="Who we are">
        <p>
          Hacking Hub Portal ("Hacking Hub", "we", "us") is the membership dashboard for the Hacking Hub
          cybersecurity coaching community, available at hackinghub.co.za. This policy explains what
          information we collect, why, and how you can control it. If you have questions, contact us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--accent-cyan)' }}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="Information we collect">
        <p><strong style={{ color: 'var(--text-primary)' }}>Google Account information.</strong> When you sign in with Google, we receive your name, email address, and profile picture from your Google Account.</p>
        <p><strong style={{ color: 'var(--text-primary)' }}>Google Calendar data (read-only).</strong> With your explicit consent during sign-in, we request read-only access to your Google Calendar solely to match and display your scheduled 1-on-1 mentor sessions inside your dashboard. We only read event times, titles, and attendees for this purpose - we never create, edit, or delete anything on your calendar, and we don't access calendars beyond what's needed to find these sessions.</p>
        <p><strong style={{ color: 'var(--text-primary)' }}>Membership & profile information.</strong> Details you choose to add to your member profile (bio, location, LinkedIn URL, TryHackMe username, employment status, job title, an optional headshot photo), plus your certification progress, competition participation, and community event RSVPs.</p>
        <p><strong style={{ color: 'var(--text-primary)' }}>Payment information.</strong> Membership payments are processed by PayFast, a third-party payment processor. We store only transaction metadata (amount, date, status) needed to track your membership - your card and banking details are handled entirely by PayFast and never reach our systems.</p>
        <p><strong style={{ color: 'var(--text-primary)' }}>Usage data.</strong> Standard technical logs (such as IP address and browser type) collected automatically by our hosting infrastructure.</p>
      </Section>

      <Section title="How we use this information">
        <p>We use the information above to: operate the member portal and admin dashboard; verify your membership and manage access; sync your scheduled 1-on-1 mentor sessions from Google Calendar; show your chosen details in the member directory to other approved members; track certification progress, competitions, and community events; and communicate with you about your account or membership.</p>
      </Section>

      <Section title="Google user data">
        <p>Hacking Hub Portal's use and transfer of information received from Google APIs to any other app will adhere to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>
            Google API Services User Data Policy
          </a>, including the Limited Use requirements.
        </p>
      </Section>

      <Section title="How we share information">
        <p>We do not sell your personal information. We share data only with the service providers that make Hacking Hub Portal work: Supabase (database and authentication infrastructure), Google (sign-in and, with your consent, read-only calendar sync), and PayFast (payment processing). We may also disclose information if required to by law.</p>
      </Section>

      <Section title="Data retention & security">
        <p>Your data is protected by database-level row security so members can only access what they're permitted to see, and is encrypted in transit. We retain your information for as long as your membership is active, or as needed for legitimate accounting or legal purposes, and delete or anonymize it on request.</p>
      </Section>

      <Section title="Your rights">
        <p>You can request access to, correction of, or deletion of your personal data at any time by emailing{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--accent-cyan)' }}>{SUPPORT_EMAIL}</a>. You can revoke
          Hacking Hub Portal's access to your Google Account at any time from your{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>
            Google Account permissions page
          </a>.
        </p>
      </Section>

      <Section title="Children's privacy">
        <p>Hacking Hub Portal is not directed at, and is not knowingly used by, children under 16.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>We may update this policy from time to time. Material changes will be reflected by an updated effective date at the top of this page.</p>
      </Section>
    </>
  );
}

function TermsOfService() {
  return (
    <>
      <Section title="Acceptance of these terms">
        <p>By signing in to Hacking Hub Portal, you agree to these Terms of Service. If you don't agree, please don't use the app.</p>
      </Section>

      <Section title="What Hacking Hub Portal is">
        <p>Hacking Hub Portal is the membership dashboard for the Hacking Hub cybersecurity coaching community. It gives approved members access to their 1-on-1 mentor session schedule, certification tracking, competitions, community events, a member directory, and membership/subscription management.</p>
      </Section>

      <Section title="Eligibility & your account">
        <p>Access is limited to approved Hacking Hub members and admins, and is granted via Google Sign-In. Membership status is controlled by Hacking Hub administrators. You're responsible for keeping your Google Account secure - don't share your account access with anyone else.</p>
      </Section>

      <Section title="Membership & payments">
        <p>Membership fees are processed through PayFast. Recurring subscriptions renew automatically until cancelled. To cancel or ask about a refund, contact us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--accent-cyan)' }}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to: impersonate another member, misuse or scrape information from the member directory, share your account with people outside the community, or use the platform in a way that disrupts other members or Hacking Hub's operations.</p>
      </Section>

      <Section title="Your content">
        <p>You retain ownership of the content you add to your profile (bio, reviews, headshot, etc.). By submitting it, you give Hacking Hub Portal a license to display it to other approved members within the app.</p>
      </Section>

      <Section title="Third-party services">
        <p>Hacking Hub Portal relies on third-party services, including Google (sign-in and calendar sync) and PayFast (payments). We're not responsible for outages or issues originating from these third parties.</p>
      </Section>

      <Section title="Termination">
        <p>We may suspend or terminate access for violating these terms or Hacking Hub's community guidelines. You may request deletion of your account and data at any time.</p>
      </Section>

      <Section title="Disclaimer & limitation of liability">
        <p>Hacking Hub Portal is provided "as is," without warranties of any kind. To the fullest extent permitted by law, Hacking Hub is not liable for indirect or incidental damages arising from your use of the platform.</p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of South Africa.</p>
      </Section>

      <Section title="Changes to these terms">
        <p>We may update these terms from time to time. Continued use of Hacking Hub Portal after a change means you accept the updated terms.</p>
      </Section>
    </>
  );
}

export default function LegalPage({ page }) {
  const isPrivacy = page === 'privacy';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 20px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <img src={logo} alt="Hacking Hub" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Hacking Hub Portal</span>
        </div>
        <a href="/" style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>&larr; Back to hackinghub.co.za</a>

        <div className="glass-card" style={{ marginTop: '24px', padding: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ShieldCheck size={20} color="var(--accent-cyan)" />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
            </h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '32px' }}>Effective {EFFECTIVE_DATE}</p>

          {isPrivacy ? <PrivacyPolicy /> : <TermsOfService />}
        </div>
      </div>
    </div>
  );
}
