-- Hacking Hub Admin Dashboard - Restrict Access to Community Contacts
-- Run this in the Supabase SQL Editor after 002-019 have already been applied.
--
-- Narrows real portal access to exactly two groups: the community contact
-- list (originally 73, since grown as new members joined) and the existing
-- pentest/test accounts from 012_pentest_access.sql. Every other
-- member_profiles row is left untouched EXCEPT the 38 real PayFast payers -
-- backfilled as 'Active' in 004_member_access_control.sql - who are not in
-- this contacts list; those are explicitly revoked below. This was confirmed
-- deliberately: those 38 people did pay at some point, but are being removed
-- from the allow-list on purpose as part of narrowing access to the current
-- community contact list.
--
-- full_name is left untouched on conflict for rows that already exist, so no
-- member's own self-edited directory profile gets overwritten by this import
-- (unlike 012_pentest_access.sql's upsert, which does overwrite full_name -
-- that's fine there since those are dedicated test accounts, not real members
-- who may have already personalized their profile).

INSERT INTO public.member_profiles (email, status, full_name)
VALUES
    ('akahopewell28@gmail.com', 'Active', 'Akahopewell28'),
    ('asandancube070@gmail.com', 'Active', 'Asandancube070'),
    ('awonkevintwembi@icloud.com', 'Active', 'Awonke Vintwembi'),
    ('bmemthimunye85@gmail.com', 'Active', 'Bmemthimunye85'),
    ('chiomaolebuike14@gmail.com', 'Active', 'Chiomaolebuike14'),
    ('clyde15sello@gmail.com', 'Active', 'Clyde15sello'),
    ('craigantonio919@gmail.com', 'Active', 'Craig Antonio'),
    ('cybersubz89@gmail.com', 'Active', 'Cybersubz89'),
    ('davidphiri242@gmail.com', 'Active', 'David Phiri'),
    ('dilemomolaoa@gmail.com', 'Active', 'Dilemomolaoa'),
    ('elricomhalo@gmail.com', 'Active', 'Elricomhalo'),
    ('eticostrading@gmail.com', 'Active', 'Eugene Hendricks'),
    ('fancymogale4@gmail.com', 'Active', 'Fancymogale4'),
    ('fortunatenkully@gmail.com', 'Active', 'Fortunatenkully'),
    ('fundilekunene@gmail.com', 'Active', 'Fundilekunene'),
    ('georgiabarnard388@gmail.com', 'Active', 'Georgiabarnard388'),
    ('gwativengawisdom@gmail.com', 'Active', 'Gwativengawisdom'),
    ('itshepelemorulane@gmail.com', 'Active', 'Itshepelemorulane'),
    ('jayjay13banda@gmail.com', 'Active', 'Jonathan Banda'),
    ('jessexavier2@gmail.com', 'Active', 'Jessexavier2'),
    ('jnrthemba@gmail.com', 'Active', 'Jnrthemba'),
    ('joel.ibazebo@outlook.com', 'Active', 'Joel.ibazebo'),
    ('joshuaharrop52@gmail.com', 'Active', 'Joshuaharrop52'),
    ('keotshepilem82@gmail.com', 'Active', 'Keotshepilem82'),
    ('khanyibathule@gmail.com', 'Active', 'Khanyibathule'),
    ('kharisanker16@gmail.com', 'Active', 'Kharisanker16'),
    ('kmchunu029@gmail.com', 'Active', 'Kmchunu029'),
    ('lesedincwana@gmail.com', 'Active', 'Lesedincwana'),
    ('lesegomaphosa12@gmail.com', 'Active', 'Lesegomaphosa12'),
    ('leshabelebese@gmail.com', 'Active', 'Palesa Lebese'),
    ('lesokotmonyepao@gmail.com', 'Active', 'Lesokotmonyepao'),
    ('lethabo-mokoma@protonmail.com', 'Active', 'Lethabo-mokoma'),
    ('letsoaramojalefa8@gmail.com', 'Active', 'Mojalefa'),
    ('louisanonhlanhla11@gmail.com', 'Active', 'Louisanonhlanhla11'),
    ('lungaka777@gmail.com', 'Active', 'Lungaka777'),
    ('luphawusiphumeze@gmail.com', 'Active', 'Luphawusiphumeze'),
    ('lutendo.muthala17@gmail.com', 'Active', 'Lutendo.muthala17'),
    ('mahlatsemalesela049@gmail.com', 'Active', 'Mahlatsemalesela049'),
    ('mahubephillie900@gmail.com', 'Active', 'Mahubephillie900'),
    ('malebonkuna04@gmail.com', 'Active', 'Malebonkuna04'),
    ('maso.ntlanga@gmail.com', 'Active', 'Maso.ntlanga'),
    ('mbulelobonanijm@gmail.com', 'Active', 'Mbulelobonanijm'),
    ('mimieportiadhladla@gmail.com', 'Active', 'Mimieportiadhladla'),
    ('molvercallum@gmail.com', 'Active', 'Molvercallum'),
    ('monenecmasekoameng@gmail.com', 'Active', 'Monenecmasekoameng'),
    ('motholobakang4@gmail.com', 'Active', 'Motholobakang4'),
    ('musa.ngobeni14@gmail.com', 'Active', 'Musa Ngobeni'),
    ('ndiambamba@gmail.com', 'Active', 'Ndiambamba'),
    ('nkosinathidhladhla77@gmail.com', 'Active', 'Nkosinathidhladhla77'),
    ('nokutshaya09@gmail.com', 'Active', 'Nokutshaya09'),
    ('nomondemoroeng17@gmail.com', 'Active', 'Nomondemoroeng17'),
    ('nonhlanhlakamangethe@gmail.com', 'Active', 'Nonhlanhla Zwane'),
    ('nonhlanhlasindane2003@gmail.com', 'Active', 'Nonhlanhlasindane2003'),
    ('olun.mohlomi@gmail.com', 'Active', 'Olun.mohlomi'),
    ('osimeleawandemkhize.73@gmail.com', 'Active', 'Osimeleawandemkhize.73'),
    ('p.themba3468@gmail.com', 'Active', 'P.themba3468'),
    ('pnyarukowa@gmail.com', 'Active', 'Pnyarukowa'),
    ('qhamani.rebe31@gmail.com', 'Active', 'Qhamani.rebe31'),
    ('reitumetsentai@gmail.com', 'Active', 'Reitumetsentai'),
    ('rorisangmarumolwa83@gmail.com', 'Active', 'Rorisangmarumolwa83'),
    ('sebogodio@icloud.com', 'Active', 'Sebogodio'),
    ('shokijhb@gmail.com', 'Active', 'Shokijhb'),
    ('sibotom.9803@gmail.com', 'Active', 'Sibotom.9803'),
    ('sivebatyi1@gmail.com', 'Active', 'Sivebatyi1'),
    ('siwaphiwehlazo@gmail.com', 'Active', 'Siwaphiwe Hlazo'),
    ('sizwezwane026@gmail.com', 'Active', 'Sizwezwane026'),
    ('sshabangu061@gmail.com', 'Active', 'Sshabangu061'),
    ('tebogonong3@gmail.com', 'Active', 'Tebogo Nong'),
    ('thakgalangmphaila@gmail.com', 'Active', 'Thakgalangmphaila'),
    ('thatopilusa97@gmail.com', 'Active', 'Thatopilusa97'),
    ('timothyadams3012002@gmail.com', 'Active', 'Timothyadams3012002'),
    ('tshepo.nchabeng36@gmail.com', 'Active', 'Tshepo.nchabeng36'),
    ('tshiamo878@gmail.com', 'Active', 'Nokulunga Aphane'),
    ('tshiamoseleki@gmail.com', 'Active', 'Tshiamoseleki'),
    ('tshireletsomoeti062@gmail.com', 'Active', 'Tshireletsomoeti062'),
    ('twala.ww@gmail.com', 'Active', 'Thando Twala'),
    ('ululamilemabunda@gmail.com', 'Active', 'Ululamilemabunda'),
    ('vanschalkwykjose64@gmail.com', 'Active', 'Jose van Schalkwyk'),
    ('wafs2damax@gmail.com', 'Active', 'Wafs2damax'),
    ('zanele.k.mpofu@gmail.com', 'Active', 'Zanele.k.mpofu'),
    ('zmatimu@gmail.com', 'Active', 'Matimu Ndhukwani')
