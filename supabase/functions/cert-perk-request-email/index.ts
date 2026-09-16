// Hacking Hub Admin Dashboard - Sponsored Cert Perk Request Email
//
// Deploy with: supabase functions deploy cert-perk-request-email
// Requires this secret set first (shared with every other Resend-based
// function, no separate key needed):
//   supabase secrets set RESEND_API_KEY=<your Resend API key>
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.)
//
// Backs the "Request a Sponsored Exam" card at the top of the member Cert
// Calendar tab. Three perk types, each with its own real eligibility rule -
// re-checked here server-side, never trusted from the client, the same
// "never trust the client for what gets shown" rule as every other Edge
// Function in this project:
//   - security_plus_discount: open to every member, no tier check. Matches
//     the founder's explicit instruction (2026-09-16) to leave this one
//     unrestricted, even though the public site's real CompTIA-discount
//     copy is Monthly Operative and up - a deliberate choice, not an
//     oversight, so don't "fix" this to match that copy without asking.
//   - azure_exam: Permanent Access and Elite Operative only, matching the
//     real "Free Azure exams (upon milestone completion)" Permanent Access
//     benefit and Elite's "everything sponsored" tier.
//   - elite_custom: Elite Operative only ("request anything"), carries a
//     free-text `details` field for what they're actually asking for.
//
// Tier is derived the same way MemberPortal.jsx's own "My Subscription" tab
// does (ALL_TIERS/currentPlanRank) - via the existing get_my_last_payment()
// RPC (046_member_billing_summary.sql), called through the caller's own
// authenticated client so it's scoped to their real payment history, not a
// client-supplied tier name.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Gemma at Hacking Hub <siya@hackinghub.co.za>'; // update once a sending domain is verified in Resend
const ADMIN_ALERT_EMAIL = 'siya@hackinghub.co.za';
const PORTAL_URL = 'https://portal.hackinghub.co.za';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PERK_LABELS: Record<string, string> = {
  security_plus_discount: 'Discounted CompTIA Security+ voucher',
  azure_exam: 'Free Azure exam',
  elite_custom: 'Elite Operative sponsorship request',
};

// Same tier list/order as ALL_TIERS in MemberPortal.jsx.
const TIER_RANK: Record<string, number> = {
  'Basic Access': 1,
  'Monthly Operative': 2,
  'Permanent Access': 3,
  'Elite Operative': 4,
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

function requestEmailHtml(memberName: string, memberEmail: string, tierName: string, perkLabel: string, details: string | null): string {
  return `
    <p>${memberName} (${memberEmail}) just requested a sponsored perk on the Cert Calendar tab.</p>
    <p style="margin:18px 0;padding:16px 18px;border:1px solid #e2e2e2;border-radius:8px;">
      <strong>${perkLabel}</strong><br/>
      Current tier: ${tierName}
      ${details ? `<br/><br/>${details}` : ''}
    </p>
    <p style="margin:22px 0;">
      <a href="${PORTAL_URL}" style="display:inline-block;background:#17954f;color:#ffffff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Open Admin Dashboard</a>
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

    const { perkType, details } = await req.json();
    if (!PERK_LABELS[perkType]) {
      return new Response(JSON.stringify({ error: 'Unknown perk type.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (perkType === 'elite_custom' && !(details || '').trim()) {
      return new Response(JSON.stringify({ error: 'Describe what you\'re requesting.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Real tier, derived server-side from the caller's own actual payment
    // history - never trusted from the client. Same plan-name normalization
    // MemberPortal.jsx's own "My Subscription" tab uses (a PayFast-sourced
    // row's plan carries a "Hacking Hub - " prefix; an admin-recorded EFT
    // row doesn't).
    const { data: lastPaymentRows } = await callerClient.rpc('get_my_last_payment');
    const rawPlan: string = lastPaymentRows?.[0]?.plan || '';
    const tierName = rawPlan.replace(/^Hacking Hub - /, '');
    const tierRank = TIER_RANK[tierName] || 1;

    if (perkType === 'azure_exam' && tierRank < TIER_RANK['Permanent Access']) {
      return new Response(JSON.stringify({ error: 'Free Azure exams are a Permanent Access / Elite Operative benefit.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (perkType === 'elite_custom' && tierRank < TIER_RANK['Elite Operative']) {
      return new Response(JSON.stringify({ error: 'This is an Elite Operative benefit.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await adminClient
      .from('member_profiles')
      .select('full_name')
      .eq('email', callerEmail)
      .maybeSingle();
    const memberName = profile?.full_name || callerEmail;

    await sendEmail(
      resendKey,
      ADMIN_ALERT_EMAIL,
      `Perk request: ${PERK_LABELS[perkType]} - ${memberName}`,
      requestEmailHtml(memberName, callerEmail, tierName || 'Unknown', PERK_LABELS[perkType], perkType === 'elite_custom' ? (details || '').trim() : null)
    );

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('cert-perk-request-email error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
