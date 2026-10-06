-- YRITYKSEN YHTEYSHENKILOT (D-242)
--
-- Aja tama Supabasen SQL-editorissa.
--
-- MIKSI OMA TAULU EIKA KENTTA HANKKEELLA. Sama yritys esiintyy sadoissa
-- hankkeissa; jos yhteystieto kopioitaisiin jokaiselle, yhden henkilon
-- vaihtuminen vaatisi satojen rivien paivittamisen eika mikaan kertoisi
-- mika niista on ajan tasalla. Rekisterissa tieto on yhdessa paikassa ja
-- hanke viittaa siihen yrityksen nimella.
--
-- TASO ON AINA "company". Nama eivat ole hankkeen omia yhteyshenkiloita
-- vaan yrityksen yleisia (D-241). Asiakkaalle se nakyy merkintana
-- "yrityksen yhteyshenkilo", ja mittarin tumma neula ei nouse naista.
--
-- AVAIN ON NORMALISOITU NIMI. Kannassa sama yritys kirjoitetaan monella
-- tavalla ("YIT", "YIT Suomi Oy", "Yit Rakennus"), joten liitos tehdaan
-- normalisoidulla avaimella eika nakyvalla nimella.

create table if not exists public.yritys_yhteyshenkilot (
  id uuid primary key default gen_random_uuid(),

  -- Normalisoitu liitosavain, esim. "yit". Ks. lib/metrics/yritysavain.ts
  avain text not null,

  -- Nimi sellaisena kuin se naytetaan ("YIT Suomi Oy").
  yritys text not null,

  nimi text not null,
  nimike text,
  email text,
  puhelin text,

  -- Mista tieto on peraisin: osoite tai lyhyt kuvaus.
  lahde text,

  luotu timestamptz not null default now(),
  paivitetty timestamptz not null default now()
);

create index if not exists yritys_yhteyshenkilot_avain_idx
  on public.yritys_yhteyshenkilot (avain);

-- Sama henkilo vain kerran samalle yritykselle.
create unique index if not exists yritys_yhteyshenkilot_uniq
  on public.yritys_yhteyshenkilot (avain, lower(coalesce(email, nimi)));

-- Vain palvelinreitti. Taulu sisaltaa nimettyjen henkiloiden
-- yhteystietoja, eivatka ne kuulu selaimeen ilman istuntoa.
alter table public.yritys_yhteyshenkilot enable row level security;
revoke all on public.yritys_yhteyshenkilot from anon, authenticated;

-- Tarkistus:
--   select avain, yritys, nimi, nimike, email from public.yritys_yhteyshenkilot
--   order by avain limit 20;
