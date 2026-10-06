-- KAYTTAJAN PUHELINNUMERO (D-238)
--
-- Aja tama Supabasen SQL-editorissa.
--
-- Etunimi ja sukunimi lisattiin jo (2026-10-06). Puhelin tuli mukaan
-- samaan lomakkeeseen: se on ainoa tieto jolla asiakkaaseen saa
-- yhteyden ilman sahkopostia.
--
-- TEHTAVANIMIKETTA EI LISATA. Johannes 6.10.2026: "liian
-- henkilokohtaista tietoa." Kenttaa jota ei kerata ei voi myoskaan
-- vuotaa.

alter table public.profiles add column if not exists phone text;

-- Tarkistus:
--   select id, email, first_name, last_name, phone from public.profiles limit 5;
