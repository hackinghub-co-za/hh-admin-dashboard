// Hacking Hub Admin Dashboard - New Member Welcome Email (shared)
//
// One email replaces the five WhatsApp messages that used to be sent by hand
// after every payment. Used by payfast-webhook (a completed payment) and by
// the welcome-email function (an EFT payment or manual add from admin, and
// the "Resend welcome email" button).
//
// Sent once per member: member_profiles.welcome_email_sent_at
// (006_onboarding.sql PART 4) is stamped on success, so a renewal payment
// does not send it again. `force` skips that check for a deliberate resend.
// Requires the RESEND_API_KEY secret, shared with every other email function.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Siya from Hacking Hub <siya@hackinghub.co.za>';
const PORTAL_URL = 'https://portal.hackinghub.co.za';
const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/JjJxnaHruvu8EYdgcUOyz1';
// Lesedi's WhatsApp number, with "Hi Lesedi" ready to send.
const LESEDI_WHATSAPP_URL = 'https://wa.me/27820984319?text=Hi%20Lesedi';
const LESEDI_PHONE_DISPLAY = '+27 82 098 4319';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** First word of the member's name, or null when there is no usable name. */
export function firstNameFrom(fullName: string | null | undefined): string | null {
  const first = (fullName || '').trim().split(/\s+/)[0];
  return first || null;
}

function button(href: string, label: string, background: string, color: string): string {
  return `<a href="${href}" style="display:inline-block;background:${background};color:${color};padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">${label}</a>`;
}

function stepRow(number: number, body: string): string {
  return `
    <tr>
      <td style="vertical-align:top;padding:0 14px 20px 0;width:30px;">
        <div style="width:30px;height:30px;line-height:30px;border-radius:50%;background:#17183c;color:#5ee37a;text-align:center;font-weight:700;font-size:14px;">${number}</div>
      </td>
      <td style="vertical-align:top;padding:0 0 20px 0;">${body}</td>
    </tr>`;
}

export function welcomeEmailSubject(firstName: string | null): string {
  return firstName ? `Welcome to Hacking Hub, ${firstName}` : 'Welcome to Hacking Hub';
}

export function welcomeEmailHtml(firstName: string | null): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';
  return `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1b1d3a;max-width:560px;">
      <p>${greeting}</p>
      <p>Your payment came through and your place is confirmed. Three things to do, in this order:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;">
        ${stepRow(1, `
          <strong>Sign in to the portal on a laptop or desktop.</strong> Use the email address you paid with, then fill in your profile.<br>
          <span style="display:block;margin-top:8px;">${button(PORTAL_URL, 'Open the portal', '#5ee37a', '#10122b')}</span>`)}
        ${stepRow(2, `
          <strong>Join the community WhatsApp group.</strong><br>
          <span style="display:block;margin-top:8px;">${button(WHATSAPP_COMMUNITY_URL, 'Join the community', '#17183c', '#ffffff')}</span>`)}
        ${stepRow(3, `
          <strong>Message Lesedi on WhatsApp and say &ldquo;Hi Lesedi&rdquo;.</strong> She will help you fix your LinkedIn profile and write your introduction.<br>
          <span style="display:block;margin-top:8px;">${button(LESEDI_WHATSAPP_URL, 'Message Lesedi', '#17183c', '#ffffff')}</span>
          <span style="display:block;margin-top:6px;color:#4d5275;font-size:13px;">Or save her number: ${LESEDI_PHONE_DISPLAY}</span>`)}
      </table>
      <p style="border-left:4px solid #f5b942;background:#fff6e2;padding:12px 16px;border-radius:0 8px 8px 0;color:#4a3300;">
        <strong>One thing:</strong> please don&rsquo;t introduce yourself in the group yet. Lesedi will tell you when it&rsquo;s time.
      </p>
      <p>See you inside,<br>Siya</p>
    </div>`;
}

async function postToResend(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: toEmail, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend request failed: ${res.status} ${text}`);
  }
}

export type WelcomeEmailResult = { sent: true } | { sent: false; reason: string };

/**
 * Sends the welcome email to one member and stamps welcome_email_sent_at.
 * Skips (without error) when it was already sent, unless `force` is set.
 * Throws when the email service rejects the send.
 */
export async function sendWelcomeEmail(
  adminClient: SupabaseClient,
  resendApiKey: string,
  email: string,
  options: { force?: boolean } = {},
): Promise<WelcomeEmailResult> {
  const lowerEmail = email.trim().toLowerCase();
  if (!lowerEmail) return { sent: false, reason: 'no email address' };

  const { data: profile, error } = await adminClient
    .from('member_profiles')
    .select('full_name, welcome_email_sent_at')
    .eq('email', lowerEmail)
    .maybeSingle();
  if (error) throw new Error(`Could not load the member profile: ${error.message}`);

  if (profile?.welcome_email_sent_at && !options.force) {
    return { sent: false, reason: 'already sent' };
  }

  const firstName = firstNameFrom(profile?.full_name);
  await postToResend(resendApiKey, lowerEmail, welcomeEmailSubject(firstName), welcomeEmailHtml(firstName));

  const { error: stampError } = await adminClient
    .from('member_profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('email', lowerEmail);
  if (stampError) {
    // The email is already out; a missing stamp only risks one repeat later.
    console.error('welcome email: could not stamp welcome_email_sent_at', stampError.message);
  }
  return { sent: true };
}
