-- Kayttajan omat muistiinpanot hankkeesta (/crm).
--
-- MIKSI OMA TAULU EIKA SARAKE user_project_favorites-tauluun.
--
-- Omista poisto on oikea DELETE (/crm confirmRemoveFavorite), joten
-- sarakkeena muistiinpano katoaisi mukana ilman varoitusta. Kayttajan
-- itse kirjoittama teksti on arvokkaampaa kuin mikaan keraamamme kentta,
-- eika sita saa havittaa sivutuotteena. Sama linja kuin TIC-jonossa,
-- jossa poisto on tilamerkinta eika DELETE.
--
-- Kaytannossa: hanke voidaan poistaa omista ja lisata takaisin, ja
-- muistiinpano on yha tallella.
--
-- SUUNNITTELUPERIAATTEET.
--
-- 1. EI RIIPPUVUUTTA SUOSIKKEIHIN. Ei vierasavainta
--    user_project_favorites-tauluun, koska juuri sen katoaminen ei saa
--    viedä muistiinpanoa.
--
-- 2. KASKADI KAYTTAJAAN JA HANKKEESEEN. Tunnuksen poistuessa
--    henkilokohtainen teksti poistuu (sama linja kuin
--    2026-08-24_user_cascade.sql). Hankkeen poistuessa muistiinpano on
--    kohteeton, joten sekin poistuu.
--
-- 3. YKSI RIVI PER KAYTTAJA JA HANKE. Uniikki pari mahdollistaa
--    upsertin, jolloin tallennus ei tarvitse erillista "onko jo"
--    -kyselya.
--
-- 4. RLS PAALLE JA KAYTTAJAKOHTAISET POLICYT. Sivu lukee ja kirjoittaa
--    anon-avaimella kayttajan istunnossa, joten pelkka RLS ilman
--    policyja estaisi kaiken. Jokainen policy sitoo rivin
--    auth.uid()-arvoon: kukaan ei nae eika muokkaa toisen
--    muistiinpanoja. Ilman tata taulu olisi auki anon-avaimelle - sama
--    vika joka loytyi 16 taulusta 30.7.2026.

create table if not exists public.user_project_notes (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  -- Vapaa teksti. Ei pituusrajaa kannassa; kayttoliittyma rajaa.
  note text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_project_notes_user_project_uniq unique (user_id, project_id)
);

create index if not exists user_project_notes_user_id_idx
  on public.user_project_notes (user_id);


-- updated_at pidetaan ajan tasalla kannassa, jottei se ole
-- kayttoliittyman muistin varassa.
create or replace function public.set_user_project_notes_updated_at()
returns trigger
language plpgsql
-- Kiinnitetty search_path, kuten 2026-08-24_function_hardening.
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_project_notes_updated_at on public.user_project_notes;

create trigger user_project_notes_updated_at
  before update on public.user_project_notes
  for each row
  execute function public.set_user_project_notes_updated_at();


alter table public.user_project_notes enable row level security;


drop policy if exists user_project_notes_select_own on public.user_project_notes;
drop policy if exists user_project_notes_insert_own on public.user_project_notes;
drop policy if exists user_project_notes_update_own on public.user_project_notes;
drop policy if exists user_project_notes_delete_own on public.user_project_notes;

create policy user_project_notes_select_own
  on public.user_project_notes
  for select
  using (auth.uid() = user_id);

create policy user_project_notes_insert_own
  on public.user_project_notes
  for insert
  with check (auth.uid() = user_id);

create policy user_project_notes_update_own
  on public.user_project_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Poisto sallitaan, jotta kayttaja voi halutessaan poistaa oman
-- tekstinsa kokonaan. Tyhjentaminen kayttoliittymassa jattaa rivin,
-- mika riittaa - tama on varalla GDPR-pyyntoja varten.
create policy user_project_notes_delete_own
  on public.user_project_notes
  for delete
  using (auth.uid() = user_id);


-- TARKISTUS AJON JALKEEN.
--
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public' and tablename = 'user_project_notes';
--   -- rowsecurity pitaa olla true
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'user_project_notes'
--    order by policyname;
--   -- neljä riviä: delete, insert, select, update


-- HUOM 28.8.2026: ensimmaisen ajon jalkeen kannassa oli KAHDEKSAN
-- policya nelja sijaan. Talle taululle oli ajettu myos toinen,
-- repositorion ulkopuolinen versio nimilla notes_select_own,
-- notes_insert_own, notes_update_own ja notes_delete_own.
--
-- Ehdot tarkistettiin eika vuotoa ollut: kaikissa kahdeksassa oli
-- (auth.uid() = user_id). Ainoa ero oli notes_update_own, jolta puuttui
-- with_check - Postgres kayttaa silloin USING-lauseketta myos uusien
-- rivien tarkistukseen, joten vaikutus on sama.
--
-- Kaksoiskappaleet pudotettiin, jotta kanta vastaa tata tiedostoa.
-- Sallivat policyt yhdistyvat TAI-ehdolla, joten paallekkaiset saannot
-- ovat aina tarkistamisen arvoisia: loysin voittaa tiukemman.
--
--   drop policy if exists notes_select_own on public.user_project_notes;
--   drop policy if exists notes_insert_own on public.user_project_notes;
--   drop policy if exists notes_update_own on public.user_project_notes;
--   drop policy if exists notes_delete_own on public.user_project_notes;
