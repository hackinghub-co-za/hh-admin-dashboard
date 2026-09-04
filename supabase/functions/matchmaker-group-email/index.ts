// Hacking Hub Admin Dashboard - Matchmaker Group Assignment Email
//
// Deploy with: supabase functions deploy matchmaker-group-email
// Requires this secret set first (shared with roadmap-reminder-email, no
// separate key needed):
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Unlike roadmap-reminder-email (triggered by pg_cron, no user JWT, gated by
// CRON_SECRET), this is called directly by an admin session right after
// run_matchmaker_round() succeeds (AdminDashboard.jsx) - a real caller JWT
// exists, so this verifies the caller is an admin the same simple way
// App.jsx does client-side (an @hackinghub.co.za email), rather than
// needing --no-verify-jwt + a shared secret.
//
// Idempotent by design: scans matchmaker_groups for status='Active' AND
// notified_at IS NULL, emails every member of every such group, then stamps
// notified_at - so calling this again (a second admin click, a retry after
// a partial failure) only ever emails whoever hasn't already heard.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const PORTAL_URL = 'https://portal.hackinghub.co.za';

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'a date your coach will confirm soon';
  const d = new Date(`${dueDate}T00:00:00`);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

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

function groupEmailHtml(firstName: string, activityType: string, teammateNames: string[], dueDate: string | null): string {
  const teammateList = teammateNames.length
    ? teammateNames.join(teammateNames.length > 1 ? ', ' : '')
    : 'your teammate(s)';
  return `
    <p>Hi ${firstName},</p>
    <p>You've been randomly matched into a group for a <strong>${activityType}</strong> - working alongside <strong>${teammateList}</strong>.</p>
    <p>It's due on <strong>${formatDueDate(dueDate)}</strong>. Head to Matchmaker in the portal to see your group, check out who's on it, and start planning.</p>
    <p style="margin:20px 0 8px;font-weight:600;">Next steps:</p>
    <ul style="margin:0 0 20px;padding-left:20px;">
      <li>Create a WhatsApp group with your teammates</li>
      <li>Book a session with your team to plan out what you'll build or present</li>
    </ul>
    <p>— Gemma</p>
    <p style="margin:22px 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;">See Your Group</a>
    </p>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
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
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    const callerEmail = (userData?.user?.email || '').toLowerCase();
    if (authError || !callerEmail || !callerEmail.endsWith('@hackinghub.co.za')) {
      return new Response(JSON.stringify({ error: 'Admins only.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: groups, error: groupsError } = await adminClient
      .from('matchmaker_groups')
      .select('id, activity_type, member_emails, due_date')
      .eq('status', 'Active')
      .is('notified_at', null);

    if (groupsError) {
      console.error('matchmaker-group-email: fetching groups failed', groupsError.message);
      return new Response(JSON.stringify({ error: 'Could not load groups.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targets = groups || [];
    if (targets.length === 0) {
      return new Response(JSON.stringify({ groupsNotified: 0, emailsSent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const allEmails = [...new Set(targets.flatMap((g) => g.member_emails as string[]))];
    const { data: profiles } = await adminClient
      .from('member_profiles')
      .select('email, full_name')
      .in('email', allEmails);
    const nameByEmail: Record<string, string> = Object.fromEntries(
      (profiles || []).map((p: { email: string; full_name: string | null }) => [p.email, p.full_name || ''])
    );

    let groupsNotified = 0;
    let emailsSent = 0;
    const failures: string[] = [];

    for (const group of targets) {
      const memberEmails = group.member_emails as string[];
      let groupHadFailure = false;

      for (const email of memberEmails) {
        try {
          const teammates = memberEmails.filter((e) => e !== email);
          const teammateNames = teammates.map((e) => nameByEmail[e] || e);
          const firstName = (nameByEmail[email] || '').trim().split(' ')[0] || 'there';
          await sendEmail(
            resendKey,
            email,
            `You've been assigned a ${group.activity_type} team!`,
            groupEmailHtml(firstName, group.activity_type, teammateNames, group.due_date)
          );
          emailsSent += 1;
        } catch (err) {
          groupHadFailure = true;
          failures.push(email);
          console.error(`matchmaker-group-email: failed for ${email} (group ${group.id})`, err instanceof Error ? err.message : err);
          // Keep going - one member's bounce/Resend hiccup shouldn't block
          // the rest of their group, or the rest of the round.
        }
      }

      // Only stamp notified_at if every member in this group actually got
      // an email - a partial failure should retry the WHOLE group next
      // time this runs, not silently skip the member(s) who failed.
      if (!groupHadFailure) {
        const { error: markError } = await adminClient
          .from('matchmaker_groups')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', group.id);
        if (markError) {
          console.error(`matchmaker-group-email: marking group ${group.id} notified failed`, markError.message);
        } else {
          groupsNotified += 1;
        }
      }
    }

    return new Response(JSON.stringify({ groupsNotified, emailsSent, failed: failures }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('matchmaker-group-email error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
