-- Jarjestelmarooli: admin ja myyja.
--
-- MIKSI.
--
-- Admin-oikeus on tahan asti tullut ymparistomuuttujasta ADMIN_EMAILS,
-- jota vasten verrataan sahkopostia kymmenessa eri reitissa. Kolmas
-- taso ei mahdu siihen: ymparistomuuttuja ei voi kertoa KENEN
-- asiakkaita kukin myyja sai, eika sita voi muuttaa ilman uutta
-- julkaisua.
--
-- MIKSI OMA TAULU EIKA SARAKE profiles-tauluun.
--
-- profiles-taulussa on rivi jokaiselle tunnukselle, joten sarake olisi
-- ollut helppo. Se olisi kuitenkin vaarallinen: jos profiles sallii
-- kayttajan paivittaa omaa riviaan (esim. full_name), sama kaytanto
-- antaisi hanen asettaa itselleen roolin 'admin'. Oikeuksien laajennus
-- valtetaan sillä, ettei tahan tauluun ole yhtaan kayttajan
-- kirjoituspolitiikkaa - vain service role kirjoittaa.
--
-- EI SEKOITETTAVA TIIMIROOLIIN. team_members.role on 'leader' tai
-- 'member' ja kertoo aseman tiimissa. Tama taulu kertoo aseman
-- jarjestelmassa. Eri kasitteet, eri taulut.
--
-- SUUNNITTELUPERIAATTEET.
--
-- 1. TAVALLINEN KAYTTAJA EI OLE RIVI. Roolin puuttuminen tarkoittaa
--    tavallista asiakasta. Niin 101 tunnuksesta 99 ei tarvitse rivia,
--    eika kannassa ole tilaa joka voi ajautua eri linjoille.
--
-- 2. YKSI ROOLI PER TUNNUS. user_id on paaavain, joten kaksoisrooleja
--    ei voi syntya.
--
-- 3. ADMIN_EMAILS JAA VOIMAAN RINNALLE. Jos taman taulun sisalto
--    menee rikki tai admin poistaa vahingossa oman rivinsa, paasy
--    sailyy ymparistomuuttujan kautta. Lukitsematta jaaminen on
--    tarkeampaa kuin yksi totuuden lahde.
--
-- 4. KAYTTAJA NAKEE VAIN OMAN ROOLINSA. Ei listaa siita ketka ovat
--    admineja tai myyjia.

create table if not exists public.user_roles (
  -- Paaavain suoraan user_id:lla: yksi rooli per tunnus.
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Sallitut arvot rajattu kannassa, jottei kirjoitusvirhe tuota
  -- roolia jota mikaan tarkistus ei tunne.
  role text not null check (role in ('admin', 'seller')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create or replace function public.set_user_roles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_roles_updated_at on public.user_roles;

create trigger user_roles_updated_at
  before update on public.user_roles
  for each row
  execute function public.set_user_roles_updated_at();


alter table public.user_roles enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;

-- VAIN LUKU, VAIN OMA RIVI. Ei insert-, update- eika delete-policya:
-- roolien myontaminen kulkee service rolen kautta, eli admin-reitin
-- lapi. Ilman tata kayttaja voisi korottaa itsensa.
create policy user_roles_select_own
  on public.user_roles
  for select
  using (auth.uid() = user_id);


-- TARKISTUS AJON JALKEEN.
--
--   select policyname, cmd, qual from pg_policies
--    where schemaname = 'public' and tablename = 'user_roles';
--   -- TASMALLEEN YKSI rivi: user_roles_select_own / SELECT
--   -- Jos naet insert- tai update-policyn, se on poistettava.
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.user_roles'::regclass;
--   -- mukana check (role = any (array['admin','seller']))
--   -- ja user_id:n paaavain seka vierasavain auth.users(id)
