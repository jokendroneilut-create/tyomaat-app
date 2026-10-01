-- KAYTTAJAN YRITYS (D-224)
--
-- Aja tama Supabasen SQL-editorissa.
--
-- MIKSI ERIKSEEN EIKA PAATELLEN. D-223 paatteli asiakkaan
-- sahkopostista: yritysdomain, tai vapaassa sahkopostissa koko osoite.
-- Paattely toimii 102 tunnuksella 113:sta, mutta 11 jaa yksin omaksi
-- "asiakkaakseen" vain siksi etta heilla on gmail. Jos kaksi heista on
-- saman yrityksen vakea, me emme voi tietaa sita mistaan.
--
-- Nyt yritys valitaan tunnukselle. Paattely jaa yha oletukseksi, mutta
-- valinta voittaa sen aina — ja samalla tunnukset voi jarjestaa
-- yrityksen mukaan.
--
-- NIMI ON AVAIN, EI ID. Yrityksia on kymmenia, ei tuhansia, ja nimi on
-- se mita kayttoliittymassa kirjoitetaan ja luetaan. Erillinen
-- yritystaulu id:lla toisi liitoksen ja yllapidon ilman etta mikaan
-- kysymys helpottuisi. `customer_billing.tunniste` ottaa nimen vastaan
-- sellaisenaan, samoin kuin se ottaa domainin.

create table if not exists public.user_company (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Nakyva nimi sellaisena kuin se kirjoitettiin ("Koneunion Oy").
  yritys text not null check (length(trim(yritys)) > 0),

  updated_at timestamptz not null default now()
);

-- Jarjestaminen ja ehdotuslista lukevat tata.
create index if not exists user_company_yritys_idx
  on public.user_company (lower(trim(yritys)));

-- Vain palvelinreitti (service role). Asiakkaiden yritysnimet eivat
-- kuulu selaimeen muille kuin adminille, ja admin lukee ne reitin
-- kautta. Ilman tata taulu olisi auki anon-avaimelle (vrt. 2026-07-30).
alter table public.user_company enable row level security;
revoke all on public.user_company from anon, authenticated;

-- Tarkistus:
--   select yritys, count(*) as tunnuksia
--   from public.user_company
--   group by yritys
--   order by tunnuksia desc, yritys;
