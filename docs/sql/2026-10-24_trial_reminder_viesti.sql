-- LAHETETTY VIESTI TALTEEN LOKIIN (D-340, jatko)
--
-- Aja tama Supabasen SQL-editorissa.
--
-- Johannes 24.10.2026: *"naenko myos tuolta .../dashboard/messages sen
-- viestin mika asiakkaalle on lahtenyt?"* Ei nahnyt: loki kertoi kenelle,
-- milloin ja mika vaihe, muttei tekstia.
--
-- MIKSI TEKSTI TALLENNETAAN EIKA JOHDETA. Viestin voisi rakentaa
-- uudelleen lokin luvuista, koska se syntyy niista -- mutta silloin
-- nakyma nayttaisi NYKYISEN sanamuodon, ei sita joka asiakkaalle lahti.
-- Teksti on jo muuttunut kahdesti saman paivan aikana (puhelinnumero,
-- lukitusmaininta), joten johdettu teksti valehtelisi heti. Loki on
-- tosite siita mita tehtiin, ei esikatselu siita mita tekisimme nyt.
--
-- Sarakkeet ovat null-sallivia, koska "ohitettu"-rivista ei lahtenyt
-- viestia -- silloin tekstia ei ole olemassakaan.

alter table public.trial_reminder_log
  add column if not exists otsikko text;

alter table public.trial_reminder_log
  add column if not exists viesti text;

-- Tarkistus palauttaa rivin jossa molemmat sarakkeet nakyvat:
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'trial_reminder_log'
order by ordinal_position;
