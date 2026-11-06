-- YRITYS_YHTEYSHENKILOT: UNIIKKIRAJOITE (avain, email)
--
-- Taululta puuttuu rajoite, johon `onConflict: "avain,email"` viittaa.
-- Supabase vastaa siksi virheella
--
--   there is no unique or exclusion constraint matching the
--   ON CONFLICT specification
--
-- ja molemmat kirjoittavat skriptit putoavat varareitille, joka tekee
-- suoran INSERTin:
--
--   scripts/kokoa-yritysrekisteri.ts
--   scripts/lisaa-louhintahiekan-tyopaallikot.ts
--
-- Seuraus: skriptin UUDELLEENAJO kahdentaa jokaisen rivin. Nakyma ei
-- paljasta sita, koska `yrityksenHenkilot` yhdistaa saman ihmisen
-- sahkopostin perusteella -- rivit kertyvat vain tauluun.
--
-- Rajoite koskee vain rivia jolla ON sahkoposti: 21/171 rivia on ilman
-- (6.11.2026), ja niille sama ihminen voi esiintya kahdesti eri
-- lahteella. Siksi OSITTAINEN indeksi.
--
-- Tarkistettu 6.11.2026: kahdentuneita (avain + lower(email)) on 0,
-- joten indeksi voidaan luoda sellaisenaan.
--
-- Tarkista ensin ettei kahdentuneita ole (pitaa palauttaa 0 rivia):
--
--   select avain, lower(email) as e, count(*)
--   from yritys_yhteyshenkilot
--   where email is not null
--   group by 1, 2
--   having count(*) > 1;

create unique index if not exists yritys_yhteyshenkilot_avain_email_uniikki
  on yritys_yhteyshenkilot (avain, lower(email))
  where email is not null;

-- Taman jalkeen skriptien `upsert` toimii eika varareittia tarvita.
-- HUOM: osittainen indeksi EI kelpaa `onConflict: "avain,email"`
-- -kutsuun sellaisenaan, koska lauseke on `lower(email)`. Skriptien
-- oma olemassaolotarkistus (lue ensin, paivita tai lisaa) toimii
-- kumminkin ja on jo kaytossa
-- `lisaa-louhintahiekan-tyopaallikot.ts`:ssa.
