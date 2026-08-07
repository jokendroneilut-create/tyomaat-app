-- 2026-08-07 — Rajukivi rikastuslähteeksi (ei enää luo ehdokkaita).
--
-- Aja Supabasen SQL-editorissa (repo ei sisällä migraatioajuria).
--
-- Tausta: rajukivi.fi:n "Ajankohtaista" kertoo missä hankkeissa yritys on
-- mukana, ei yrityksen omista hankkeista. Esimerkki artikkelista:
-- "Rajukivi Oy vastaa alueen Melkinlaiturin katu-urakan (RU3) toteutuksesta"
-- — Melkinlaituri on jo kannassa omana hankkeenaan.
--
-- Mitattuna: 48 ehdokasta, joista 48 hylättiin eikä yhtään hyväksyttiin.
-- Samaan aikaan tieto jota lähde oikeasti tarjoaa jäi saamatta: Rajukivi ei
-- ollut urakoitsijana eikä liittyvänä yrityksenä yhdelläkään hankkeella.
--
-- companyMentionCollector ei luo ehdokkaita. Se etsii artikkelin kuvaaman
-- työmaan olemassa olevista hankkeista (kynnys 70, sama kuin agentin
-- tuonnissa) ja lisää yrityksen sen liittyviin yrityksiin. Ilman osumaa ei
-- tehdä mitään.
--
-- ODOTETTU TUOTTO ON PIENI: kuiva-ajossa 16 artikkelista osui 1, ja sekin
-- hankkeeseen jonka rajukivi itse aiemmin loi. Pääasiallinen hyöty on siis
-- se että lähde ei enää tuota hylättäviä ehdokkaita.
--
-- Peruutus: update public.discovery_sources
--             set collector = 'apiCollector' where id = 'rajukivi-oy';
--           (huom: apiCollectorin rajukivi-haara on poistettu koodista,
--            joten peruutus vaatii myös koodin palautuksen)

update public.discovery_sources
   set collector = 'companyMentionCollector'
 where id = 'rajukivi-oy';

-- Tarkistus:
-- select id, name, collector, parser, enabled, run_count, error_count
--   from public.discovery_sources where id = 'rajukivi-oy';
