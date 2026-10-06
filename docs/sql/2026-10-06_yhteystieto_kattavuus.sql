-- YHTEYSTIEDON KATTAVUUDEN PAIVITTAINEN TILANNEKUVA (D-239)
--
-- Aja tama Supabasen SQL-editorissa.
--
-- MIKSI OMA TAULU. Yhteystiedot elavat hankkeen metadatassa ilman
-- versiota, joten emme tieda mika kattavuus oli viime viikolla. Trendia
-- ei voi laskea takautuvasti: kokeiltu 6.10.2026 tuontikuukauden mukaan,
-- ja kayra heiluu volyymin mukaan eika laadun (suunnitteluvaihe:
-- kesakuussa 100 %, mutta se oli yksi hanke; elokuussa 44 % ja 1 109
-- hanketta).
--
-- Siksi mittaus alkaa nyt. Jokainen paiva jolta rivi puuttuu on paiva
-- jota ei saa takaisin.
--
-- YKSI RIVI PER PAIVA JA VAIHE. Kerran vuorokaudessa riittaa
-- tarkkuudeksi (Johannes 6.10.2026). Perusavain tekee ajosta
-- idempotentin: sama paiva voidaan kirjoittaa uudestaan ilman
-- kaksoisrivia, jolloin cronin voi ajaa useamminkin.

create table if not exists public.yhteystieto_kattavuus (
  paiva date not null,

  -- Kanoninen vaihe: "construction" tai "planning".
  vaihe text not null,

  -- Nimittaja ja osoittaja TALLENNETAAN, ei vain prosentti. Prosentti
  -- yksin ei kerro onko 60 % kolmesta vai 600:sta hankkeesta, eika
  -- jalkikateen voi laskea kumpaa tarkoitettiin.
  hankkeita integer not null,
  yhteystiedolla integer not null,

  luotu timestamptz not null default now(),

  primary key (paiva, vaihe)
);

-- Vain palvelinreitti (service role). Sisaltaa liiketoiminnan
-- tunnuslukuja, jotka eivat kuulu selaimeen.
alter table public.yhteystieto_kattavuus enable row level security;
revoke all on public.yhteystieto_kattavuus from anon, authenticated;

-- Tarkistus:
--   select * from public.yhteystieto_kattavuus order by paiva desc limit 10;
