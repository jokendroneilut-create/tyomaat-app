# Työmaat.fi – Changelog

Merkittävät toiminnalliset muutokset teemoittain. Yksityiskohdat git-historiassa
(commit-tunnukset suluissa). Ylin = uusin.

Tämä tiedosto kattaa työn edellisen dokumentaatiopäivityksen (`a3aabc8`,
kaavakatalogi) jälkeen. Kuntakohtainen kaavalähteiden kattavuus on omassa
tiedostossaan: [`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md).

---

## 2026-08 (työ 7.8.)

### TIC:n koko sivupalkin tarkastus

Kaikki yksitoista kohtaa käytiin läpi kannasta asti. Putki itsessään osoittautui
terveeksi — 285 lähdettä, 392 ajoa seitsemässä vuorokaudessa, **nolla virhettä,
nolla seisonutta lähdettä** — mutta kolme seurantasivua kertoi väärää tarinaa ja
yksi jono oli kokonaan näkymätön.

**Terveiksi todetut:** Keräimet, Ajot, Health (`agent_jobs` 128 riviä, kaikki
onnistuneita), Kaksoiskappaleet (jono aidosti tyhjä). Tapahtumat käyttää samoja
palveluita kuin Keräimet, joten sillä ei ole omaa datalähdettä.

**Analytics näyttää historiaa nykytilana.** 10 547 ajosta 941 on virheitä (~9 %),
mutta **kaikki ovat ennen 28.7.** eikä viimeisen viikon aikana ole yhtään. Kaksi
syytä: 488 kertaa Postgresin btree-indeksin kokoraja (`index row size 2888
exceeds maximum 2704`) ja 452 kertaa HTML JSONin sijasta (Lupapiste 432, Hilma).
Molemmat lakkasivat itsestään. Sivu ei erottele aikaikkunaa, joten luku antaa
väärän kuvan.

**Katselmointijono on kaksi kolmasosaa YVA:a.** 103 ehdokasta 155:stä tulee
`yva`-lähteestä, ja 141:llä ei ole lainkaan luokittelua. Uusi AI-portti korjaa
tämän vain eteenpäin — se ajetaan luontihetkellä, ei jo jonossa oleville.

### Nimivertailu: yksi pitkä sana ja tiukempi vartalo

Lähtökohtana yksi ehdokas: Kansallismuseon uudisosan luovutusuutinen ei
tunnistanut jo olemassa olevaa hanketta "Kansallismuseon peruskorjaus ja
laajennus", vaikka kuvauksessa esiintyivät nimen **kaikki kolme sanaa** —
`kansallismuseolle`, `peruskorjauksen`, `laajennusosa`. Tulos oli 0 %.

Syy: `peruskorjaus` ja `laajennus` ovat geneerisiä sanoja ja karsitaan pois,
joten nimestä jäi yksi erottuva sana. Sääntö vaati kaksi ja palautti epätoden
katsomatta tekstiä lainkaan.

Korjauksen mittaus tuotantoa vasten paljasti **toisen, jo olemassa olleen
vian**: parhaaksi osumaksi koko kannasta tuli "Kansallisarkiston
peruskorjaus". Taivutusta verrattiin kuuden merkin yhteisellä alulla, joten
`kansallismuseolle` ja `kansallisarkiston` kelpasivat toisikseen.

Molemmat korjattiin, ks. [D-023](03_DECISIONS.md). Vaikutus 137 ehdokkaan
jonossa:

| | ennen | jälkeen |
|---|---|---|
| Kansallismuseo-pari | 0 % | **50 %**, paras osuma koko kannasta |
| Kansallisarkisto-vääräosuma | 50 % | 0 % |
| Rovaniemen pääpoliisiasema | osui virastotaloon | osuu oikeaan hankkeeseen |
| automaattiosumat | 11 | 7 |

Pari jää 50 %:iin eikä ylitä 70:n yhdistämiskynnystä, mutta ylittää 40:n eli
merkitään hyväksynnässä mahdolliseksi duplikaatiksi. Se on tarkoituksellista:
lehdistötiedotteen sulauttaminen olemassa olevaan hankkeeseen ilman ihmisen
katsetta on isompi riski kuin yksi ylimääräinen katselmointi.

Kolme paria (FIN04A Ph2, Mustasuo-Tynnyrikorpi, Sydänmaankylä) putosi
automaattiyhdistämisestä 45 %:n ehdotukseksi. Ne nojasivat samaan
vartalovuotoon: niiden kuvauksissa ei lue hankkeen nimeä, vain sukulaissana
(`tuulivoimapuisto` sanan `tuulivoimahanke` tilalla) — juuri se vuoto jonka
D-019 mittasi vääräksi.

### Näkymätön jono: 31 dokumenttia jumissa tunnistuksessa

Tunnistus ajettiin **vain heti faktapoiminnan perässä samassa
silmukkakierroksessa**. Jonoa "faktat poimittu, tunnistus kesken" ei ollut
olemassa, joten jos kierros katkesi siihen väliin — aikaraja, faktatyöläisen
virhe, uudelleendeploy — dokumentti jäi orvoksi eikä mikään palannut siihen
koskaan.

Ongelma ehti kasvaa **35 vuorokautta** koska jono oli näkymätön: dokumenttien
`status` oli `downloaded` kuten kaikilla muillakin, eikä yksikään sivu
erotellut niitä.

29 dokumenttia 31:stä oli tyhjiä — faktapoiminta oli oikein todennut ettei
"Kuulutus: Ajoneuvojen siirrot Espoossa" ole rakennushanke. Kahdella oli
oikeaa sisältöä, ja molemmat ratkesivat hankkeiksi asti: **7800 k-m²
kolmikerroksinen kulttuuritoimintarakennus Vantaalla** sekä talousrakennus.

Putkeen lisättiin kiinniottovaihe (ennen uusia faktoja, vanhin ensin, budjetti
5 per ajo) ja `pendingIdentity`-mittari paluuarvoon. Kaatuva dokumentti
merkitään käsitellyksi ja virheviesti jää talteen, jottei yksi rikkinäinen rivi
jumita jonoa ikuiseen silmukkaan. Ks. [D-022](03_DECISIONS.md).

### Kolmen seurantasivun korjaukset

Yhdistymiset, Rikastus ja AI-suodatus käytiin läpi kannasta asti. Kaksi
kolmesta oli rikki tavalla jota sivu itse ei paljastanut.

- **AI-suodatus näytti nollaa, koska portti ei ollut kytketty.**
  `llm_relevance_log` oli tyhjä koko olemassaolonsa ajan. Polku
  `runSource → saveSignal → scoreRelevance` oli olemassa, mutta `runSource`in
  ainoa kutsuja `/api/agent/run-source` oli itse kutsujaton: ei cronissa
  (`vercel.json`), ei käyttöliittymässä (TIC:in nappi menee reittiin
  `/api/tic/discovery/run-source`), eikä missään skriptissä. Reitti luki
  lisäksi poistetun putken `agent_sources`-taulua. Portti kytkettiin
  `resolvePotentialProject`in luontihaaraan (`gateCandidateRelevance`), jossa
  ehdokkaat oikeasti syntyvät. Ks. [D-021](03_DECISIONS.md).

- **16 väärää yhdistymistä purettiin.** Kaikki alle 80 %:n sumeat
  täsmäytykset käytiin läpi käsin: 17:stä yksi oli oikein. Loput olivat joko
  saman rakennuksen eri urakkalajeja (Rovaniemen pelastusaseman sähkö-, LVIJ-
  ja rakennusautomaatiourakka sulautuivat rakennusurakkaan) tai täysin eri
  hankkeita samassa kaupungissa ("Kampusrakennus Sivistyksen talo Lyyra"
  yhdistyi Rajakummun hautausmaan huoltorakennukseen). Purku poistaa
  `also_known_as`-aliaksen, irrottaa väärin linkitetyt tunnisteet ja palauttaa
  ehdokkaan katselmointijonoon (`scripts/unmerge-wrong-matches.ts`).

  Vahinko oli rajattu, koska hyväksyntä kirjoittaa muodossa
  `olemassaoleva ?? uusi` eikä ylikirjoita. Vakavinta oli **aliasten
  kertyminen**: väärä otsikko `also_known_as`-kentässä osuu seuraavaan
  vertailuun merkki merkiltä ja antaa 75 pistettä, eli yksi virhe ruokkii
  seuraavia. Sama otsikkopari puhtaana antoi 0 %.

- **Syy löytyi ja korjattiin: maantieteen kolminkertainen laskenta.**
  `same_location` + `same_city` + `same_region` = 45 + 20 + 8 = **73**, eli
  kaikki 16 väärää yhdistymistä olivat samaa pistesummaa. Maantiede
  pisteytetään nyt kerran, tarkimmalla tasollaan, ja katuosoite erotetaan
  aluenimestä talonumeron perusteella. Ks. [D-020](03_DECISIONS.md).
  Vaikutus samoihin 16 pariin: 16 → 6 → **4** yhdistyisi enää.

- **Urakkalajien tunnistus: pisin vartalo voittaa.** Vartalot ovat
  etuliitteitä, joten lyhyempi osui pidemmän alkuun: `vesikattourakka` alkaa
  vartalolla `vesi` (LVI) ja `vesikatto` (katto), jolloin se luokittui
  molemmiksi — eivätkä lajijoukot enää olleet erilliset, joten veto ei estänyt
  vesikatto- ja putkiurakan yhdistämistä.

  `LV` (lämpö-vesi) lisättiin omaksi vartalokseen: listalla oli vain `lvi`,
  joten `LV-työt` jäi kokonaan ilman lajia eikä veto voinut lauata — se vaatii
  lajin molemmilta puolilta. Mitattu kaksoiskappaleskannerista:
  "Puitejärjestely, LV-työt" ja "Puitejärjestely, rakennusautomaatiotyöt"
  saivat 95 %. Kaksikirjaiminen vartalo tarkistettiin tuotantodataa vasten:
  9651 nimestä vain kolme muotoa alkaa `lv`:llä ja kaikki ovat aitoja
  LVI-perheen nimityksiä.

  **Rakennusautomaatiourakka pysyy rakennusurakkana** — alan käytäntö,
  varmistettu testillä. Ensimmäinen yritys luokitteli sen sähköurakaksi, mikä
  oli väärin.

- **Rikastussivu on lähes tyhjä, ja se on totuudenmukaista.** 19
  `auto_sync`-tapahtumaa koko historiassa (vertailuksi `tic_approve` 3583),
  joista 11 tuli Rajukiveltä yhtenä päivänä. Rajukiven rikastuspolku katkesi
  kun lähde vaihdettiin `companyMentionCollector`iin, joka ei kirjoita
  `source_documents`-tauluun — tietoinen valinta, koska lähde tuotti 48
  hylättyä ehdokasta ja nolla hyväksyttyä.

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

### Hankkeen yritykset

- **Voittaja näkyviin listalta.** Karttasivun lista näytti vain nimen,
  kaupungin, maakunnan ja vaiheen, joten "Sopimus myönnetty" -suodatuksella
  selatessa piti avata jokainen hanke nähdäkseen kuka kilpailun voitti.
  Urakoitsija ja liittyvät yritykset näkyvät nyt nimen alla. (f9b1503)
- **Yhden kirjaimen urakoitsija.** Hilman `winner_organisations` on merkkijono
  ja `winners` siitä pilkottu taulukko; katselmointisivu luki merkkijonosta
  `[0]` eli ensimmäisen kirjaimen ("K" ← "Kuljetuspolar Oy"). Sama sääntö
  (`lib/projects/winnerName.ts`) molemmille kutsupaikoille. (f9b1503)
- **Raakamuotoiset urakoitsijalistat siistitty** — Hilman `//`-erotin näkyi
  sellaisenaan kortilla. 9 hanketta korjattu. (54c6fdf)
- **Hankekortti ei enää näytä tyhjiä rooleja.** Kiinteät rivit
  ("Rakennesuunnittelu: -", "LVIA-suunnittelu: -", …) korvattu yhdellä
  listalla "Hankkeeseen liittyvät yritykset", jossa on vain tiedossa olevat
  yritykset rooleineen. (69c9ec9)
- **Usean osaurakan voittajat talteen.** Kun samasta hankinnasta tuli monta
  voittajailmoitusta, vain ensimmäinen mahtui `builder`-sarakkeeseen ja loput
  jäivät näkymättä — pahimmillaan 1 näkyvä 4:stä (Kaukametsän
  kansalaisopisto, Kajaani). Voittajat kirjoitetaan nyt
  `metadata.related_companies`-kenttään kaikilla kolmella kirjoituspolulla,
  ja 69 vanhaa hanketta täydennetty. (69c9ec9, 6606cf7)

### Täsmäytyksen tarkennukset

Lähtökohta: yksittäinen ehdokas ("OYSin uuden L-talon rakentaminen alkaa")
ei saanut **yhtään pistettä** vaikka sama hanke oli kannassa. Syy ei ollut
matala pistemäärä vaan se, ettei yksikään todiste täyttynyt — jokainen eri
syystä. Kaikki kolme korjattu.

- **Rakennuttaja tunnistetaan samaksi eri kirjoitusasuissa.**
  "Pohjois-Pohjanmaan hyvinvointialue Pohde" ja "Pohjois-Pohjanmaan
  hyvinvointialueen (Pohde)" olivat eri toimijoita, joten rakennuttaja+kaupunki
  -todiste ei täyttynyt. Vertailu tehdään nyt sanajoukkona
  (`lib/projects/organizationName.ts`): y-tunnus ja yhtiömuoto pois, genetiivi
  puretaan, sanajärjestys ei vaikuta. Mitattu: 475 rakennuttajanimestä 33 paria
  tunnistetaan samaksi. (019a8c2, ks. [D-017](03_DECISIONS.md))
- **Kaupungiton ehdokas ei voi osua mihinkään.** 12 jonossa ollutta oli ilman
  kuntaa, kaikki stt_haku-lähteestä — sijainti oli otsikossa muodossa jota
  merkkijonohaku ei tunnista ("OYSin", "Ruovedelle", "Rissalan tukikohtaan").
  Sama poimija ja kahden äänen sääntö kuin maakuntatäydennyksessä: 9 ratkesi,
  0 erimielisyyttä, 3 jäi perustellusti tyhjäksi. (6f7e860)
- **Hankkeen nimi tunnistetaan toisen puolen kuvauksesta**
  (`name_in_description`). `descriptionSimilarity` vertaa kuvausta kuvaukseen,
  joten se ei auta kun toisella puolella on kuvaus ja toisella vain nimi —
  uutislähteellä on usein kuvaus mutta geneerinen otsikko, kilpailutuslähteellä
  täsmällinen nimi mutta ei kuvausta. Tarkistetaan molempiin suuntiin.
  (e63d303, ks. [D-019](03_DECISIONS.md))
- Yhdessä: jonon ehdokkaista **56 saa nyt ehdotuksen** (aiemmin muutama) ja
  17 osuisi automaattisesti. Kysytty tapaus nousi 0 → näkyviin katselmoijalle.
- **Työlista jonosta** (`scripts/report-queue-matches.ts`): ajaa saman
  täsmäytyksen kuin agentti ja jakaa jonon kolmeen nippuun (yhdistettävissä /
  tarkistettava / todennäköisesti uusi) linkkeineen. Ei muuta mitään — kertoo
  vain mitkä kortit kannattaa avata ensin. TIC laskee ehdotukset joka tapauksessa
  sivun latauksessa, joten uusi logiikka näkyy korteilla ilman ajoa.

**Tunnettu väärä osuma:** saman kunnan tuulivoimahankkeet muistuttavat
toisiaan sekä nimeltä että kuvaukseltaan, joten yhdistelmä `similar_title +
same_city + same_region + similar_description` voi ylittää 70:n eri hankkeilla
(mitattu: Tervakangas ja Tulijokila osuivat Ukonkankaaseen, kaikki Puolangalla).
Ei liity `name_in_description`-lisäykseen — vanhaa käytöstä, joka paljastui
vasta kun koko jono listattiin kerralla.

### Hankkeiden yhdistäminen

- **Työkalu kahden hankkeen yhdistämiseen**
  (`scripts/merge-duplicate-projects.ts`). Duplikaattinäkymä osasi vain merkitä
  parin ja piilottaa toisen, jolloin piilotettavan kuvaus, lähdehistoria ja
  käyttäjädata katosivat. Poistettavaa ei poisteta vaan piilotetaan, säilyvän
  arvot voittavat, ja poistuvan nimi tallennetaan `also_known_as`-kenttään
  jottei sama duplikaatti synny uudelleen. (8f87cf3,
  ks. [D-018](03_DECISIONS.md))
- Ajettu Espoonlahden parille: kaksi hanketta samasta kohteesta, syntyneet kun
  tallennettu otsikkomuoto muuttui ja täsmäytys putosi 75:stä 32:een. Skanneri
  ei olisi löytänyt paria (`similar_title + same_city + same_region` = 60, alle
  70:n laatuportin).
- **Yhdistetty hanke ei enää osallistu täsmäytykseen.** Piilotettu rivi sai yhä
  100 pistettä, jolloin rikastus olisi kirjautunut näkymättömälle hankkeelle.
  (019a8c2)

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

---

## 2026-07 (loppukuu, 29.–30.7.)

### Sijaintitieto — maakunta

Maakunta ratkaisee kenen syötteeseen hanke päätyy: `getTodayProjects` ja
digest-reitti suodattavat sen SQL-vertailulla, eikä NULL täsmää koskaan.
Maakunnaton hanke ei siis osu kaikkiin hakuvahteihin vaan **putoaa pois
kaikilta** jotka ovat valinneet maakuntansa.

- **Kunta päätellään myös tilaajan nimestä ja postitoimipaikasta.** Kunta jäi
  tunnistamatta aina kun ilmoituksessa ei ollut postinumerollista
  työmaaosoitetta. Uusi `lib/geo/municipalityFromName.ts`: "Janakkalan kunta"
  → Janakkala, genetiivi poikkeuslistalla ja vartalonmuutoksilla,
  postitoimipaikat jotka eivät ole kuntia (Turenki → Janakkala, Ivalo →
  Inari). Tilaajan nimi on vasta viimeinen keino, jotta oikea työmaakaupunki
  voittaa. Ajettu: 1080 → 255 puuttuvaa. (4490b77)
- **LLM-poiminta lopuille.** Merkkijonohaku ei riitä: kokeilussa Kuusankoski
  tulkittiin Kuusamoksi ja "Sonkakoti Oy" Sonkajärveksi. Kolme suojaa —
  vastaus validoidaan kuntarekisteriä vasten, tyhjä on hyväksytty tulos, ja
  backfill kysyy jokaisen rivin kahdesti hyväksyen vain yksimielisen
  vastauksen. Malli `claude-opus-5` tarkoituksella: Haiku 4.5 sijoitti
  ~12 % väärin (Kolmenkulma → Helsinki, Kimola → Jämsä). Ajettu: projects
  55 → 15, potential_projects 255 → 138. (842111d)
- **"Maakunta puuttuu" -merkintä TIC-listaan.** Maakunnaton ehdokas näytti
  jonossa samalta kuin muut, eikä hyväksynnän jälkeen palaa tarkistukseen.
  Käsin korjaaminen on tässä oikea ratkaisu: 105/138 maakunnattomasta oli
  hylättyjä, eli mallipäättely ingest-vaiheessa maksaisi pääosin hankkeista
  jotka päätyvät roskiin. (24b100c)
- Viisi käsin asetettua maakuntaa kirjattu
  [`docs/sql/2026-07-30_manual_region_fixes.sql`](sql/2026-07-30_manual_region_fixes.sql):ään.
  (1b4e6b1)

### Kaavavaiheiden korjaus (211 resolveria)

- **Kaavan lainvoima ei ole hankkeen valmistuminen.** Jokainen
  `mapXxxKaavaPhase` mäppäsi kaavan voimaantulon `completed`-vaiheeseen,
  joten kaavahankkeet katosivat näkyvistä valmistuneina. Kaavan
  valmistuminen on hankkeelle **aikainen** signaali — kaava valmis,
  rakentaminen voi alkaa. 211 tiedostoa. (30318b1)
- Kaavan hyväksyntä ei myöskään ole rakennuslupa (`permit` → `zoning`), eikä
  luonnos/ehdotus/OAS ole "Suunnittelu". Kaikki kaavan tilat kuuluvat
  Kaavoitus-vaiheeseen. (c300118, eb1914b)

### Tiiminäkymä

- **Perussuodatus ja /today-integraatio**, täysin opt-in eikä skeemamuutoksia:
  `teamModeInToday` (oletus off) ja `hideTeammateOwned` (oletus true).
  Kytkin näkyy vain tiimiin kuuluvalle. (254d45c)
- **Jakosuodattimet**: esihenkilö voi rajata jaettavaa poolia vaiheella ja
  avainsanalla. Jo vastuutetut hankkeet pysyvät koskemattomina. (d67bd28)
- **Kaksi 1000-rivin katkoa korjattu.** Hankehaku ja `project_assignments`
  haettiin ilman sivutusta: 1120 vastuutuksella 120 katosi "Omat"-näkymästä,
  ja katkaisujärjestys on määrittelemätön, joten juuri jaetut saattoivat
  pudota. (783b6f5, d67bd28)
- "Vapaa"-badge jakamattomille ja jäsenkohtainen suodatin jakaumasta.
  (09c6abc)
- Profiilinimet ihmisluettaviksi ("johannes.sippola" → "Johannes Sippola"),
  myös autoluonti-trigger uusille käyttäjille. (2b68c38, e186dd9)

### /today

- Onboarding: lähteet oletuksena kaikki päälle, myyntihetki pakolliseksi,
  todellinen aluemäärä. (d8cc0af)
- Kertaalleen näytettävä tervetuloesittely, versioitu localStoragessa; ei näy
  päällekkäin roolimodaalin kanssa. Mukana selitys peukuista, jotka opettavat
  näkymää. (f8eb71c, 323e901)
- **Valmistuneet pois syötteestä** — 68 hanketta oli `status=active` mutta
  `phase=Valmistunut`, joten Tänään näytti 4043 ja kartta 3975. Nyt molemmat
  3975. (057daba)

### Putken itsetyhjentyvyys

- **Faktajono jumissa 24:ssä**, koska fact_worker vain ohitti dokumentit joita
  se ei voi käsitellä eikä koskaan merkinnyt niitä valmiiksi. Terminaaliset
  dokumentit (kuvapohjainen PDF, sisällötön HTML-kuori) merkitään nyt
  valmiiksi. (791473c)
- **Sama kuvio ehdokkaissa**: auto-ohitetut jäivät ikuisesti `new`-tilaan,
  joten "suodatettiin pois automaattisesti" -kortti näytti koko heinäkuun
  kertymää. Nyt terminaalitila `ignored`, ja kortti näyttää 24 h. (ca0003f)

### Lähdeterveys

- **Onnistunut ajo tyhjentää virhetilan.** Itsestään korjautunut lähde näytti
  kymmeniä virheitä vaikka oli kunnossa. Historia säilyy
  `discovery_runs`-taulussa. (3081799)
- **Discovery Health**: kolmas kortti näytti `agent_jobs.pending`-lukua, joka
  on lepotilassa aina 0 — jono on olemassa vain ajon sisällä. Tilalle
  faktapoimintaa odottavat dokumentit + yli tunnin jumissa olleet työt.
  (6d8a013)
- **Marttila**: haku epäonnistui 7/8 ajossa. Syy ei ollut palomuuri vaan
  vajaa varmenneketju — sivusto lähettää osasta reunapalvelimia pelkän
  palvelinvarmenteen ilman välivarmennetta, joten TLS-kättely kaatuu
  Vercelin reitiltä mutta onnistuu Suomesta. Puuttuva välivarmenne haetaan
  nyt AIA-kentän osoitteesta kuten selaimet tekevät; ketjua ei ohiteta.
  (428fe90, dc2cca0)
- Kuollutta koodia pois Operations-sivulta, taulukoiden vaakavieritys
  korjattu mobiilissa. (28b7d18, f52ed68)

### Tietoturva ja kutsut

- **RLS**: 16 anon-avaimelle avointa taulua suljettu, työkalu ja SQL kirjattu
  `docs/sql/2026-07-30`-tiedostoihin. Funktioiden kovennus (Advisor WARN)
  dokumentoitu erikseen. (5cd198f, e86ae6b)
- **set-password mobiilissa**: Androidilla sivu ehti kutsua `updateUser`
  ennen kuin istunto oli hydratoitu evästeestä → "Auth session missing".
  Nyt odotetaan vahvistus ja yritetään `refreshSession()`. Koko kutsuketjun
  todistava `scripts/diag-invite.mjs` lisätty. (d4794a8)

---

## 2026-07 (alkukuu)

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
