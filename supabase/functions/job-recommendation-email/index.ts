// Hacking Hub Admin Dashboard - Job Recommendation Email
//
// Deploy with: supabase functions deploy job-recommendation-email
// Requires this secret set first (shared with every other Resend-based
// function, no separate key needed):
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// The Job Board tab already does a rule-based match (job_board.track =
// member_profiles.roadmap_track, 025_job_board.sql) that badges a matching
// listing "Matches your track" and sorts it to the top - but that's silent
// unless a member happens to reopen the tab. This closes that gap: called
// fire-and-forget right after a job is posted (MemberPortal.jsx's and
// AdminDashboard.jsx's handleAddJob, same trigger point as the existing
// logPortalEvent('job_posted')), it emails every member whose roadmap_track
// matches the new listing's track.
//
// Any signed-in, allowed member can trigger this - job_board is a
// self-service "member owns their own submission" table, not admin-only, so
// this checks is_member_allowed() the same way push-new-job (hh-app's own
// version of this notification) does, not get_my_role().
//
// Deliberately scoped to ONE specific job_id (re-read server-side, never
// trusting client-supplied title/company/track), not a backlog scan - a
// listing with no track (job_board.track IS NULL, e.g. a broad graduate
// programme) has nothing to match against and is silently skipped, exactly
// like cert-pass-email skips a cert not actually marked Passed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const PORTAL_URL = 'https://portal.hackinghub.co.za';
const UNSUBSCRIBE_URL_BASE = 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/job-recommendation-unsubscribe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendEmail(resendApiKey: string, toEmail: string, subject: string, html: string): Promise<void> {
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

function jobRecommendationEmailHtml(firstName: string, job: { title: string; company: string; location: string | null; salary: string | null; track: string; link: string | null }, unsubscribeUrl: string): string {
  return `
    <p>Hi ${firstName},</p>
    <p>A new ${job.track} role just went up on the Job Board that matches your roadmap track:</p>
    <p style="margin:18px 0;padding:16px 18px;border:1px solid #e2e2e2;border-radius:8px;">
      <strong style="font-size:1.05rem;">${job.title}</strong><br/>
      ${job.company}${job.location ? ` · ${job.location}` : ''}${job.salary ? ` · ${job.salary}` : ''}
    </p>
    <p>— Gemma</p>
    <p style="margin:22px 0;">
      <a href="${job.link && /^https?:\/\//i.test(job.link) ? job.link : PORTAL_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;">${job.link ? 'View & Apply' : 'See It On The Job Board'}</a>
    </p>
    <p style="margin-top:32px;font-size:0.8rem;color:#888;">
      You're getting this because a job matched your ${job.track} track.
      <a href="${unsubscribeUrl}" style="color:#888;">Unsubscribe from job match emails</a>.
    </p>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'Not configured - missing RESEND_API_KEY secret.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    const callerEmail = (userData?.user?.email || '').toLowerCase();
    if (authError || !callerEmail) {
      return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: allowed } = await adminClient.rpc('is_member_allowed', { check_email: callerEmail });
    if (allowed !== true) {
      return new Response(JSON.stringify({ error: 'Access not permitted.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { job_id } = await req.json();
    if (typeof job_id !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing job_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: job, error: jobError } = await adminClient
      .from('job_board')
      .select('id, title, company, location, salary, track, link, created_by')
      .eq('id', job_id)
      .maybeSingle();
    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!job.track) {
      return new Response(JSON.stringify({ skipped: true, reason: 'listing has no track to match' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: recipients, error: recipientsError } = await adminClient
      .from('member_profiles')
      .select('email, full_name')
      .eq('roadmap_track', job.track)
      .eq('job_recommendation_opted_out', false)
      .neq('status', 'Left');
    if (recipientsError) {
      console.error('job-recommendation-email: recipient lookup failed', recipientsError.message);
      return new Response(JSON.stringify({ error: 'Recipient lookup failed.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const posterEmail = (job.created_by || '').toLowerCase();
    const toSend = (recipients || []).filter((r) => r.email !== posterEmail);

    let sent = 0;
    for (const r of toSend) {
      const firstName = (r.full_name || '').trim().split(' ')[0] || 'there';
      const unsubscribeUrl = `${UNSUBSCRIBE_URL_BASE}?email=${encodeURIComponent(r.email)}`;
      try {
        await sendEmail(
          resendKey,
          r.email,
          `New ${job.track} role: ${job.title}`,
          jobRecommendationEmailHtml(firstName, job, unsubscribeUrl)
        );
        sent += 1;
      } catch (err) {
        console.error(`job-recommendation-email: send to ${r.email} failed`, err instanceof Error ? err.message : err);
      }
    }

    return new Response(JSON.stringify({ candidates: toSend.length, sent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('job-recommendation-email error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
