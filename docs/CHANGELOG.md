# Työmaat.fi – Changelog

Merkittävät toiminnalliset muutokset teemoittain. Yksityiskohdat git-historiassa
(commit-tunnukset suluissa). Ylin = uusin.

Tämä tiedosto kattaa työn edellisen dokumentaatiopäivityksen (`a3aabc8`,
kaavakatalogi) jälkeen. Kuntakohtainen kaavalähteiden kattavuus on omassa
tiedostossaan: [`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md).

---

## 2026-08 (työ 31.7.–6.8.)

### Lähdeputkien yhdistäminen

- **Vanhat yritys-/varhaislähteet discovery-putkeen.** 34 fetcheriä
  (`lib/agent/sources.ts`) ajettiin omalla mekanismillaan, jossa kierron
  aloituskohtia oli kaksi ja ajo kuoli aikaan ennen listan loppua — viisi
  viimeistä lähdettä ei ollut päässyt kertaakaan vuoroon. Ne siirrettiin
  `discovery_sources`-tauluun adapterilla (`legacyFetchCollector`), joka
  kutsuu samoja fetchereitä. Fetchereitä ei kirjoitettu uusiksi. (9bda48e,
  49903c9, 4bf0688, ks. [D-016](03_DECISIONS.md))
- **Vanha putki poistettu** kun kaikki 34 oli kiertänyt virheettä ja
  tuottanut ehdokkaita: `/api/agent/run`, `/api/agent/run-test-source`,
  `/api/agent/discover`. `lib/agent/sources.ts` jäi, koska uusi kerääjä
  käyttää sitä. Samalla korjattu Operations-sivun lähdelaskuri, joka
  laski siirretyt lähteet kahteen kertaan. (0fc2589)

### Discovery – lähdekorjaukset

- **Oulun kaavakuvaukset.** Detaljihakuja sai tehdä 5/ajo, mutta yksi ajo
  näki 18 kohdetta — loput tallentuivat tynkinä ja etenivät katselmointiin
  tyhjinä hankekortteina. Sivuosoitin palasi samalle sivulle vasta 19 päivän
  päästä, joten kuvaus saattoi puuttua kuukausia. Budjetti 25, rästit
  haetaan ensin, eikä kohdetta tallenneta ennen onnistunutta hakua.
  35 dokumenttia korjattu takautuvasti. (62654e8)
- **STT: lupaviranomainen ei ole rakennuttaja.** Julkaisijan käyttö
  rakennuttajana on oikein yritykselle mutta ei viranomaiselle, joka
  tiedottaa muiden hankkeista. `resolveDeveloper` poimii toteuttajan
  tekstistä tai jättää kentän tyhjäksi. (f9c3095)
- **Kontiolahti: yhteystieto-otsikko ei ole kaava.** Kaavalistan perässä
  oleva "Yhteystiedot:" oli samalla otsikkotasolla kuin kaavat. Lohkolta
  vaaditaan nyt vähintään yksi vaihehaitari. (008965d)

### Tunnistus, täsmäytys ja duplikaatit

- **Käsin lisätty tieto ei enää huononna täsmäytystä.** Kaupungin nimi
  osoitekentässä tuotti `same_location`-osuman kahden eri hankkeen välille.
  Osoite kelpaa todisteeksi vain kun se on kaupunkia tarkempi; erottuva
  otsikko sai oman painonsa (`exact_distinctive_title`). (f3de242, c07f8dd)
- **Valmistumisuutiset** täsmätään olemassa olevaan hankkeeseen ja hanke
  merkitään valmiiksi ihmisen vahvistettavaksi. (dd06253)
- **Duplikaattivertailu ryhmitellään** kaupungin ja tunnisteiden mukaan:
  1 574 279 vertailua / 358 s → 37 598 / 7 s, kun reitin raja on 60 s.
  Viikkocron ei ollut ehtinyt kertaakaan loppuun. (c8307e2,
  ks. [D-015](03_DECISIONS.md))
- **Skannauksen ajot kirjataan** `agent_runs`-tauluun, joten hiljaisuuden
  erottaa toimimattomuudesta. Näkyy Discovery Health -sivun ajolistassa.
  (5e8f990)
- Työkalut: `scripts/scan-duplicates.ts` (ajo ilman aikarajaa + mitoitus),
  `scripts/diag-duplicate-pair.ts` (miksi pari tunnistuu tai ei). (0c0458b)

### Hankkeen elinkaari

- **Vaihe saa vain edetä.** Agentin tuonti kirjoitti vaiheen ehdoitta, joten
  vanha uutinen siirsi käynnissä olevan työmaan takaisin suunnitteluun —
  4 vrk:n ikkunassa 29 kertaa 32:sta, mukaan lukien ihmisen hyväksynnässä
  asettama vaihe. 38 hanketta palautettu. (2e98ce8,
  ks. [D-013](03_DECISIONS.md))
- **Vanhentunut kilpailutus palaa aktiiviseksi** kun voittaja selviää.
  (3e80cfd, ks. [D-014](03_DECISIONS.md))

### TIC / käyttöliittymä

- **"Liitä hankkeeseen"** kolmantena vaihtoehtona hyväksy/hylkää-parin
  rinnalle: osa ehdokkaista on uutta tietoa jo tunnetusta hankkeesta, ei
  uusi hanke. Ehdotukset, haku ja selattava lista. (87a92f4, 453cba5)
- **Liittyvät yritykset** vapaana listana. Pääurakoitsija-kenttä nimettiin
  selkeäksi, koska esim. talotekniikkatoimittaja ei ole pääurakoitsija.
  (31eeabd, d81a25e)
- **Duplikaattien katselmointi vaatii vahvistuksen** — kaikki kolme
  toimintoa ovat vaikeita perua. (c257544)

### Kartta ja asiakasnäkymä

- **Vaihesuodatin monivalinnaksi** käyttäjäpalautteen perusteella: käynnissä
  olevat ja lupavaiheen hankkeet samaan näkymään, päättyneet pois. (e60a78f)
- **Egress**: karttasivu ei enää hae metadataa listaan (1,93 → 1,14 MB
  pakattuna per lataus). (ccc001f)
- **Ilmoitukset omaksi kohdakseen Asetuksiin.** Sähköpostihälytysten kytkin
  oli /today-näkymän "Mukauta näkymää" -velhon sisällä eli käytännössä
  löytymättömissä. Sama kenttä, uusi paikka. (f20b360, 18cacec)

### Dokumentaatio

- **Hyvinvointialueet lähteenä** — 21 alueen kartoitus ja avoin kysymys
  siitä kannattaako niitä lisätä:
  [`09_HYVINVOINTIALUE_SOURCES.md`](09_HYVINVOINTIALUE_SOURCES.md).
  (85ccbbf, 18d0c9a)

### Vielä dokumentoimatta

29.–30.7. tehty työ (tiiminäkymän suodattimet ja sivutus, /today-onboarding,
RLS-kovennus, kaavaresolverien vaihekartoitus, maakunnan päättely tilaajan
nimestä ja LLM:llä) on toistaiseksi vain commit-viesteissä.

---

## 2026-07

### Discovery – lähteet ja tiedonkeruu

Uudet varhaisen vaiheen lähteet (kilpailija-aukon sulkeminen, Metroc/RPT Smart):
isot hankkeet halutaan kiinni ennen rakennuslupaa ja urakkakilpailutusta.

- **YVA-lähde** (`fetchYvaSource`, ymparisto.fi): ympäristövaikutusten arviointi
  on pakollinen suurille hankkeille (tuuli-/aurinko-/ydinvoima, kaivokset,
  datakeskukset, tehtaat, akkumateriaali, biojalostamot, voimajohdot, suuret
  väylät) ja käynnistyy hankkeen KAIKKEIN aikaisimmassa vaiheessa — usein vuosia
  ennen rakennuslupaa. Hakee helfi-Elasticsearch-proxysta (`POST
  /fi/app/search/query`) `type=yva_project` julkaisuajan mukaan, suodattaa vain
  Suomen kuntiin (pudottaa rajat ylittävät YVA:t), tuoreisiin (18 kk) ja pois
  turve/SOVA-arvioinnit. ~100 tuoretta hanketta. (95f39e3)
- **Ympäristölupa-lähde** (`fetchYmparistolupaSource`, Lupa- ja
  valvontaviraston tietopalvelu): isot yksityiset teollisuus-, energia- ja
  datakeskushankkeet näkyvät lupavaiheessa aikaisin — usein ennen rakennuslupaa
  ja ilman julkista kilpailutusta (juuri se aukko jonka takia Forssan
  datakeskus jäi aiemmin ohi). Hakee korkean arvon hanketyypeillä, suodattaa
  pois olemassa olevien laitosten lupamuutokset/valvonnan ja vesirakentamisen,
  deduplikoi diaarinumerolla. (79980ec)
- **Suunnittelukilpailu-lähde** (`fetchSuunnittelukilpailuSource`, SAFA):
  arkkitehtuurikilpailu on merkittävän julkisen rakennuksen (kampus, museo,
  kirjasto, terminaali, kirkko) aikaisin julkinen signaali — vuosia ennen
  rakennuslupaa, ja osa kutsukilpailuista ei näy Hilmassa lainkaan. Poimii
  `/kilpailut/`-sivun käynnissä olevat kilpailut, kunkin kilpailusivun otsikon +
  og:descriptionin (järjestäjä, aikataulu), päättelee kaupungin. Matala
  volyymi, korkea arvo. (268cca9)
- **Rakennuslehti-lähde** (`fetchRakennuslehtiSource`): alan uutissyöte (RSS)
  hanke-avainsanoilla, pois yrityskaupat/talousuutiset. (7f87384)
- **STT-avainsanahaku** (`fetchSttHakuSource`): hakee KAIKISTA STT:n
  tiedotteista rakentamiseen liittyvät (~30 hakusanaa, oikea parametri `search`,
  ei `query`), 12 kk tuoreus, dedup id:llä. Täydentää yhtiökohtaisia
  STT-lähteitä. (65783b6)
- **Tontinluovutukset arvioitu, jätetty väliin**: ei kansallista eikä siistiä
  kaupunkikohtaista rajapintaa (Helsingin `tontit.hel.fi` poistettu, data
  hajallaan kohisevissa päätösjärjestelmissä, päällekkäistä kaavan kanssa).
  Kohiseva päätös-scraperi olisi haitannut TIC-jonoa enemmän kuin hyödyttänyt.
- **Helsinki: SUKKA-kaavalähde** korvasi vanhan WFS-lähteen. Uusi rajapinta
  (`kartta.hel.fi/api-sw`, Sitowise/Oskari) antaa yhdellä bbox-kutsulla kaikki
  vireillä olevat asemakaavat kuvauksineen, yhteyshenkilöineen, vaiheineen ja
  diaarinumeroineen (uusi tunniste `helsinki_diaarinumero`). Vanha WFS jätetty
  kantaan `enabled=false` -varalle. (60f50b6)
- **Kaavan konsultit/toimistot** poimitaan Helsingin kaavaliitteiden
  (`sukka_attachment`) otsikoista LLM:llä → hankekortin oma "Selvitykset ja
  konsultit" -osio (arkkitehti-, insinööri- ja konsulttitoimistot, erillään
  urakoitsijoista). (876c5bf)
- **hel.fi/uutiset** -lähde: Helsingin kaupungin uutissyöte tiukalla
  rakennus/kaava-suodattimella, samaan potential_projects-jonoon. (60f50b6)
- **Mikkeli**: kaavakuvaus luetaan julkaistun sivun `.entry-content`-alueesta
  kun WP-REST-rajapinta palauttaa tyhjän/otsikottoman sisällön. (d2859b5)
- **STT-yhtiölähteet** (Espoon Asunnot, Meijou, GRK, Jatke, Hartela, Skanska,
  Tekova): hankekuvaus poimitaan tiedotteen `metadescription`-kentästä.
  (c92d026, 6daeae7)
- **Hilma**: työmaan osoite/kaupunki poimitaan vapaasta kuvaustekstistä
  (deterministinen regex + LLM-varajärjestelmä). Hankintayksikön osoite ≠
  työmaan osoite. (ac8afc0)
- **Discovery-cron 6 h välein** (4×/vrk) aiemman kerran/yö sijaan; yksittäisen
  perustason lähteen häntäkierto ~35 pv → ~9 pv. (3d5c57b)

### Vanhojen / valmistuneiden hankkeiden suodatus

- **Vanha uutinen tekstin perusteella**: jos kuvauksessa on jo mennyt
  valmistumispäivä ("valmistuu … kesäkuussa 2025"), kandidaatti merkitään
  `recommended_action=ignore` eikä nouse tuoreena liidinä (keskitetty
  `resolvePotentialProject`iin, koskee kaikkia lähteitä). (bd1323d)
- **Vanha uutinen julkaisupäivän perusteella**: Puolustuskiinteistöjen
  uutislistauksesta suodatetaan yli 24 kk vanhat artikkelit (julkaisupäivä
  `article:published_time`-metasta). (1a084ff)
- **Pienet yksityiskohteet** (vapaa-ajan asunnot, mökit, autotallit ym.) pois
  TICistä sanavartaloihin perustuvalla suodattimella. (2a58af0)
- **Valmistuneet hankkeet** piilotettu julkisesta /projects-listasta ja kartasta.
  (d96d10d)

### Voittajat ja elinkaari

- **Hilman jälki-ilmoitukset (voittajat)** kerätään hyväksytyille
  kilpailutushankkeille → hankekortin "Mukana olevat yritykset" (voittanut
  urakoitsija, urakkasumma, saadut tarjoukset). (5f3b878)
- **Kilpailutuksen vanheneminen**: oletus 1 v ilmoituksesta; "Vanhenee"-päivä
  näkyy kortilla ja ehdokassivulla; hyväksynnässä valittava "aseta vanhenemaan
  vuoden kuluttua" -tick box pienille hankkeille. (f05f1b3, 0642613)
- **Kumulatiivinen lähdehistoria** (`metadata.source_history`) — hanke muistaa
  kaikki lähteet joista se on rikastunut.
- **Kuvausteksti-samankaltaisuus matcheriin**: eri lähteiden signaalit yhdistetään
  samaan hankkeeseen myös kuvaustekstin perusteella (merkkitrigrammit → Jaccard,
  kestää suomen taivutukset). Mahdollistaa mm. "Forssan datakeskus valmistui"
  -uutisen yhdistämisen olemassa olevaan hankkeeseen → hanke merkitään valmiiksi.
  Heikon tekstiosuman varmistus vaatii saman kaupungin/sijainnin/rakennuttajan.
  (4cc7b9e)

### AI / LLM

- **LLM-relevanssiportti** discovery-putkeen: harmaan alueen (`unclassified`)
  signaalit arvioidaan Haikulla, fail-open (ilman API-avainta ohitetaan).
  Seurantasivu TIC:issä (`llm_relevance_log`) + offline-eval. (5a16f0b, d66f94a,
  3b5d17b)
- Ks. koko LLM-käytön kuvaus: [`05_AI.md`](05_AI.md).

### TIC / käyttöliittymä

- **Discovery Sources**: sorttaus (tila/nimi/ajot/virheet/onnistuminen), "vain
  ongelmat" -suodatin, tila-sarake (🟢 ok / 🔴 rikki / ⚪ pois). Tarkoituksella
  pois kytketty lähde ei ole "ongelma". (0214eed, 19a2704)
- **Ajot-sivu**: ajon kesto vs. turvabudjetti, faktajonon syvyys per ajo,
  mobiilirullaus; kierroslaskenta huomioi 6 h -cronin (4 ajoa/vrk). (5fc3509,
  e530231, 56c088f, ba82950)
- **Rikastus-sivu**: listaa taustalla tapahtuvat hankkeiden rikastukset. (51f9ab8)
- **Ehdokkaan inline-muokkaus** ennen hyväksyntää (mm. Maakunta pudotusvalikkona).
  (0021ef6, ab682fb)

### Kartta

- **Karttamerkit klusteroitu** (`leaflet.markercluster`): ~3862 yksittäistä
  DOM-markeria → kymmeniä klustereita, popupit rakennetaan vasta avattaessa.
  Poisti tökkimisen tuhansilla hankkeilla. (69f0ada)
- **Haku: monisanaisuus + synonyymit** (`/projects`): hakusana pilkotaan sanoiksi
  (kaikkien osuttava, AND) ja jokainen laajennetaan synonyymeillä
  (`searchSynonyms.ts`, esim. konesali↔datakeskus, terveyskeskus↔sairaala).
  Nyt esim. "forssa data" löytää Forssan datakeskushankkeen. (ee8d6e2, 3902d94)

### Infra / laatu

- **Vitest-yksikkötestit + GitHub Actions -CI** (ajaa `npm install` + `npm test`
  pushissa). (df25bd1, b30e10a)
- **Faktaputken kestävyys**: yksittäisen faktan insert-virhe (esim. liian pitkä
  `fact_value` btree-indeksiin) ei enää kaada koko dokumenttia eikä jumita jonoa
  head-of-line-blokilla. (876c5bf)
- **Turbopack workspace-root** kiinnitetty (`turbopack.root`), korjaa
  `.claude/worktrees`-kopioiden aiheuttaman lockfile-sekaannuksen. (3b5d17b)

---

## Tunnetut käsityönä hoidetut asiat (ei vielä koodissa)

- **Duplikaattien yhdistäminen** on toistaiseksi käsityötä. Jos sama hanke
  päätyy kahdeksi (esim. geneerinen manuaalinen hanke + uusi lähteestä tullut,
  ilman yhteistä tunnistetta/osoitetta), ne eivät yhdisty automaattisesti.
  Yhdistettäessä on **säilytettävä se hanke jolla on käyttäjädataa** (suosikit
  `user_project_favorites`, omistajuus) — poistettavan hankkeen suosikit eivät
  seuraa mukana. Mahdollinen tuleva feature: "mahdollinen duplikaatti"
  -varoitus hyväksyntähetkeen (läheisyys + nimi/rakennuttaja).
