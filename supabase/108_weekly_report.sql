-- Hacking Hub Admin Dashboard - Monday Weekly Report
-- Run this in the Supabase SQL Editor after 002-107 have already been
-- applied, AFTER deploying the edge function:
--   supabase functions deploy weekly-report-email --no-verify-jwt
-- Safe to re-run: the function is replaced and the cron job is unscheduled
-- by name first.
--
-- One email to the founder (siya@hackinghub.co.za) every Monday at 06:00
-- SAST: members, money this month against last month, the month's revenue,
-- expense and net profit forecast, new joiners, this week's events and
-- exams, the competition, the sales pipeline, and a short to-do list.
--
-- get_weekly_report() gathers every figure in one call and is callable only
-- by the service role (the edge function), never by a signed-in member or
-- staff account: it returns revenue, money owed and prospect notes.
--
-- Money rules, so the email always agrees with itself:
--  - Revenue is gross PayFast (COMPLETE) plus recorded EFT (COMPLETE)
--    payments, by South African date. PayFast fees are reported separately,
--    never deducted.
--  - "To the same day" compares this month up to today with last month up
--    to the same day number (capped at last month's last day).
--  - Forecast revenue = already in this month + what each member who paid
--    last month paid then, if they have not paid yet this month. Members
--    marked Left or Leaving are left out. Active (Permanent) members who owe
--    nothing are left out; those still paying are capped at what they owe.
--    "Likely" scales that by the share of the month-before-last's payers who
--    paid again last month (collection_rate).
--  - Forecast expenses = logged this month + last month's costs not marked
--    one-off that have not been logged yet, matched by category and a shared
--    leading word. The matching runs in the edge function and mirrors
--    src/lib/financeForecast.js; this function just returns both months'
--    expenses.

CREATE OR REPLACE FUNCTION public.get_weekly_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_month_start DATE := date_trunc('month', (now() AT TIME ZONE 'Africa/Johannesburg'))::date;
  v_last_start DATE := (date_trunc('month', (now() AT TIME ZONE 'Africa/Johannesburg')) - interval '1 month')::date;
  v_prev2_start DATE := (date_trunc('month', (now() AT TIME ZONE 'Africa/Johannesburg')) - interval '2 months')::date;
  v_last_same_day DATE;
  -- "This week" is the 7 days from today: on the Monday send that is exactly
  -- Monday to Sunday, and a test send on any other day still looks ahead.
  v_week_start DATE := v_today;
  v_week_end DATE;
  v_result JSONB;
BEGIN
  v_week_end := v_week_start + 6;
  v_last_same_day := LEAST(v_last_start + (v_today - v_month_start), v_month_start - 1);

  WITH pay AS (
    SELECT lower(email) AS email, amount, (paid_at AT TIME ZONE 'Africa/Johannesburg')::date AS d, fee
    FROM public.payfast_transactions WHERE payment_status = 'COMPLETE'
    UNION ALL
    SELECT lower(email), amount, (date AT TIME ZONE 'Africa/Johannesburg')::date, 0
    FROM public.eft_payments WHERE status = 'COMPLETE'
  ),
  this_m AS (SELECT email, sum(amount) amt FROM pay WHERE d >= v_month_start AND d <= v_today GROUP BY 1),
  last_m AS (SELECT email, sum(amount) amt FROM pay WHERE d >= v_last_start AND d < v_month_start GROUP BY 1),
  prev2_m AS (SELECT email, sum(amount) amt FROM pay WHERE d >= v_prev2_start AND d < v_last_start GROUP BY 1),
  first_pay AS (SELECT email, min(d) AS first_d FROM pay GROUP BY 1),
  mp AS (SELECT lower(email) AS email, status, COALESCE(money_owed, 0) AS owed FROM public.member_profiles),
  bucketed AS (
    SELECT l.email, l.amt AS last_amt, m.status, COALESCE(m.owed, 0) AS owed,
      CASE
        WHEN m.status IS NULL OR m.status IN ('Left', 'Leaving') THEN 'lost'
        WHEN t.email IS NOT NULL THEN 'paid'
        WHEN m.status = 'Active (Permanent)' AND COALESCE(m.owed, 0) <= 0 THEN 'paid_up'
        ELSE 'due'
      END AS bucket
    FROM last_m l LEFT JOIN this_m t USING (email) LEFT JOIN mp m USING (email)
  ),
  rate AS (
    SELECT count(*) AS den, count(*) FILTER (WHERE l.email IS NOT NULL) AS num
    FROM prev2_m p
    LEFT JOIN last_m l USING (email)
    LEFT JOIN mp m USING (email)
    WHERE COALESCE(m.status, 'x') NOT IN ('Left', 'Leaving')
  )
  SELECT jsonb_build_object(
    'today', v_today,
    'week_start', v_week_start,
    'week_end', v_week_end,
    'month_start', v_month_start,
    'last_month_start', v_last_start,
    'last_same_day', v_last_same_day,

    'members', jsonb_build_object(
      'active', (SELECT count(*) FROM public.member_profiles WHERE status IN ('Active', 'Active (Permanent)')),
      'monthly', (SELECT count(*) FROM public.member_profiles WHERE status = 'Active'),
      'permanent', (SELECT count(*) FROM public.member_profiles WHERE status = 'Active (Permanent)'),
      'leaving', (SELECT count(*) FROM public.member_profiles WHERE status = 'Leaving'),
      'left_7d', (SELECT count(*) FROM public.member_profiles WHERE status = 'Left' AND left_at >= now() - interval '7 days'),
      'owed_total', (SELECT COALESCE(sum(money_owed), 0) FROM public.member_profiles WHERE money_owed > 0 AND status <> 'Left'),
      'owed_members', (SELECT count(*) FROM public.member_profiles WHERE money_owed > 0 AND status <> 'Left'),
      'new_7d', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', NULLIF(btrim(full_name), ''), 'start', s, 'track', NULLIF(roadmap_track, 'Not Assigned')) ORDER BY s DESC), '[]'::jsonb)
                 FROM (SELECT full_name, roadmap_track, COALESCE(manual_start_date, onboarded_at::date) AS s
                       FROM public.member_profiles
                       WHERE status IN ('Active', 'Active (Permanent)')
                         AND COALESCE(manual_start_date, onboarded_at::date) >= v_today - 7) n)
    ),

    'money', jsonb_build_object(
      'rev_this', (SELECT COALESCE(sum(amount), 0) FROM pay WHERE d >= v_month_start AND d <= v_today),
      'rev_last_same', (SELECT COALESCE(sum(amount), 0) FROM pay WHERE d >= v_last_start AND d <= v_last_same_day),
      'rev_last_full', (SELECT COALESCE(sum(amount), 0) FROM pay WHERE d >= v_last_start AND d < v_month_start),
      'rev_7d', (SELECT COALESCE(sum(amount), 0) FROM pay WHERE d > v_today - 7 AND d <= v_today),
      'payments_7d', (SELECT count(*) FROM pay WHERE d > v_today - 7 AND d <= v_today),
      'exp_this', (SELECT COALESCE(sum(amount), 0) FROM public.expenses WHERE expense_date >= v_month_start AND expense_date <= v_today),
      'exp_last_same', (SELECT COALESCE(sum(amount), 0) FROM public.expenses WHERE expense_date >= v_last_start AND expense_date <= v_last_same_day),
      'exp_last_full', (SELECT COALESCE(sum(amount), 0) FROM public.expenses WHERE expense_date >= v_last_start AND expense_date < v_month_start),
      'payfast_fees_this', (SELECT COALESCE(sum(fee), 0) FROM pay WHERE d >= v_month_start AND d <= v_today)
    ),

    'forecast', jsonb_build_object(
      'due_members', (SELECT count(*) FROM bucketed WHERE bucket = 'due'),
      'due_amount', (SELECT COALESCE(sum(CASE WHEN status = 'Active (Permanent)' THEN LEAST(last_amt, owed) ELSE last_amt END), 0) FROM bucketed WHERE bucket = 'due'),
      'rate_num', (SELECT num FROM rate),
      'rate_den', (SELECT den FROM rate),
      'leavers', (SELECT count(*) FROM bucketed WHERE bucket = 'lost' AND status IS NOT NULL),
      'leavers_amount', (SELECT COALESCE(sum(last_amt), 0) FROM bucketed WHERE bucket = 'lost' AND status IS NOT NULL),
      'first_payers', (SELECT count(*) FROM this_m t JOIN first_pay f USING (email) WHERE f.first_d >= v_month_start),
      'first_payers_amount', (SELECT COALESCE(sum(t.amt), 0) FROM this_m t JOIN first_pay f USING (email) WHERE f.first_d >= v_month_start)
    ),

    'expenses', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'category', category, 'description', description, 'amount', amount, 'date', expense_date, 'isOneOff', is_one_off)), '[]'::jsonb)
                 FROM public.expenses WHERE expense_date >= v_last_start AND expense_date <= v_today),

    'events', (SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'time', time, 'title', title, 'type', type, 'location', location, 'presenter', presenter) ORDER BY date), '[]'::jsonb)
               FROM public.community_events WHERE status = 'Approved' AND date BETWEEN v_today AND v_today + 14),
    'sunday_catchups', (SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date, 'time', time, 'title', title, 'presenter', presenter) ORDER BY date), '[]'::jsonb)
                        FROM public.community_events WHERE type = 'Sunday Catchup' AND status = 'Approved' AND date BETWEEN v_week_start AND v_week_end),

    'exams_this_week', (SELECT COALESCE(jsonb_agg(jsonb_build_object('member', member, 'cert', cert_name, 'date', date) ORDER BY date, member), '[]'::jsonb)
                        FROM public.cert_calendar WHERE date BETWEEN v_week_start AND v_week_end),
    'exams_next_week', (SELECT COALESCE(jsonb_agg(jsonb_build_object('member', member, 'cert', cert_name, 'date', date) ORDER BY date, member), '[]'::jsonb)
                        FROM public.cert_calendar WHERE date BETWEEN v_week_end + 1 AND v_week_end + 7),
    'results_last_week', (SELECT COALESCE(jsonb_agg(jsonb_build_object('member', member, 'cert', cert_name, 'date', date, 'result', result) ORDER BY date, member), '[]'::jsonb)
                          FROM public.cert_calendar WHERE date BETWEEN v_week_start - 7 AND v_week_start - 1),

    'competition', (SELECT jsonb_build_object('title', title, 'end_date', end_date, 'ended', end_date < v_today) FROM public.competitions WHERE is_current LIMIT 1),
    'competition_top5', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', member_name, 'rooms', rooms_completed) ORDER BY rooms_completed DESC), '[]'::jsonb)
                         FROM (SELECT member_name, rooms_completed FROM public.competition_standings WHERE NOT opted_out ORDER BY rooms_completed DESC LIMIT 5) c),

    'pipeline_counts', (SELECT COALESCE(jsonb_object_agg(phase, n), '{}'::jsonb) FROM (SELECT phase, count(*) n FROM public.pipeline_prospects GROUP BY 1) p),
    'pipeline_hot', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', full_name, 'phase', phase, 'source', source, 'note', left(split_part(COALESCE(notes, ''), E'\n', 1), 140)) ORDER BY CASE phase WHEN 'Ready to Join' THEN 0 ELSE 1 END, updated_at DESC), '[]'::jsonb)
                     FROM public.pipeline_prospects WHERE phase IN ('Ready to Join', 'Interested')),

    'merch_to_fulfil', (SELECT count(*) FROM public.merch_orders WHERE status IN ('Paid', 'Needs Review')),
    'wins_7d', (SELECT count(*) FROM public.community_wins WHERE created_at >= now() - interval '7 days')
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_weekly_report() FROM PUBLIC, anon, authenticated;

-- Every Monday at 04:00 UTC = 06:00 SAST. Same template trick as
-- 092_accountability_digest_cron.sql: the job's command is built from the
-- already-scheduled overdue-1on1-digest-daily job, with only the function
-- name swapped, so the cron secret is reused and never pasted here.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_template TEXT;
BEGIN
  SELECT command INTO v_template FROM cron.job WHERE jobname = 'overdue-1on1-digest-daily';
  IF v_template IS NULL OR position('/functions/v1/overdue-1on1-digest' in v_template) = 0 THEN
    RAISE EXCEPTION 'overdue-1on1-digest-daily cron job not found (or its URL changed) - schedule 072 first, or write this job by hand.';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-report-monday') THEN
    PERFORM cron.unschedule('weekly-report-monday');
  END IF;

  PERFORM cron.schedule(
    'weekly-report-monday',
    '0 4 * * 1', -- 04:00 UTC every Monday = 06:00 SAST
    replace(v_template, '/functions/v1/overdue-1on1-digest', '/functions/v1/weekly-report-email')
  );
END $$;
