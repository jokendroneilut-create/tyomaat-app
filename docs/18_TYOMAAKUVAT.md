# Työmaakuvat lähteenä — kokeiltava toimintatapa

**Tila: kokeilu, aloitettu 8.10.2026.** Mitattu 14 hankkeella
(Gemma + 13 hankkeen erä 8.10.2026, ks. "Ensimmäinen erä" alla).
Dokumentti on ohje kokeilun ajaksi, ei vakiintunut prosessi — päätös
jatkosta tehdään luvuilla, ei tuntumalla. Päätös: D-252.

**Kuva voi olla myös kuvakaappaus**: LinkedIn-julkaisu, Instagram-tili
tai video. Samat vaiheet pätevät; ero on siinä, että kyltissä on
yleensä hankekohtainen ihminen ja somejulkaisussa yleensä yhtiön
myynti tai viestintä.

## Miksi

**Yhteystiedot ratkaisevat palvelun tulevaisuuden.** Blueprintin §1.1
nimeää kolme syytä miksi testiasiakkaat eivät jääneet; kolmas on
*"liian vähän yhteystietoja — hanke ilman yhteyshenkilöä on
puolivalmis"*. Johannes 6.10.2026 (D-239): *"nyt aloitetaan
keskittyminen yhteyshenkilöihin toden teolla."* Tavoite on
**hankekohtainen** yhteyshenkilö, ei yrityksen yleinen (D-241), ja juuri
sitä verkosta on vaikein saada: verkkohaku löytää sen 36 %:lla hintaan
0,20 € (D-244). Työmaakuvat ovat tämän tavoitteen palveluksessa — ne
ovat paras yksittäinen tapa saada työmaan oma ihminen, ja samalla ne
kertovat mitä lähteitä puuttuu (§1.1:n syy 1, kattavuus).

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

Jokainen kuva käydään läpi samassa viidessä vaiheessa. Vaiheita ei saa
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

### 4. Kirjoita suoraan kantaan — jonoon vain epävarma kaksoiskappale

**Muutettu 8.10.2026 (D-252).** Ensimmäinen versio vei rivin jonoon,
koska "hyväksyntä on ihmisen". Johannes: *"Lisää hankkeet suoraan
kantaan koska ne ovat todellisia ja olemassa."* Kuvan tuoja on jo se
ihminen joka hyväksyy, joten jonokierros on kaksinkertainen työ — ja
hyväksyntäreitti tuotti Gemmassa kolme virhettä (D-249).

- **Puuttuu kannasta** → `projects` + `project_phase_history`
  (+ `project_identifiers` jos lupatunnus). `metadata.source:
  "tyomaakyltti"` tai `"kasin_kuvakaappaus"`, `resolver: "manual"`.
- **Löytyy kannasta** → täydennä vain puuttuvat kentät. Nimeä ei
  vaihdeta (kuvan nimi `also_known_as`-listaan), eikä käsin lisättyjä
  osapuolia korvata.
- **Löytyy useana rivinä** → älä yhdistä itse; pari
  `project_duplicate_candidates`-jonoon, kun aiempaa katselmointia ei
  ole (Kurkela–Kuusisto oli kolmena rivinä).
- **Henkilöt:** hankkeen omat `metadata.contact_persons`-listaan
  (`level: "project"`). Yrityksen yleiset johtajat (aluejohtaja,
  yksikön johtaja, toimitusjohtaja) `yritys_yhteyshenkilot`-rekisteriin
  (D-242). Viestintä, HSE, lakiasiat ja työhyvinvointi eivät ole
  ostajia — eivät rekisteriin.
- **Kuivaharjoitus ensin**, ja tuloste luetaan riveittäin. Erässä
  kuivaharjoitus paljasti kaksi keksittyä yksityiskohtaa (nimike jota
  kyltissä ei lukenut, väärä aluekoodi) ennen kirjoitusta.

### 5. Kysy miksi hanke puuttui — ja korjaa lähde

Tämä on vaiheista tärkein. Jokainen puuttuva hanke on vihje puuttuvasta
tai rikkinäisestä lähteestä (RPT-periaate). Jos julkaisija — myös
aliurakoitsija — kertoo saman asian omalla sivullaan eikä ole
`discovery_sources`-taulussa, se rakennetaan lähteeksi
(Kastelli/Kerava-malli: parseri, spec oikealla näytteellä,
kuivaharjoitus, `lisaa-*-lahde.ts`). Instagram ja LinkedIn eivät ole
lähteitä; yhtiön ajankohtaista- tai kohdesivu on.

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
  43 vuodelta 2025). ~~Syy jäi auki~~ — **selvitetty 8.10.2026**, ks.
  alla: Lupapiste-lähde aloitti 2.7.2026 eikä näe sitä vanhempia lupia.

## Ensimmäinen erä 8.10.2026: 13 hanketta

Seitsemän työmaakylttiä (Helsinki, Laajasalo–Herttoniemi) ja kuusi
kuvakaappausta (LinkedIn, Instagram, video).

### Kattavuus: 9/13 puuttui kannasta kokonaan

