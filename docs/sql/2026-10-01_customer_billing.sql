-- MAKSAVAT ASIAKKAAT JA KUUKAUSIHINTA (D-223)
--
-- Aja tama Supabasen SQL-editorissa. Ohjelmallista DDL:aa ei ole.
--
-- AVAIN ON ASIAKAS, EI TUNNUS. Hinta on yrityskohtainen (Johannes
-- 1.10.2026), ja mitattu 1.10.2026 (`scripts/measure-asiakasdomainit.ts`):
-- 113 asiakastunnusta jakautuu 75 asiakkaaseen, ja viidella yrityksella
-- on useita tunnuksia -- Sarlin 12, Koneunion 13, Nostokonepalvelu 4,
-- Etuputsarit 3, Awaregroup 2. Jos hinta olisi tunnuksella, Sarlin
-- laskettaisiin MRR:aan kaksitoista kertaa.
--
-- TUNNISTE ON DOMAIN TAI SAHKOPOSTI. Domain kelpaa yrityksen
-- tunnisteeksi 73 tapauksessa 75:sta. Vapaat sahkopostit eivat kelpaa:
-- 11 tunnusta on gmailissa tai hotmailissa, ja kaksi eri asiakasta
-- gmailissa olisi domainilla sama "yritys". Siksi vapaan sahkopostin
-- kayttaja tunnistetaan koko osoitteella. Jako tehdaan koodissa
-- (`lib/users/asiakastunniste.ts`), tama taulu ottaa vastaan kumman
-- tahansa muodon.

create table if not exists public.customer_billing (
  -- "sarlin.com" tai "matti.meikalainen@gmail.com", aina pienilla.
  tunniste text primary key,

  -- maksava   = laskutetaan, kuukausihinta kuuluu MRR:aan
  -- testi     = oma tai kumppanin testitunnus, ei nay asiakasluvuissa
  -- ei_maksava= tunnettu asiakas joka ei maksa (kokeilu, ilmaiskaytto)
  tila text not null default 'maksava'
    check (tila in ('maksava', 'testi', 'ei_maksava')),

  -- Kuukausihinta euroina. Kaikki maksavat kuukausihintaa, joten
  -- laskutusjaksoa ei tarvita (Johannes 1.10.2026).
  kuukausihinta_eur numeric(10, 2) check (kuukausihinta_eur >= 0),

  alkaen date,
  huomio text,
  updated_at timestamptz not null default now()
);

-- Maksavalla pitaa olla hinta, muuten MRR on hiljaa vajaa. Tyhja hinta
-- on sallittu vain kun asiakas ei maksa.
alter table public.customer_billing
  drop constraint if exists customer_billing_maksavalla_hinta;

alter table public.customer_billing
  add constraint customer_billing_maksavalla_hinta
  check (tila <> 'maksava' or kuukausihinta_eur is not null);

-- Vain palvelinreitti (service role) lukee ja kirjoittaa. Hinnat ovat
-- liiketoimintatietoa, eika niiden kuulu nakya asiakkaalle lainkaan.
-- Ilman tata taulu olisi auki anon-avaimelle (vrt. 2026-07-30).
alter table public.customer_billing enable row level security;
revoke all on public.customer_billing from anon, authenticated;

-- Koneunionin tunnukset ovat testikayttajia (Johannes 1.10.2026).
-- Yksi rivi kattaa kaikki 13 tunnusta.
insert into public.customer_billing (tunniste, tila, huomio)
values ('koneunion.fi', 'testi', 'Testikayttajat')
on conflict (tunniste) do nothing;

-- Tarkistus:
--   select tunniste, tila, kuukausihinta_eur, updated_at
--   from public.customer_billing
--   order by tila, tunniste;
