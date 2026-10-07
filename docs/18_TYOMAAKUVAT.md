# Työmaakuvat lähteenä — kokeiltava toimintatapa

**Tila: kokeilu, aloitettu 8.10.2026.** Tätä ei ole vielä mitattu kuin
yhdellä hankkeella. Dokumentti on ohje kokeilun ajaksi, ei vakiintunut
prosessi — päätös jatkosta tehdään luvuilla, ei tuntumalla.

## Miksi

Työmaakyltti on lakisääteinen ja sisältää sen mitä verkosta ei saa:
**vastaavan työnjohtajan nimen ja suoran puhelinnumeron**. Sama tieto
maksaa verkkohaulla 0,20 € per hanke ja löytyy 36 %:n todennäköisyydellä
(`docs/05_AI.md`). Kyltti osuu kerralla ja maksaa nolla.

Ensimmäinen mitattu tapaus (As Oy Sompasaaren Gemma, Sompasaari,
8.10.2026): yksi valokuva tuotti hankkeen jota **ei ollut kannassa
lainkaan** — nimi, osoite, aikataulu, rakennuttaja, pääurakoitsija,
pääsuunnittelija, lupatunnus ja hankekohtainen yhteyshenkilö suorine
numeroineen.

## Toimintatapa

Jokainen kuva käydään läpi samassa neljässä vaiheessa. Vaiheita ei saa
yhdistää: tarkistus ennen lisäystä on se mikä estää kaksoiskappaleet.

### 1. Lue kyltti

Poimi kaikki mitä kyltissä lukee, myös se mitä et heti tarvitse:
hankkeen nimi, osoite(et), aikataulu, rakennuttaja, pääurakoitsija,
vastaava työnjohtaja yhteystietoineen, suunnittelijat, lupatunnus.

### 2. Tarkista kanta ennen kuin lisäät mitään

Hae **vähintään neljällä avaimella**, koska sama hanke voi olla kannassa
eri nimellä:

| avain | mistä |
|---|---|
| nimi | `projects.name` ja `potential_projects.title` |
| osoite | `projects.location` — molemmat osoitteet erikseen |
| lupatunnus | `metadata.permit_id` / `permit_number` |
| urakoitsija | `builder` ja `developer` |

Hae myös `source_documents`ista: jos asiakirja on, mutta hanketta ei,
vika on jäsennyksessä eikä lähteessä — eri korjaus.

### 3. Täydennä verkosta ja merkitse mistä mikin on

Kyltti on vahva lähde, verkko heikompi. **Älä sekoita niitä**: kirjaa
`metadata.tiedon_lahteet`, jossa on erikseen mitkä kentät tulivat
kyltistä ja mikä URL vahvistaa verkosta haetun.

Jokainen verkosta otettu väite tarvitsee **elävän** URL:n. Ensimmäisessä
kokeilussa kolme Oikotie-ilmoitusta oli jo poistettu (HTTP 410);
asuntomäärä varmistettiin etuovi.com-sivulta joka vastasi.

Jos lähdettä ei ole, kenttä jätetään tyhjäksi. Geneerinen kunnan
etusivu ei ole lähde — se näyttää lähteeltä olematta sellainen.

### 4. Vie jonoon, älä suoraan asiakkaalle

Rivi menee `potential_projects`iin tilaan `new`, `source: "tyomaakyltti"`,
`confidence: 95`. Kyltti on luotettava, mutta hyväksyntä on ihmisen —
sama sääntö kuin kaikilla muilla lähteillä.

## Mitä tarkistetaan hyväksynnän JÄLKEEN

Hyväksyntä kirjoittaa kentät uudelleen, eikä se aina osu. Ensimmäisessä
kokeilussa **kolme asiaa meni pieleen** (kaikki korjattu, D-249):

1. **Nimi.** "As Oy Sompasaaren Gemma" muuttui muotoon "Rakennushanke,
   &lt;osoite&gt;". Koodi on korjattu, mutta tarkista silti.
2. **Sijainti.** Hanke osui 3,2 km väärään paikkaan, koska `address`
   sisälsi kaksi osoitetta kauttaviivalla. **Anna vain yksi osoite**;
   toinen kuuluu kuvaukseen.
3. **Keksitty puhelinnumero.** Tekstipoiminta luki lupatunnuksen
   `LP-091-2025-08983` puhelinnumeroksi. Korjattu, mutta tarkista
   yhteystiedot.

Tarkistuslista hyväksynnän jälkeen: nimi, kartalla oikea paikka,
yhteystiedot, vaihe.

## Mitä kokeilusta pitää mitata

Päätös "jatketaanko" tehdään näillä, ei tuntumalla:

- **Montako kuvattua hanketta puuttui kannasta kokonaan?** Ensimmäinen
  otos: 1/1. Yksi hanke ei ole otos.
- **Montako tuotti hankekohtaisen yhteyshenkilön?** Vertailuluku on
  verkkohaun 36 %.
- **Mikä lähde olisi pitänyt poimia hankkeen?** Jokainen puuttuva hanke
  on vihje puuttuvasta tai rikkinäisestä lähteestä
  (`docs/06_KNOWLEDGE_LOG.md`, RPT-periaate). Gemman tapauksessa
  Helsingin rakennuslupa ei ollut tullut mitään lähdettä pitkin, vaikka
  Helsinki on Lupapisteen parhaiten katettu kunta (180 LP-091-mainintaa,
  43 vuodelta 2025). **Syy jäi auki** — se on kokeilun ensimmäinen
  avoin kysymys.

## Tietosuoja ja julkinen repo

Kyltissä on yksityishenkilön nimi ja puhelinnumero. Tieto saa mennä
kantaan — se on tuotteen tarkoitus — mutta **ei koskaan repoon**, joka
on julkinen. Skriptit jotka sisältävät yhteystietoja kirjoitetaan
työhakemiston ulkopuolelle, ja lisäys tarkistetaan ennen committia.
