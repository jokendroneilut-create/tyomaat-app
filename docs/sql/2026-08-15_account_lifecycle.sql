-- Tilien elinkaari: pysyva loki joka sailyy vaikka tunnus poistetaan.
--
-- MIKSI.
-- Tanaan tilista ei jaa mitaan jaljelle jos se poistetaan:
-- /api/admin/delete-user kutsuu supabase.auth.admin.deleteUser(userId)
-- ilman pehmeaa poistoa, eli rivi katoaa lopullisesti. Silloin katoaa
-- myos tieto siita etta tili oli olemassa - mihin kohorttiin se kuului,
-- milloin se luotiin, konvertoituiko se. Kannassa ei myoskaan ole
-- lainkaan trial- tai tilaustietoa (tarkistettu 15.8.2026: 36 taulua,
-- ei subscriptions/plans/trials/customers).
--
-- SUUNNITTELUPERIAATTEET.
--
-- 1. EI VIERASAVAINTA auth.users-tauluun. Vierasavain ON DELETE CASCADE
--    pyyhkisi historian samalla kun tunnus poistetaan - eli tekisi
--    tasmalleen sen mita talla taululla yritetaan estaa. user_id on
--    tavallinen uuid-sarake.
--
-- 2. VAIN LISAYKSIA. Rivia ei paiviteta eika poisteta. Tila luetaan
--    tapahtumien jonosta, kuten analytics_events-taulussa.
--
-- 3. MIKAAN OLEMASSA OLEVA EI RIIPU TASTA. Ei triggereita, ei
--    muutoksia nykyisiin tauluihin, ei koodipolkuja jotka kaatuisivat
--    jos taulu puuttuu. Taman voi ajaa ja jattaa kayttamatta.
--
-- 4. RLS PAALLE ILMAN POLICYJA. Vain service role paasee kasiksi.
--    Ilman tata taulu olisi auki anon-avaimelle - sama vika joka
--    loytyi 16 taulusta 30.7.2026.

create table if not exists public.account_lifecycle (
  id uuid primary key default gen_random_uuid(),

  -- Ei vierasavainta: tunnus voi olla jo poistettu.
  user_id uuid not null,

  -- Tunnistetiedot talletetaan, jotta poistettu tili on yha
  -- tunnistettavissa myynnissa. Nama saa nollata GDPR:n
  -- poistopyynnon yhteydessa - rivi ja aikaleimat jaavat, jolloin
  -- kohortti- ja konversioluvut sailyvat ilman henkilotietoa.
  email text,
  full_name text,

  -- created | trial_started | trial_ended | converted | cancelled | deleted
  event text not null,

  -- Milloin tapahtuma tapahtui (ei milloin se kirjattiin).
  occurred_at timestamptz not null default now(),

  -- Vapaa lisatieto: myyja, kanava, hinta, syy.
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Sama tapahtuma samalle tilille vain kerran. Tekee taydennyksesta
-- idempotentin: skriptin voi ajaa uudelleen ilman duplikaatteja.
create unique index if not exists account_lifecycle_user_event_uniq
  on public.account_lifecycle (user_id, event);

create index if not exists account_lifecycle_user_idx
  on public.account_lifecycle (user_id);

create index if not exists account_lifecycle_occurred_idx
  on public.account_lifecycle (occurred_at);

alter table public.account_lifecycle enable row level security;

-- Policyja ei luoda tarkoituksella: vain service role saa lukea ja
-- kirjoittaa. Jos tama joskus tarvitaan kayttoliittymaan, lisaa
-- policy erikseen ja harkiten.

comment on table public.account_lifecycle is
  'Tilien elinkaaritapahtumat. Vain lisayksia. Ei vierasavainta auth.users-tauluun, jotta historia sailyy tunnuksen poiston jalkeen.';
