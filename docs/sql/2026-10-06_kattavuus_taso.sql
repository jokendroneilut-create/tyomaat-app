-- YHTEYSTIEDON TASO TILANNEKUVAAN (D-241)
--
-- Aja tama Supabasen SQL-editorissa.
--
-- Mittarissa on nyt kaksi neulaa: hankekohtainen yhteyshenkilo (tavoite)
-- ja kaikki yhteyshenkilot mukaan lukien yrityskohtaiset. Jotta graafi
-- voi nayttaa saman eron ajassa, molemmat luvut on tallennettava.
--
-- Sarake sallii NULLin, koska aiemmat rivit on kirjattu ennen tasoa.
-- Tyhja on oikea arvo: silloin ei tiedetty.

alter table public.yhteystieto_kattavuus
  add column if not exists hankekohtaisia integer;

-- Tarkistus:
--   select paiva, vaihe, hankekohtaisia, yhteystiedolla, hankkeita
--   from public.yhteystieto_kattavuus order by paiva desc limit 10;
