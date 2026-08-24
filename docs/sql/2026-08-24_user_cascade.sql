-- 2026-08-24 — Poistetun tunnuksen jaljet siivoutuvat mukana.
-- Aja Supabasen SQL-editorissa.
--
-- SYY. Yllapidon poistotoiminto ei siivoa itse mitaan: se kirjaa
-- elinkaaren ja kutsuu auth.admin.deleteUser. Kaikki muu nojaa
-- tietokannan cascade-saantoihin. Mitattu 24.8.2026:
--
--                            orpokayttajia   orporiveja
--   user_today_preferences          7                7
--   user_project_status             6               58
--   opportunity_alerts              3              186
--
--   HUOM: kayttajia ja riveja ei saa sekoittaa. Yhdella kayttajalla on
--   monta hankemerkintaa ja monta halytysta, joten rivimaara on lahes
--   kymmenkertainen. Yhteensa 251 rivia.
--
--   Kunnossa jo ennestaan: saved_searches, team_members,
--   project_feedback (CASCADE) ja analytics_events (SET NULL — tapahtuma
--   sailyy tilastossa, henkiloyhteys katkeaa).
--
-- Naista kolmesta PUUTTUI kayttajaviite kokonaan (tarkistettu
-- information_schemasta: ainoa viiteavain oli
-- opportunity_alerts.project_id -> projects). Cascade ei siis voinut
-- toimia — mitaan ei ollut rikki, saanto puuttui.
--
-- VAIKUTUS. Tyotilaisuushalytys kavi joka ajolla lapi seitseman kuollutta
-- kayttajaa ja teki niille turhan getUserById-kutsun. Kuolleet nakyivat
-- myos usersMatched-luvussa: 24.8. esikatselu naytti 9 vaikka
-- vastaanottajia oli 8. Vaaraa viestia ei lahtenyt, koska osoitteeton
-- ohitetaan.
--
-- Isompi kysymys on tietosuoja: poistetun kayttajan hakuasetukset ja
-- hankemerkinnat jaivat kantaan toistaiseksi, vaikka koodin kommentti
-- lupasi ettei tunnuksesta jaa mitaan.
--
-- JARJESTYS ON PAKOLLINEN: orvot on poistettava ennen rajoitteen
-- lisaamista, muuten alter table kaatuu olemassa oleviin riveihin.


-- 0) KATSO ENSIN. Aja tama yksin ja lue luvut ennen kuin jatkat.
--
--   select 'user_today_preferences' as taulu, count(*) from public.user_today_preferences p
--     where not exists (select 1 from auth.users u where u.id = p.user_id)
--   union all
--   select 'user_project_status', count(*) from public.user_project_status s
--     where not exists (select 1 from auth.users u where u.id = s.user_id)
--   union all
--   select 'opportunity_alerts', count(*) from public.opportunity_alerts a
--     where not exists (select 1 from auth.users u where u.id = a.user_id);


-- 1) Orvot pois. Nama kuuluvat tunnuksille joita ei ole enaa olemassa.
delete from public.user_today_preferences p
 where not exists (select 1 from auth.users u where u.id = p.user_id);

delete from public.user_project_status s
 where not exists (select 1 from auth.users u where u.id = s.user_id);

delete from public.opportunity_alerts a
 where not exists (select 1 from auth.users u where u.id = a.user_id);


-- 2) Saanto, jotta tama ei toistu. Koskee mita tahansa poistotapaa —
--    myos suoraan Supabasen hallintanakymasta tehtya.
alter table public.user_today_preferences
  add constraint user_today_preferences_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.user_project_status
  add constraint user_project_status_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.opportunity_alerts
  add constraint opportunity_alerts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;


-- VARMISTUS. Kolmen rivin pitaa nyt loytya, delete_rule = CASCADE:
--
--   select tc.table_name, tc.constraint_name, rc.delete_rule
--   from information_schema.table_constraints tc
--   join information_schema.referential_constraints rc
--     on rc.constraint_name = tc.constraint_name
--    and rc.constraint_schema = tc.constraint_schema
--   where tc.constraint_type = 'FOREIGN KEY'
--     and tc.table_schema = 'public'
--     and tc.constraint_name like '%user_id_fkey';
--
-- account_lifecycle EI KUULU TAHAN — EIKA SILLE SAA LISATA CASCADEA.
--
-- Se on tarkoituksella ainoa taulu johon poistetun tunnuksen tiedot
-- JAAVAT: kuka kayttaja oli, milloin tili luotiin ja milloin poistettiin.
-- Ilman sita ei voisi vuoden paasta sanoa montako tunnusta on kaikkiaan
-- luotu, koska tieto katoaisi jokaisen poiston mukana (D-069).
--
-- Vierasavain auth.usersiin ON DELETE CASCADE pyyhkisi historian
-- tasmalleen silloin kun sita tarvitaan. Siksi taululla ei ole
-- vierasavainta lainkaan, ja poisto on lisaksi estetty triggerilla
-- (RLS ei riittaisi, koska service role ohittaa sen).
--
-- Tama ei ole teoriaa: 24.8.2026 poistetun kayttajan henkilollisyys
-- (veli@nordraudoitus.fi, poistettu 23.8.) selvisi nimenomaan tasta
-- taulusta, kun auth.users ja profiles olivat jo tyhjia.
--
-- Muokkaus on sallittu: sahkoposti ja nimi saa nollata poistopyynnon
-- yhteydessa, jolloin merkinta ja paivamaara jaavat ilman henkilotietoa.
--
-- UUSI TAULU, JOSSA ON user_id: lisaa sille sama cascade heti, ELLEI
-- taulun tarkoitus ole sailyttaa historiaa poiston yli. Poisto ei
-- huomaa puuttuvaa cascadea mitenkaan — jaljet vain jaavat hiljaa.
