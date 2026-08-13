-- Hacking Hub Admin Dashboard - Restrict Access to Community Contacts
-- Run this in the Supabase SQL Editor after 002-019 have already been applied.
--
-- Narrows real portal access to exactly two groups: the 73 email addresses in
-- the "Hacking Hub" Google Contacts label (the current, deliberately curated
-- community list) and the existing pentest/test accounts from
-- 012_pentest_access.sql. Every other member_profiles row is left untouched
-- EXCEPT the 38 real PayFast payers - backfilled as 'Active' in
-- 004_member_access_control.sql - who are not in this contacts list; those
-- are explicitly revoked below. This was confirmed deliberately: those 38
-- people did pay at some point, but are being removed from the allow-list on
-- purpose as part of narrowing access to the current community contact list.
--
-- full_name is left untouched on conflict for rows that already exist, so no
-- member's own self-edited directory profile gets overwritten by this import
-- (unlike 012_pentest_access.sql's upsert, which does overwrite full_name -
-- that's fine there since those are dedicated test accounts, not real members
-- who may have already personalized their profile).

INSERT INTO public.member_profiles (email, status, full_name)
VALUES
    ('[REDACTED]', 'Active', 'Akahopewell28'),
    ('[REDACTED]', 'Active', 'Asandancube070'),
    ('[REDACTED]', 'Active', 'Bmemthimunye85'),
    ('[REDACTED]', 'Active', 'Chiomaolebuike14'),
    ('[REDACTED]', 'Active', 'Clyde15sello'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Cybersubz89'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Dilemomolaoa'),
    ('[REDACTED]', 'Active', 'Elricomhalo'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Fancymogale4'),
    ('[REDACTED]', 'Active', 'Fortunatenkully'),
    ('[REDACTED]', 'Active', 'Fundilekunene'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Gwativengawisdom'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Jessexavier2'),
    ('[REDACTED]', 'Active', 'Jnrthemba'),
    ('[REDACTED]', 'Active', 'Joel.ibazebo'),
    ('[REDACTED]', 'Active', 'Joshuaharrop52'),
    ('[REDACTED]', 'Active', 'Keotshepilem82'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Kharisanker16'),
    ('kmchunu029@gmail.com', 'Active', 'Kmchunu029'),
    ('[REDACTED]', 'Active', 'Lesedincwana'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Lethabo-mokoma'),
    ('[REDACTED]', 'Active', 'Mojalefa'),
    ('[REDACTED]', 'Active', 'Lungaka777'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Lutendo.muthala17'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Mahubephillie900'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Maso.ntlanga'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Mimieportiadhladla'),
    ('[REDACTED]', 'Active', 'Molvercallum'),
    ('[REDACTED]', 'Active', 'Monenecmasekoameng'),
    ('[REDACTED]', 'Active', 'Ndiambamba'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Nokutshaya09'),
    ('[REDACTED]', 'Active', 'Nomondemoroeng17'),
    ('nonhlanhlakamangethe@gmail.com', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Nonhlanhlasindane2003'),
    ('[REDACTED]', 'Active', 'Olun.mohlomi'),
    ('[REDACTED]', 'Active', 'Osimeleawandemkhize.73'),
    ('[REDACTED]', 'Active', 'P.themba3468'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Qhamani.rebe31'),
    ('[REDACTED]', 'Active', 'Reitumetsentai'),
    ('[REDACTED]', 'Active', 'Rorisangmarumolwa83'),
    ('[REDACTED]', 'Active', 'Sebogodio'),
    ('[REDACTED]', 'Active', 'Sibotom.9803'),
    ('[REDACTED]', 'Active', 'Sivebatyi1'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Sizwezwane026'),
    ('[REDACTED]', 'Active', 'Sshabangu061'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Thakgalangmphaila'),
    ('[REDACTED]', 'Active', 'Thatopilusa97'),
    ('[REDACTED]', 'Active', 'Timothyadams3012002'),
    ('[REDACTED]', 'Active', 'Tshepo.nchabeng36'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Tshiamoseleki'),
    ('[REDACTED]', 'Active', 'Ululamilemabunda'),
    ('[REDACTED]', 'Active', '[REDACTED]'),
    ('[REDACTED]', 'Active', 'Wafs2damax'),
    ('[REDACTED]', 'Active', 'Zanele.k.mpofu'),
    ('[REDACTED]', 'Active', '[REDACTED]')
ON CONFLICT (email) DO UPDATE SET status = 'Active';

-- Revoke the 38 real PayFast-paying members who are not in the contacts list
-- above and are not one of the pentest/test accounts (012_pentest_access.sql).
-- This is the deliberate, explicitly confirmed narrowing this migration exists
-- to do - is_member_allowed() (004_member_access_control.sql) treats 'Left'
-- exactly like never having had access at all.
UPDATE public.member_profiles SET status = 'Left'
WHERE email IN (
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]',
    '[REDACTED]'
);
