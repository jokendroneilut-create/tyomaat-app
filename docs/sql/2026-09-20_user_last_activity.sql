-- Milloin kayttaja viimeksi KAVI palvelussa (ei: kirjautui).
--
-- TAUSTA (D-204). Kayttajalistan "Viimeksi kirjautunut" tulee
-- auth.users.last_sign_in_at -kentasta, jota Supabase paivittaa vain
-- oikeasta kirjautumisesta. Istunto sailyy evasteessa yli viikon, joten
-- asiakas kayttaa tuotetta ilman etta kentta liikkuu. Mitattu
-- 20.9.2026: 48 asiakastunnuksesta 16 oli kaynyt MYOHEMMIN kuin oli
-- kirjautunut, yhdeksalla ero yli 7 vrk ja suurin ero 115 vrk.
-- Sarakkeen mukaan jarjestetty "kuka kavi viimeksi" -lista oli siis
-- vaarassa jarjestyksessa: kaksi tuoreinta kavijaa ei nakynyt edes
-- 12 karjessa.
--
-- MIKSI NAKYMA EIKA SARAKE. analytics_events-taulussa on 43 243 rivia
-- (20.9.2026) ja se kasvaa noin 16 000 rivilla kuukaudessa. Viimeisimman
-- tapahtuman selvittaminen sivulatauksen yhteydessa tarkoittaisi taulun
-- selaamista sivu kerrallaan (16 kyselya pelkalta 30 vrk jaksolta).
-- Nakyma tekee saman yhdella aggregaatilla ja palauttaa noin sata rivia.
-- Denormalisoitu sarake profiles-taulussa olisi nopeampi mutta vaatisi
-- kirjoituksen jokaisesta tapahtumasta - kaksi totuutta samasta asiasta.
--
-- TUNNISTEETON RIVI EI KELPAA. Tunnuksen poisto nollaa sen vanhat rivit
-- (ON DELETE SET NULL, ks. D-184), joten user_id is null suodatetaan
-- pois - muuten poistettujen tunnusten tapahtumat ryhmittyisivat yhdeksi
-- olemattomaksi kayttajaksi.

create or replace view public.user_last_activity as
  select
    user_id,
    max(created_at) as last_seen_at,
    count(*)        as events
  from public.analytics_events
  where user_id is not null
  group by user_id;

-- Nakyma ajetaan kutsujan oikeuksilla, ei omistajan. Ilman tata
-- nakyma ohittaisi analytics_events-taulun RLS:n (vrt. 2026-07-30).
alter view public.user_last_activity set (security_invoker = on);

-- Vain palvelinreitti (service role) lukee taman. Kayttajan ei kuulu
-- nahda muiden kayttokertoja.
revoke all on public.user_last_activity from anon, authenticated;

-- Aggregaatti kayttaa tata; ilman indeksia se on sekannus koko taulusta.
create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc);

-- Tarkistus:
--   select count(*) as tunnuksia,
--          max(last_seen_at) as tuorein
--   from public.user_last_activity;
