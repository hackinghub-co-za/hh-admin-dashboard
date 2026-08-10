-- Hacking Hub Admin Dashboard - Member Sign-In Access Control
-- Run this in the Supabase SQL Editor after 002_member_persistence.sql and
-- 003_job_placed_date.sql have already been applied.
--
-- Problem: sign-in currently has no membership check at all - any Google account can
-- sign in and land in the Member Portal, and there's no way to actually revoke access
-- when someone leaves the community (only an admin-facing "Left" label).
--
-- Fix: a single SECURITY DEFINER function the app calls at sign-in. It treats
-- member_profiles as the allow-list - no row for that email, or a row marked 'Left',
-- means access is denied. It bypasses RLS internally (same pattern as is_admin() in
-- 002_member_persistence.sql) but only ever returns a boolean, never row data, so it's
-- safe to expose to any authenticated or anonymous caller.

-- =========================================================================
-- PART 1: THE ACCESS-CONTROL FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_member_allowed(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    check_email ILIKE '%@hackinghub.co.za'  -- admins are always allowed
    OR EXISTS (
      SELECT 1 FROM public.member_profiles
      WHERE email = lower(check_email) AND status != 'Left'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_member_allowed(TEXT) TO anon, authenticated;

-- =========================================================================
-- PART 2: BACKFILL - give every real member a row so the allow-list actually
-- includes them. Only members an admin has already opened/saved in the UI have a
-- member_profiles row today; this adds the rest of the 81 real PayFast payers
-- (from src/data/payfastTransactions.json) as 'Active', without ever overwriting a
-- row an admin has already edited.
-- =========================================================================

INSERT INTO public.member_profiles (email, status)
VALUES
    ('akahopewell28@gmail.com', 'Active'),
    ('awonkevintwembi@icloud.com', 'Active'),
    ('bokangngoetjana06@gmail.com', 'Active'),
    ('craigantonio919@gmail.com', 'Active'),
    ('davidphiri242@gmail.com', 'Active'),
    ('elricomhalo@gmail.com', 'Active'),
    ('ethan.cainboois@gmail.com', 'Active'),
    ('fancymogale4@gmail.com', 'Active'),
    ('georgiabarnard388@gmail.com', 'Active'),
    ('gwativengawisdom@gmail.com', 'Active'),
    ('ishmaeljr1922@gmail.com', 'Active'),
    ('ishmaelmijr@gmail.com', 'Active'),
    ('itshepelemorulane@gmail.com', 'Active'),
    ('jayjay13banda@gmail.com', 'Active'),
    ('jngqobololo@gmail.com', 'Active'),
    ('jnrthemba@gmail.com', 'Active'),
    ('joel.ibazebo@outlook.com', 'Active'),
    ('joelibazebo@gmail.com', 'Active'),
    ('kamogeloommolawa@gmail.com', 'Active'),
    ('keanuphathwa@gmail.com', 'Active'),
    ('kgaugelo.sekulane@gmail.com', 'Active'),
    ('khanyibathule@gmail.com', 'Active'),
    ('lesedimoholoeng4@gmail.com', 'Active'),
    ('lesedincwana@gmail.com', 'Active'),
    ('leshabelebese@gmail.com', 'Active'),
    ('lesokotmonyepao@gmail.com', 'Active'),
    ('lethabo-mokoma@protonmail.com', 'Active'),
    ('letsoaramojalefa8@gmail.com', 'Active'),
    ('lindzaybaatjes@gmail.com', 'Active'),
    ('lungaka777@gmail.com', 'Active'),
    ('luphawusiphumeze@gmail.com', 'Active'),
    ('luyandanhlonipho79@gmail.com', 'Active'),
    ('mahlatsemalesela049@gmail.com', 'Active'),
    ('maimanelola@gmail.com', 'Active'),
    ('malebonkuna04@gmail.com', 'Active'),
    ('marumolwarorisang690@gmail.com', 'Active'),
    ('maso.ntlanga@gmail.com', 'Active'),
    ('mbulelobonanijm@gmail.com', 'Active'),
    ('mokomalethabo@gmail.com', 'Active'),
    ('molvercallum@gmail.com', 'Active'),
    ('mondliclementon7@gmail.com', 'Active'),
    ('monenecmasekoameng@gmail.com', 'Active'),
    ('msimangokemton@gmail.com', 'Active'),
    ('mthokozisisamson51@gmail.com', 'Active'),
    ('musa.ngobeni14@gmail.com', 'Active'),
    ('musawethunkosi401@gmail.com', 'Active'),
    ('mzimasi.sibande@gmail.com', 'Active'),
    ('ndiambamba@gmail.com', 'Active'),
    ('ndlazintsoareleng@gmail.com', 'Active'),
    ('nkosinathidhladhla77@gmail.com', 'Active'),
    ('nokutshaya09@gmail.com', 'Active'),
    ('nonhlanhlasindane2003@gmail.com', 'Active'),
    ('nonsikelelopretty94zuma@gmail.com', 'Active'),
    ('nzuzondlovu147@gmail.com', 'Active'),
    ('olebogengraphesu@gmail.com', 'Active'),
    ('olun.mohlomi@gmail.com', 'Active'),
    ('pnyarukowa@gmail.com', 'Active'),
    ('qhamani.rebe31@gmail.com', 'Active'),
    ('rorisangmarumolwa83@gmail.com', 'Active'),
    ('sashamartinndau@gmail.com', 'Active'),
    ('sebogodio@icloud.com', 'Active'),
    ('shokijhb@gmail.com', 'Active'),
    ('sibotom.9803@gmail.com', 'Active'),
    ('sivebatyi1@gmail.com', 'Active'),
    ('siwaphiwehlazo@gmail.com', 'Active'),
    ('sshabangu061@gmail.com', 'Active'),
    ('tegranyota2004@gmail.com', 'Active'),
    ('tendanisadiki2005@gmail.com', 'Active'),
    ('thakgalangmphaila@gmail.com', 'Active'),
    ('thatoseekoei@gmail.com', 'Active'),
    ('thobatsitl45@gmail.com', 'Active'),
    ('timothyadams3012002@gmail.com', 'Active'),
    ('tinyikob811@gmail.com', 'Active'),
    ('tshiamoseleki@gmail.com', 'Active'),
    ('tumelomahonono2@gmail.com', 'Active'),
    ('twala.ww@gmail.com', 'Active'),
    ('ululamilemabunda@gmail.com', 'Active'),
    ('vanschalkwykjose64@gmail.com', 'Active'),
    ('yonela.mavunga@gmail.com', 'Active'),
    ('zoeasiahpaulse@gmail.com', 'Active'),
    ('zothilentshangase16@gmail.com', 'Active')
ON CONFLICT (email) DO NOTHING;