| | kyltit (7) | kuvakaappaukset (6) | yhteensä |
|---|---|---|---|
| puuttui kokonaan | 5 | 4 | **9** |
| oli, täydennettiin | 2 | 2 | 4 |

Kaikki neljä olemassa ollutta saivat jotain mitä kannassa ei ollut:
yhteyshenkilöitä, oikean osoitteen ja karttapisteen (Nihti osui
Helsingin keskustaan), pääurakoitsijan (Valurinpuisto) tai
aliurakoitsijan.

### Yhteyshenkilöt: kyltti antaa työmaan ihmisen

Tiukalla määritelmällä (nimi + puhelin tai sähköposti, D-239):

| mistä | hankkeita joilla hankekohtainen henkilö |
|---|---|
| kuvasta itsestään | 4/13 |
| kuva + verkkohaku samaan hankkeeseen | 8/13 |
| **työmaan oma ihminen** (vastaava tj / työmaapäällikkö / työpäällikkö), kyltit | **3/7 nimellä** + 1 numero ilman nimeä |

Ero kylttien ja kuvakaappausten välillä on laadullinen: kyltti antaa
**työmaan** ihmisen (Tencon, Pohjola, Skanska — vastaava työnjohtaja
suorine numeroineen), somejulkaisu ja verkko antavat **myynnin tai
johdon** (asuntomyyjä, toimitusjohtaja). Aliurakoitsijaa myyvälle
käyttäjälle edellinen on se joka ratkaisee.

### Lähteet: viisi korjausta yhdestä kävelystä

Jokainen puuttuva hanke kysyttiin "miksi". Vastaukset:

| syy | korjaus | mitä toi |
|---|---|---|
| Varten keräin hylkäsi uuden "Urakat"-tunnisteen | 771934f | LOAS Baletti ja jatkossa kaikki Varten urakat |
| Pääurakoitsijan omaa sivua ei luettu | VRJ lähteeksi (D-250) | 3 ehdokasta jonoon |
| Aliurakoitsijan sivua ei luettu | Torppari, Pelti-Ässät (D-250) | 12 ehdokasta jonoon (3 ohitettu) |
| Kaupungin vuokrayhtiön uudiskohdelistaa ei luettu | Heka (D-251) | 8 kohdetta, 5 uutta |
| Helsingin luvat ennen 2.7.2026 | **ei korjattavissa lähteellä** | ks. alla |

**Lupapisteen sokea piste.** Kuusi kuvattua Helsingin hanketta (Gemma +
viisi Laajasalosta ja Herttoniemestä) oli saanut luvan 2024–2025.
Lupapiste-lähde aloitti 2.7.2026, ja kuulutus poistuu verkosta
(muistio: vanhenevat lähteet). **Nyt rakenteilla olevat hankkeet ovat
juuri niitä joiden lupa on vanhempi kuin lähde** — eli tämä aukko ei
umpeudu itsestään ennen kuin nykyinen rakennuskanta on valmistunut.
Se on suurin yksittäinen syy siihen miksi kävelyllä löytyy puuttuvia
hankkeita, ja se kannattaa ratkaista erikseen (esim. Helsingin
rakennusvalvonnan karttapalvelu tai kunnan aloitusilmoitukset).

## Arvio: mitä tämä tapa on ja mitä se ei ole

**Se ei skaalaudu tiedonkeruuna.** Yksi ihminen, yksi kävely, 13
hanketta. Kannassa on ~5 500 hanketta; käsin ei kateta mitään
merkittävää osuutta.

**Se skaalautuu mittauksena.** Kävely on satunnaisotos todellisuudesta,
jota mikään lähde ei valikoi. 9/13 puuttuvaa kertoo kattavuudesta
enemmän kuin mikään sisäinen mittari, koska sisäinen mittari näkee
vain sen minkä lähteet jo tuovat. Ja jokainen puuttuva hanke johti
lähteeseen joka tuo **muitakin** hankkeita: lähdekorjaukset toivat
jonoon 15 ehdokasta ja Hekasta 5 uutta kohdetta, joita kukaan ei kuvannut.

**Ja se on paras saatavilla oleva yhteystieto.** Työmaan oma ihminen
kyltistä maksaa nolla ja on oikea. Mikään automaattinen lähde ei tuota
vastaavaa työnjohtajaa — paitsi kyltti itse.

Johtopäätös: käytä työmaakuvia **otoksena ja lähdeauditointina**, ja
pidä silmällä suhdelukua "puuttui kannasta". Kun se laskee selvästi
(esim. alle kolmannekseen), lähteet kattavat ja kävely voi harventua.
Jos käyttäjät joskus kuvaavat kylttejä itse, sama prosessi toimii —
mutta se on tuoteidea, ei tämän kokeilun tulos.

## Tietosuoja ja julkinen repo

Kyltissä on yksityishenkilön nimi ja puhelinnumero. Tieto saa mennä
kantaan — se on tuotteen tarkoitus — mutta **ei koskaan repoon**, joka
on julkinen. Skriptit jotka sisältävät yhteystietoja kirjoitetaan
työhakemiston ulkopuolelle, ja lisäys tarkistetaan ennen committia.
