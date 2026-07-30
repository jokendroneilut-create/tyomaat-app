-- 2026-07-30 — Viiden hyväksytyn hankkeen maakunta asetettu käsin.
--
-- AJETTU JO 2026-07-30 kertakäyttöisellä skriptillä. Tämä tiedosto on kirjaus:
-- se kertoo mitkä rivit muutettiin ja millä perusteella, koska kannassa ei ole
-- mitään joka erottaisi käsin asetetun maakunnan koneellisesta.
--
-- Tausta: maakunta ohjaa sitä kenen syötteeseen hanke päätyy. Sekä
-- app/today/services/getTodayProjects.ts (.in("region", ...)) että
-- app/api/digests/route.ts (.eq("region", ...)) ovat SQL-vertailuja, eikä NULL
-- täsmää niihin koskaan — maakunnaton hanke ei siis osu kaikkiin hakuvahteihin
-- vaan putoaa pois kaikilta jotka ovat valinneet maakuntansa. Puuttuva maakunta
-- on siis näkymättömyyttä, ei melua.
--
-- Miksi käsin: scripts/backfill-region.ts --llm kysyy jokaisen rivin kahdesti ja
-- hyväksyy vain yksimielisen vastauksen. Näillä viidellä on vain otsikko eikä
-- kuvausta, joten toinen ääni pidättyi ja rivi jäi tyhjäksi. Sijainti lukee
-- kuitenkin nimessä, joten ihminen ratkaisee ne luotettavasti.
--
-- Nämä rivit eivät palaa TIC-tarkistukseen (status = approved), joten ne eivät
-- olisi korjaantuneet tarkistuksen yhteydessä.
--
-- Maakunnat luettiin lib/geo/municipalities.ts:stä, ei kirjoitettu käsin.
-- Peruutus: update public.projects set region = null where id = '<id>';


-- Kimolan kanava yhdistää Konniveden ja Pyhäjärven Iitissä.
update public.projects
   set region = 'Kymenlaakso'   -- Iitti
 where id = '6c383f42-19fd-479a-9931-8c17ea9f0ad2';

-- Jokue ja Tillola ovat Iitin kyliä valtatie 12:n varrella.
update public.projects
   set region = 'Kymenlaakso'   -- Iitti
 where id = 'f8032ba0-eadd-4d22-b330-9f24ad6d1026';

-- Iijoen ratasilta sijaitsee Iin kunnassa.
update public.projects
   set region = 'Pohjois-Pohjanmaa'   -- Ii
 where id = '37230009-5def-4977-9dd0-b3c33b0fc00d';

-- Koiviston ja Pikkuhaaran sillat ovat valtatie 11:llä Nakkilassa.
update public.projects
   set region = 'Satakunta'   -- Nakkila
 where id = '5c69e3ee-e4cf-4f06-85fa-3c8b8f473c8e';

-- Kolmenkulma on Tampereen ja Nokian rajalla. Saman hankkeen sisarrivi
-- potential_projects-taulussa ratkesi kuvauksen perusteella Tampereeksi;
-- tällä projects-rivillä kuvausta ei ole, siksi käsin.
update public.projects
   set region = 'Pirkanmaa'   -- Tampere
 where id = '20e1b58c-7258-46ae-9089-1f00712da413';


-- Tarkistus (odotettu tulos: 5 riviä, kaikilla region asetettu):
-- select id, region, name from public.projects
--  where id in ('6c383f42-19fd-479a-9931-8c17ea9f0ad2',
--               'f8032ba0-eadd-4d22-b330-9f24ad6d1026',
--               '37230009-5def-4977-9dd0-b3c33b0fc00d',
--               '5c69e3ee-e4cf-4f06-85fa-3c8b8f473c8e',
--               '20e1b58c-7258-46ae-9089-1f00712da413');
--
-- Näiden jälkeen projects-taulussa on 10 riviä ilman maakuntaa. Ne ovat
-- puitesopimuksia, markkinakartoituksia ja muita joissa sijaintia ei ole
-- olemassakaan ("Mastojen rakentaminen") — ne kuuluvat jäädä tyhjäksi.
