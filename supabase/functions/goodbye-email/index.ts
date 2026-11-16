// Hacking Hub Admin Dashboard - Goodbye Email (staff-triggered)
//
// Deploy with: supabase functions deploy goodbye-email --no-verify-jwt
// Requires: supabase secrets set RESEND_API_KEY=<your Resend API key>
// (shared with every other Resend-based function).
//
// Sent by the "Send goodbye email" button on a member's profile: a thank-you
// to a member who is leaving, with a link to the exit feedback form. It does
// not change the member's status or access; that stays a separate step.
// Body: { email: string }.
//
// Caller must be an admin or community manager, verified with get_my_role()
// the same way welcome-email does it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

const FROM_ADDRESS = 'Siya from Hacking Hub <siya@hackinghub.co.za>';
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/1uVqL3qURZS_MBLoK8ikOt3SRvFdAQC8LAe8r56NA8Ck/viewform';

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The member's track for the sign-off line, or null when none is set. */
function trackFrom(roadmapTrack: string | null, specialty: string | null): string | null {
  for (const value of [roadmapTrack, specialty]) {
    const v = (value || '').trim();
    if (v && v !== 'Not Assigned' && v !== 'Not Set') return v;
  }
  return null;
}

export function goodbyeEmailSubject(firstName: string | null): string {
  return firstName ? `Thank you, ${firstName}` : 'Thank you from Hacking Hub';
}

export function goodbyeEmailHtml(firstName: string | null, track: string | null): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi,';
  const wish = track
    ? `Wishing you all the best with your next steps in ${escapeHtml(track)}.`
    : 'Wishing you all the best with your next steps in cyber.';
  return `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b1d3a;max-width:560px;">
      <div style="background:#17183c;border-radius:10px;padding:22px;margin:0 0 18px;">
        <p style="margin:0 0 8px;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:2px;color:#5ee37a;">FROM THE HACKING HUB TEAM</p>
        <p style="margin:0;font-size:22px;font-weight:800;line-height:1.25;color:#f2f3fa;">Thank you for making us a part of your cyber journey.</p>
      </div>
      <p>${greeting}</p>
      <p>Thank you for making us a part of your cyber journey. We’re sad to see you go, and we’re grateful for the time you spent with the Hacking Hub community.</p>
      <p>Before you head off, we’d really value two minutes of your time. Your honest feedback helps us make Hacking Hub better for everyone still on their journey.</p>
      <p style="margin:22px 0;">
        <a href="${FEEDBACK_FORM_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:700;">Share your feedback</a>
      </p>
      <p>Our door stays open. If you ever want to pick things up again, just reply to this email.</p>
      <p>${wish}</p>
      <p style="margin-top:20px;">Siya<br><span style="font-size:13px;color:#5d6385;">Founder, Hacking Hub</span></p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!resendKey) {
      return respond({ error: 'Not configured - missing RESEND_API_KEY secret.' }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    if (authError || !userData?.user?.email) {
      return respond({ error: 'Admins only.' }, 403);
    }
    const { data: callerRole, error: roleError } = await callerClient.rpc('get_my_role');
    if (roleError || !['admin', 'community_manager'].includes(callerRole)) {
      return respond({ error: 'Admins only.' }, 403);
    }

    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return respond({ error: 'Missing email.' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from('member_profiles')
      .select('email, full_name, roadmap_track, specialty')
      .ilike('email', email.trim())
      .maybeSingle();
    if (profileError) {
      console.error('goodbye-email: loading member failed', profileError.message);
      return respond({ error: 'Could not load that member.' }, 500);
    }
    if (!profile) {
      return respond({ error: 'Member not found.' }, 404);
    }

    const firstName = (profile.full_name || '').trim().split(/\s+/)[0] || null;
    const track = trackFrom(profile.roadmap_track, profile.specialty);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: profile.email,
        subject: goodbyeEmailSubject(firstName),
        html: goodbyeEmailHtml(firstName, track),
      }),
    });
    if (!res.ok) {
      console.error('goodbye-email: Resend failed', res.status, await res.text());
      return respond({ error: 'Could not send the goodbye email.' }, 502);
    }

    return respond({ sent: true });
  } catch (err) {
    console.error('goodbye-email error:', err);
    return respond({ error: 'Could not send the goodbye email.' }, 500);
  }
});
