-- AJETTU TUOTANTOON 16.10.2026 (D-293).
--
-- MIKSI. Sovellus naytti virhesivun kesken demon, eika se herannyt
-- paivittamalla. Postgres-lokin ainoa aito virhe oli
-- "canceling statement due to statement timeout" (20 kpl / 24 h).
--
-- Syy EI ollut hidas kysely vaan levylle valuva lajittelu. EXPLAIN
-- ennen indekseja:
--
--   Seq Scan on projects (6 847 rivia, suodatin hylkasi 303)
--   Sort Method: external merge  Disk: 6688 kB
--   temp read=245 written=840
--
-- Jokainen /today-lataus kirjoitti 6,7 MB valiaikaistiedostoa levylle.
-- Samassa lokissa checkpointit veivat 8-10 s (write=10.109 s), eli levy
-- seisoi saannollisesti. Kun levylajittelu osui sellaiseen hetkeen,
-- kysely ylitti 8 sekunnin katon ja sovellus kaatui.
--
-- Osittainen indeksi suodattimen ehdoilla ja created_at-jarjestyksessa
-- antaa valmiiksi lajitellun polun, joka pysahtyy tuhanteen riviin:
-- ei seq scania eika lajittelua lainkaan.

create index if not exists projects_today_idx
  on public.projects (created_at desc)
  where status = 'active' and is_public and phase <> 'Valmistunut';

create index if not exists projects_today_region_idx
  on public.projects (region, created_at desc)
  where status = 'active' and is_public and phase <> 'Valmistunut';

analyze public.projects;

-- MITATTU JALKEEN (EXPLAIN ANALYZE, sama kysely):
--
--   maakuntarajattu   Seq Scan 159 ms, Disk 2008 kB  ->  Index Scan 12 ms, EI lajittelua
--   ilman rajausta    Seq Scan  19 ms, Disk 6688 kB  ->  Index Scan  9 ms, EI lajittelua
--
-- Indeksien koko: 160 kB + 264 kB (taulu 34 MB).
--
-- ASIAKKAAN KOKEMA AIKA EI MUUTTUNUT, eika sen pitanytkaan: mitattu
-- kotikoneelta 1510/820 ms ennen ja jalkeen, eli kohinaa. Aika menee
-- verkkoon ja JSON-siirtoon (1 000 rivia x 2,3 kB metadataa ~ 2 MB).
-- Indeksin arvo on altistuksen poistuminen, ei nopeus.
