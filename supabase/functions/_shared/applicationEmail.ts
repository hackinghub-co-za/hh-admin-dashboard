// Hacking Hub Admin Dashboard - "Application received" email (shared)
//
// Sent to someone right after their Elite Operative application lands in the
// Sales Pipeline as a new card (pipeline-lead-intake). Once per card:
// pipeline_prospects.application_email_sent_at (106_pipeline_lead_intake.sql)
// is stamped on success, and the intake only calls this for a brand-new card,
// so applying twice doesn't send it twice.
//
// Two versions. In the target profile: thanks, the booking link for the call,
// questions to think about and tips for the call, free resources, YouTube and
// TikTok. Outside it (the card went straight to Not Qualified): thanks, the
// free resources and the socials only, with no call and no promise to reply.
// Requires the RESEND_API_KEY secret, shared with every other email function.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Siya from Hacking Hub <siya@hackinghub.co.za>';
const BOOKING_URL = 'https://cal.com/siya-gladile-yabcoe/15min';
const YOUTUBE_URL = 'https://www.youtube.com/@Siya-cybersecurity';
const TIKTOK_URL = 'https://www.tiktok.com/@siya.gladile';

const RESOURCES = [
  { title: 'Cisco Networking Academy: Cybersecurity career path', blurb: 'Free courses from Cisco that take you from the basics towards a first cyber role', url: 'https://www.netacad.com/career-paths/cybersecurity?courseLang=en-US' },
  { title: 'Immersive Labs Cyber Million', blurb: 'Free hands-on labs for people starting a cyber career', url: 'https://www.immersivelabs.com/resources/cybermillion' },
];

const QUESTIONS = [
  'Where are you right now: working, studying, or looking for work?',
  'Which role do you want to be in 12 months from now?',
  'How many hours a week can you honestly give to studying?',
  'What has stopped you from getting into cyber so far?',
  'What questions do you have for me about Hacking Hub?',
];

const TIPS = [
  'It’s about 15 minutes. Join on time from somewhere quiet.',
  'Have your CV or LinkedIn profile open in case we look at it together.',
  'Be honest about your time and your budget. It helps me point you to the right option, even if that isn’t Elite.',
  'Bring your questions. There are no wrong ones.',
];

const C = { navy: '#17183c', ink: '#1b1d3a', ink3: '#6b7096', line: '#e3e5f1', soft: '#f4f6fb', green: '#17a856', link: '#17803f' };

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** First word of the applicant's name, or null when there is no usable name. */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = String(fullName || '').trim().split(/\s+/)[0];
  return first && !first.includes('@') ? first : null;
}

const h3 = (t: string) => `<h3 style="font-size:16px;color:${C.navy};margin:26px 0 8px;">${t}</h3>`;
const button = (href: string, label: string, bg: string) =>
  `<a href="${href}" style="display:inline-block;background:${bg};color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;margin:0 8px 8px 0;">${label}</a>`;

export function buildApplicationEmail(fullName: string | null, qualified: boolean): { subject: string; html: string } {
  const first = firstNameOf(fullName);
  const hi = first ? `Hi ${esc(first)},` : 'Hi there,';

  const resources = RESOURCES.map((r) => `
    <a href="${r.url}" style="display:block;border:1px solid ${C.line};border-radius:10px;padding:10px 14px;margin-bottom:8px;text-decoration:none;color:${C.ink};">
      <strong style="display:block;color:${C.navy};">${r.title}</strong>
      <span style="font-size:13px;color:${C.ink3};">${r.blurb}</span>
    </a>`).join('');

  const socials = `${h3('Follow along')}
    <p style="margin:0 0 10px;font-size:15px;">I post free cyber career content every week. Subscribe so you don’t miss it.</p>
    <p style="margin:0 0 6px;">${button(YOUTUBE_URL, 'Subscribe on YouTube', C.navy)}${button(TIKTOK_URL, 'Follow on TikTok', C.green)}</p>`;

  const callPart = qualified ? `
    <p style="margin:0 0 12px;font-size:15px;">Thank you for applying to Elite Operative. I read every application myself and will review yours within 2 working days. The next step is a short call so we can see if Elite is the right fit for you. Book a time that suits you now:</p>
    <p style="margin:0 0 4px;">${button(BOOKING_URL, 'Book your call with Siya', C.green)}</p>

    ${h3('Before our call, think about these')}
    <div style="background:${C.soft};border-radius:10px;padding:14px 16px;">
      <ol style="margin:0;padding-left:20px;font-size:15px;">${QUESTIONS.map((q) => `<li style="margin-bottom:6px;">${q}</li>`).join('')}</ol>
    </div>

    ${h3('Tips for the call')}
    <ul style="margin:0;padding-left:20px;font-size:15px;">${TIPS.map((t) => `<li style="margin-bottom:6px;">${t}</li>`).join('')}</ul>`
    : `
    <p style="margin:0 0 12px;font-size:15px;">Thank you for applying to Elite Operative, and for your interest in Hacking Hub. While you’re getting started, here are some of the best free resources to build your skills.</p>`;

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;color:${C.ink};line-height:1.6;padding:26px;">
    <p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.green};">Hacking Hub · Elite Operative</p>
    <h2 style="font-size:23px;line-height:1.25;color:${C.navy};margin:6px 0 14px;">We’ve got your application</h2>
    <p style="margin:0 0 12px;font-size:15px;">${hi}</p>
    ${callPart}

    ${h3(qualified ? 'Free resources to start with now' : 'Free resources to start with')}
    ${resources}

    ${socials}

    <p style="margin:22px 0 0;font-size:15px;">${qualified ? 'Speak soon' : 'All the best'},<br>Siya Gladile<br>Founder, Hacking Hub</p>
  </div>`;

  return {
    subject: first ? `Thanks for applying to Elite Operative, ${first}` : 'Thanks for applying to Elite Operative',
    html,
  };
}

/** Sends the email and stamps application_email_sent_at. Never throws. */
export async function sendApplicationEmail(
  admin: SupabaseClient,
  resendKey: string,
  card: { id: number; name: string | null; email: string; qualified: boolean },
): Promise<boolean> {
  try {
    const { subject, html } = buildApplicationEmail(card.name, card.qualified);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [card.email], subject, html }),
    });
    if (!res.ok) {
      console.error(`application email not sent (${res.status}): ${await res.text()}`);
      return false;
    }
    const { error } = await admin.from('pipeline_prospects').update({ application_email_sent_at: new Date().toISOString() }).eq('id', card.id);
    if (error) console.error('application email sent but not stamped:', error.message);
    return true;
  } catch (err) {
    console.error('application email failed:', err);
    return false;
  }
}