ON CONFLICT (email) DO UPDATE SET status = 'Active';

-- Revoke the 38 real PayFast-paying members who are not in the contacts list
-- above and are not one of the pentest/test accounts (012_pentest_access.sql).
-- This is the deliberate, explicitly confirmed narrowing this migration exists
-- to do - is_member_allowed() (004_member_access_control.sql) treats 'Left'
-- exactly like never having had access at all.
UPDATE public.member_profiles SET status = 'Left'
WHERE email IN (
    'bokangngoetjana06@gmail.com',
    'ethan.cainboois@gmail.com',
    'ishmaeljr1922@gmail.com',
    'ishmaelmijr@gmail.com',
    'jngqobololo@gmail.com',
    'joelibazebo@gmail.com',
    'kamogeloommolawa@gmail.com',
    'keanuphathwa@gmail.com',
    'kgaugelo.sekulane@gmail.com',
    'lesedimoholoeng4@gmail.com',
    'lindzaybaatjes@gmail.com',
    'luyandanhlonipho79@gmail.com',
    'maimanelola@gmail.com',
    'marumolwarorisang690@gmail.com',
    'mokomalethabo@gmail.com',
    'mondliclementon7@gmail.com',
    'msimangokemton@gmail.com',
    'mthokozisisamson51@gmail.com',
    'musawethunkosi401@gmail.com',
    'mzimasi.sibande@gmail.com',
    'ndlazintsoareleng@gmail.com',
    'nonsikelelopretty94zuma@gmail.com',
    'nzuzondlovu147@gmail.com',
    'olebogengraphesu@gmail.com',
    'sashamartinndau@gmail.com',
    'tegranyota2004@gmail.com',
    'tendanisadiki2005@gmail.com',
    'thatoseekoei@gmail.com',
    'thobatsitl45@gmail.com',
    'tinyikob811@gmail.com',
    'tumelomahonono2@gmail.com',
    'yonela.mavunga@gmail.com',
    'zoeasiahpaulse@gmail.com',
    'zothilentshangase16@gmail.com'
);
