-- Kuka myyja hankki minka asiakkaan.
--
-- MIKSI.
--
-- Myyjanakyma nayttaa vain myyjan omat asiakkaat. Ilman tata tietoa
-- rajausta ei voi tehda, ja rajaus on koko nakyman tarkoitus: myyja ei
-- saa nahda muiden asiakkaita.
--
-- Admin liittaa asiakkaan myyjalle kasin. Vaihtoehto olisi ollut
-- paatella hankkija kutsun lahettajasta, mutta se vaatisi etta myyja
-- lahettaa kutsut itse - ja se on eri paatos kuin kenen asiakas kuuluu
-- kenellekin. Kasin liittaminen pitaa nama erillaan.
--
-- MIKSI OMA TAULU.
--
-- Sama syy kuin user_roles-taulussa: jos tieto olisi sarakkeena
-- profiles-taulussa ja kayttaja saa paivittaa omaa riviaan, hän voisi
-- vaihtaa itselleen myyjan. Tassa taulussa ei ole yhtaan kayttajan
-- kirjoituspolitiikkaa.
--
-- SUUNNITTELUPERIAATTEET.
--
-- 1. YKSI OMISTAJA PER ASIAKAS. user_id on paaavain. Jos asiakas
--    siirtyy myyjalta toiselle, rivi paivitetaan - historiaa ei
--    talleteta, koska sita ei tarvita palkanmaksuun eika seurantaan.
--
-- 2. LIITTAMATON ASIAKAS EI OLE RIVI. Suurin osa 101 tunnuksesta on
--    hankittu ilman myyjaa, eika niille tarvitse riviä.
--
-- 3. MYYJA NAKEE OMAT LIITOKSENSA. Policy sitoo rivin
--    seller_id-arvoon. Kirjoitus kulkee service rolen kautta eli
--    admin-reitin lapi.
--
-- 4. MYYJAN POISTUESSA LIITOS KATOAA, ASIAKAS EI. Kaskadi kohdistuu
--    liitosriviin, ei asiakkaan tunnukseen - asiakas jaa vain
--    liittamattomaksi.

create table if not exists public.customer_owners (
  -- Asiakas.
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Myyja. Ei vaadita etta hanella on user_roles-rivi: rooli voi tulla
  -- myos ADMIN_EMAILS-listalta, eika kanta saa estaa liittamista siksi.
  seller_id uuid not null references auth.users(id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Myyja ei voi olla oma asiakkaansa.
  constraint customer_owners_not_self check (user_id <> seller_id)
);

create index if not exists customer_owners_seller_id_idx
  on public.customer_owners (seller_id);


create or replace function public.set_customer_owners_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_owners_updated_at on public.customer_owners;

create trigger customer_owners_updated_at
  before update on public.customer_owners
  for each row
  execute function public.set_customer_owners_updated_at();


alter table public.customer_owners enable row level security;

drop policy if exists customer_owners_select_own on public.customer_owners;

-- VAIN LUKU, VAIN OMAT LIITOKSET. Ei kirjoituspolitiikkoja: liittaminen
-- tapahtuu service rolella admin-reitin lapi.
create policy customer_owners_select_own
  on public.customer_owners
  for select
  using (auth.uid() = seller_id);


-- TARKISTUS AJON JALKEEN.
--
--   select policyname, cmd, qual from pg_policies
--    where schemaname = 'public' and tablename = 'customer_owners';
--   -- TASMALLEEN YKSI rivi: customer_owners_select_own / SELECT
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.customer_owners'::regclass order by conname;
--   -- paaavain user_id, check (user_id <> seller_id),
--   -- seka kaksi vierasavainta auth.users(id) ON DELETE CASCADE
