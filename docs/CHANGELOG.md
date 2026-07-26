# Työmaat.fi – Changelog

Merkittävät toiminnalliset muutokset teemoittain. Yksityiskohdat git-historiassa
(commit-tunnukset suluissa). Ylin = uusin.

Tämä tiedosto kattaa työn edellisen dokumentaatiopäivityksen (`a3aabc8`,
kaavakatalogi) jälkeen. Kuntakohtainen kaavalähteiden kattavuus on omassa
tiedostossaan: [`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md).

---

## 2026-07

### Discovery – lähteet ja tiedonkeruu

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
