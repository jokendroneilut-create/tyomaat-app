-- JOUKKOVIESTIN TEKSTI TALTEEN (D-339, jatko)
--
-- Aja tama Supabasen SQL-editorissa.
--
-- Johannes 24.10.2026: *"molemmissa olisi hyva nakya kenelle viesti meni
-- ja mita siina luki."* Loki tallensi otsikon, vastaanottajat ja
-- lukumaaran, mutta EI viestin runkoa -- se eli vain Resendin puolella.
--
-- VANHOJA VIESTEJA EI VOI PALAUTTAA. Ennen tata lahetetyt viisi
-- joukkoviestia jaavat ilman tekstia; sarake on null-salliva, ja
-- nakymassa niiden kohdalla lukee ettei tekstia ole tallessa. Vaarempi
-- vaihtoehto olisi rakentaa teksti uudelleen jostain -- sita ei ole
-- mista rakentaa.

alter table public.broadcast_message_log
  add column if not exists viesti text;

-- Tarkistus:
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'broadcast_message_log'
order by ordinal_position;
