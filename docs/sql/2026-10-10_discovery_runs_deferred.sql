-- SIIRRETTYJEN KANDIDAATTIEN MÄÄRÄ NÄKYVIIN (D-260)
--
-- legacyFetchCollector pysähtyy 60 sekunnin tuontibudjettiin ja merkitsee
-- loput kandidaatit "deferred" eli seuraavaan ajoon siirtyviksi. Luku on
-- tähän asti mennyt vain console.warn-riville eli Vercelin lokiin, jota
-- kukaan ei lue — lähde näyttää täysin onnistuneelta vaikka se jätti
-- kaksi kolmasosaa tuomatta.
--
-- Mitattu 10.10.2026: Keravan uutislähde tallensi 101 asiakirjaa ja toi
-- niistä 37. Tämä ei näkynyt missään.
--
-- Koodi kirjoittaa sarakkeen jos se on olemassa ja jättää sen väliin jos
-- ei, joten ajon ajankohta ei ole kriittinen.

alter table public.discovery_runs
  add column if not exists documents_deferred integer;

comment on column public.discovery_runs.documents_deferred is
  'Kandidaatteja jotka eivät mahtuneet tuontibudjettiin ja siirtyivät seuraavaan ajoon.';
