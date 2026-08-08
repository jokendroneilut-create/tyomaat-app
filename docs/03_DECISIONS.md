# Työmaat.fi – Päätökset (ADR-tyyliin)

Merkittäviä suunnittelupäätöksiä ja niiden perustelut, jottei niitä käydä
uudelleen läpi joka sessiossa. Ylin = uusin.

---

### D-029 – Löyhää hakua vastaan tarvitaan positiivinen sisältövaatimus
STT:n hakurajapinta on **kokotekstihaku eikä fraasihaku**, ja se on
relevanssijärjestetty. Hakusana `koulurakennus` palauttaa 181 osumaa joiden
otsikoissa lukee vain "koulu"; `päiväkoti` antaa 2269 osumaa joissa on
koiraturvallisuutta ja Ukrainan uutisia.

Kun sivutus korjattiin (ks. alla), tulos kasvoi 82 → 1855 mutta otoksesta
mitattuna **65 % oli kohinaa**. Tutkin ensin hypoteesin että aiempi katkaisu
olisi vahingossa toiminut relevanssisuodattimena — **mittaus ei tukenut sitä**:
kohina oli suunnilleen sama sijoilla 0–9, 10–29 ja 30–99. Ongelma ei ole
syvyys vaan haun löysyys.

Sääntö: **kun lähteen haku on löyhä, poissulkulista ei riitä.** Poissuljettavia
aiheita on ääretön määrä, toimialan sanastoa ei. Vaaditaan positiivinen osuma
rakentamiseen viittaavaan sanaan. Tulos 1855 → 780, kohina 65 % → 40 %.

Positiivinen lista on myös vaarallinen jos se on vajaa: ensimmäinen versio
pudotti Töölön kisahallin, koska listalla oli `peruskorja` muttei
`perusparann` — kuntien vakiotermi. Vika löytyi vain koska kisahallia
käytettiin nimettynä testitapauksena.

**Hakusanat ja sisältösignaalit ovat eri asia.** Hakusanat määräävät mitä
lähteestä *haetaan*, signaalit mitä *säilytetään*. Signaalilistalla oleva sana
ei tuo yhtään uutta tiedotetta — tämä sekaantui kerran, kun `purkutyö` ja
`investoi` olivat vain signaaleissa ja näyttivät siltä että ne olisi katettu.

**Sivutusparametrit selvitetään kokeilemalla, ei olettamalla.** Poimija pyysi
`count=20` ja uskoi saavansa 20. Rajapinta ei tunne `count`-parametria
lainkaan, joten se ohitettiin hiljaa ja vastauksena tuli oletusmäärä 10 —
0,7 % siitä mitä `totalCount` lupasi. Toimivat parametrit ovat `size` ja
`page`. Sama vikaluokka kuin D-026:ssa: pyyntö onnistuu, vastaus näyttää
täydeltä.

### D-028 – Valmistumista ei päätellä menneestä aikamuodosta
Hankkeen valmistumista **ei voi päätellä kuvaustekstistä**. Mitattu 4412
julkisesta hankkeesta: sana "valmistui"/"valmistunut" esiintyi 69:llä, ja
tiukennuksen jälkeen (pois asiakirjat, viereiset rakennukset, vanhat
vuosiluvut molemmin puolin sanaa) jäljelle jäi 12 — joista **yksikään ei
koskenut hanketta itseään**. Ne kertoivat purettavasta vanhasta rakennuksesta,
valmistuneesta kaavaselvityksestä tai naapurirakennuksesta, tai olivat
konditionaaleja tulevaisuudesta ("valmistuisi syksyllä 2029").

Siksi `parseEstimatedCompletionDate` hyväksyy vain **tulevan aikamuodon**
(`valmistuu`, `valmistuva`, `valmistumassa`) eikä koskaan mennyttä. Rajaus on
tarkoituksellinen, ei puute — ilman tätä merkintää joku lisää `valmistui`-muodon
takaisin hyvässä uskossa.

Käyttökelpoinen signaali on siis **arvioitu valmistumisaika**, ei todettu
valmistuminen. Arvio + aika riittää, koska `auto-complete-projects`-cron
siirtää hankkeen valmistuneeksi vasta kun päivä on mennyt. Varmennettu
valmistuminen (loppukatselmus) vaatisi rakennusrekisterin, joka ei ole avointa
dataa; Lupapisteen julkipano ei kelpaa, koska se julkaisee päätöksiä eikä
katselmuksia eikä julkaise lupaa uudelleen tilan muuttuessa (mitattu: 366
lupatunnusta, 0 tilanmuutosta).

Vuodenaika arvioidaan aina kauden **viimeiseen** kuukauteen. Liian aikainen
arvio piilottaisi käynnissä olevan hankkeen asiakkailta, koska valmistuneet
suodatetaan listasta ja kartalta.

### D-027 – Kuvaukseton ehdokas on hylätty ehdokas
Mitattu koko kannasta, ja korrelaatio on jyrkkä:

| lähde | ehdokkaita | ilman kuvausta | hylätty |
|---|---|---|---|
| srv | 291 | 100 % | **96 %** |
| mangrove | 91 | 100 % | 100 % |
| lujatalo | 72 | 100 % | 93 % |
| pohjola_rakennus | 75 | 100 % | 73 % |
| stt_haku | 240 | **0 %** | 61 % |
| yva | 123 | **0 %** | 2 % |

Pelkän otsikon perusteella korttia ei voi arvioida, joten se hylätään. Lähteen
"laatu" ei siis ollut se mitä hylkäysaste mittasi — se mittasi poimijan
puutetta. Tämä on syytä muistaa ennen kuin jokin lähde suljetaan huonona:
**tarkista ensin tuottaako se kuvauksen.**

Käytännön sääntö poimijoille: jos runko tai ote lasketaan avainsanasuodatusta
varten, se on myös palautettava. Neljässä poimijassa se oli laskettu ja
heitetty pois — data oli jo haettu, joten kuvaus ei maksanut yhtään
lisäpyyntöä. Sama vika oli aiemmin mangrovessa (ks. 7.8.).

### D-026 – Sivutettu haku, kun aineisto on lähteen päätettävissä
YVA-haku pyysi 150 uusinta osumaa ja luotti siihen että se kattaa 18 kuukauden
tuoreusikkunan. Aineistossa on **1337 hanketta**, joten 150 riitti vain kolmeen
kuukauteen: `RECENCY_MONTHS = 18` oli kuollutta koodia ja 3–18 kuukauden
ikäiset hankkeet jäivät kokonaan hakematta. Juuri se ikkuna on lähteen koko
arvo — YVA on varhaisin signaali, vuosia ennen kilpailutusta.

Vika oli näkymätön, koska haku onnistui joka kerta ja palautti täydeltä
näyttävän tuloksen. Sääntö: **kun aineiston koko on lähteen päätettävissä,
kiinteä `size` on hiljainen katkaisu.** Sivutetaan kunnes sivun vanhin osuma
ylittää tuoreusrajan, ja pidetään yläraja turvaventtiilinä.

Sama pätee PostgRESTin 1000 rivin kattoon, joka on tässä koodikannassa
toistunut vika: molemmissa kysely onnistuu ja vastaus näyttää oikealta.

### D-025 – Ajastetun työn ikkuna on pidempi kuin ajoväli
Duplikaattiskannauksen inkrementaalinen ajo vertasi viimeisen **7 päivän**
aikana luotuja tai päivitettyjä hankkeita, ja cron ajoi **7 päivän** välein.
Ikkuna ja ajoväli olivat identtiset, eli päällekkäisyyttä ei ollut lainkaan:
yksi väliin jäänyt ajo — deploy, aikaraja, cron-häiriö — jätti sen viikon
hankkeet (169 uutta + 212 päivittynyttä) pysyvästi skannaamatta, koska mikään
ei palaa taaksepäin.

Sama vikaluokka kuin D-022:ssa, eri paikassa. Sääntö: **ajastetun työn ikkuna
mitoitetaan niin että peräkkäiset ajot menevät päällekkäin.** Päivittäisellä
ajolla sama 7 päivän ikkuna antaa seitsenkertaisen redundanssin, ja hinta on
olematon — kaupunkiryhmittelyn jälkeen ajo kestää 5,9 s.

Perustelu asuu reitin kommentissa, koska `vercel.json` ei salli kommentteja.

### D-024 – Eri numero nimessä rajoittaa, ei estä
Kaavoituksessa ja katuosoitteissa numero on identiteetti: "Vellamonkatu 11" ja
"Vellamonkatu 8" ovat eri tontti, "295 Pereen asemakaavan muutos" ja "289
Pereen asemakaavan muutos" eri kaava. Täsmäytys ei nähnyt tätä lainkaan, koska
`titleWords` pudottaa alle neljän merkin sanat — "11", "8", "295" ja "XVI"
katosivat ennen vertailua ja nimistä jäi jäljelle täsmälleen sama sanajoukko.
Mitattu täydestä skannauksesta: 65 katselmoitavasta parista 48 oli kaavapareja
ja **34:llä numero erosi**.

Vaikutus on **rajoittava, ei estävä** — tässä poiketaan tarkoituksella
[contractTrade](../lib/projects/contractTrade.ts):n vetosta, joka nollaa
osuman. Varmuus painetaan 65:een eli yhdistämiskynnyksen alle, jolloin pari
jää ihmisen katsottavaksi. Numero ei nimittäin aina ole tunniste:
uutisotsikossa voi lukea "48 asuntoa" ja toisessa lähteessä "50 asuntoa"
samasta hankkeesta. Lupanumero ja kiinteistötunnus voittavat säännön, koska ne
ovat suoraa todistetta samasta kohteesta.

Kolme yksityiskohtaa jotka ratkaisivat mitatut tapaukset:

- **Vertailu koko joukkona, ei leikkauksena.** "Asemakaava 853 14/2021" ja
  "853 5/2021" jakavat numerot 853 ja 2021 mutta ovat eri kaava.
- **Molemmilla on oltava numeroita.** Vain toisessa oleva on yleensä
  tarkennus: "Oulun elämysareena ja ympäristö, Rata-aukio 2" vs "Oulun
  elämysareena".
- **Sanan sisäistä numeroa ei poimita**, jottei "FIN04A" tai "Ph2" pilkkoudu.

### D-023 – Taivutusvertailu suhteellisena, ei kiinteänä merkkimääränä
`nameWithinText` salli taivutuksen kuuden merkin yhteisellä alulla. Lyhyille
sanoille se on tiukka, pitkille yhdyssanoille aivan liian löyhä:
`kansallismuseolle` ja `kansallisarkiston` jakavat alun "kansal" ja kelpasivat
toisikseen. Mitattu tuotannosta — Kansallismuseon uutisen paras osuma koko
kannasta oli Kansallisarkiston peruskorjaus.

Yhteisen alun on nyt katettava **70 % pidemmästä sanasta**. Suhteellinen mitta
on oikea, koska taivutuspääte on lyhyt suhteessa vartaloon: aito pari ylittää
rajan helposti (`kansallismuseon`/`kansallismuseolle` = 14/17), eri sanat
jäävät alle (`kansallis` = 9/17). Sama raja pudottaa myös D-019:ssä mitatun
vuodon `tuulivoimahanke`/`tuulivoimapuisto` = 10/16.

Hinta on kirjattava: kolme jonon paria putosi automaattiyhdistämisestä
ehdotukseksi, koska ne nojasivat juuri tuohon vuotoon. Ne näkyvät yhä 45 %:n
ehdotuksina, eli ihminen päättää.

**Yksi erottuva sana riittää, jos se on pitkä ja loput nimestä löytyvät.**
Geneeristen sanojen karsinta (`titleWords`) jätti nimestä "Kansallismuseon
peruskorjaus ja laajennus" vain yhden sanan, jolloin `NAME_IN_TEXT_MIN_WORDS`
= 2 kieltäytyi katsomasta tekstiä lainkaan — vaikka kuvauksessa esiintyivät
nimen kaikki kolme sanaa. Nyt yhden sanan nimi kelpaa kun sana on ≥ 12
merkkiä, nimessä on muutakin, ja tekstistä löytyy nimen jokainen sana myös
geneeriset mukaan lukien. Karsittu sana on huono todiste yksin mutta hyvä
vahvistus sille joka kantaa merkityksen. Pituusraja erottaa
`kansallismuseon` (15) sanasta `koulun` (6).

### D-022 – Jokaisella putken vaiheella on oma jono, ei vain edeltäjän paluuarvo
Tunnistus (`runIdentityWorker`) ajettiin vain heti faktapoiminnan perässä
samassa silmukkakierroksessa: `if (result.ok && result.documentId)`. Se toimii
niin kauan kuin kierros menee loppuun, mutta **vaihe ilman omaa jonoa ei voi
toipua mistään**. Kun kierros katkesi väliin — aikaraja, faktatyöläisen virhe,
uudelleendeploy — dokumentille jäi `facts_extracted_at` mutta ei
`identity_resolved_at`, eikä mikään palannut siihen koskaan.

Mitattu: 31 dokumenttia jumissa, vanhin 35 vuorokautta, ja kahdella niistä oli
oikeaa sisältöä joka ei päätynyt minnekään.

Sääntö: **vaiheen kelpoisuusehto luetaan kannasta, ei edellisen vaiheen
paluuarvosta.** Kiinniotto ajetaan ennen uutta työtä (vanhin ensin), jotta jono
purkautuu eikä kasva ohi, ja jonon pituus palautetaan mittarina — muuten sama
vika on taas näkymätön, koska dokumentin `status` pysyy `downloaded` kuten
kaikilla muillakin.

Kaatuva dokumentti merkitään käsitellyksi ja virheviesti jää talteen. Muuten
yksi rikkinäinen rivi jumittaisi jonon ikuiseen silmukkaan — vanhin ensin
-järjestys takaisi että se valitaan joka kierroksella uudelleen.

### D-021 – AI-relevanssiportti kytketään ehdokkaan luontiin, ei signaaliin
Portti (`llmRelevanceScorer`) oli rakennettu mutta ei kytkettynä: ainoa kutsuja
oli `lib/agent/pipeline/runSource.ts`, jota kutsui vain `/api/agent/run-source`
— reitti jolla ei ollut yhtään kutsujaa (ei cronissa, ei käyttöliittymässä) ja
joka luki vanhaa `agent_sources`-taulua. `llm_relevance_log` oli siksi tyhjä ja
TIC:in AI-suodatus-sivu näytti nollaa koko olemassaolonsa ajan.

Portti kytkettiin sinne missä ehdokkaat oikeasti syntyvät:
`resolvePotentialProject`, luontihaaraan. **Vain uusille ehdokkaille ja vain
kun sääntö ei sanonut mitään** (`recommended_action` puuttuu) — olemassa
olevalle ehdokkaalle päätös on tehty kertaalleen, eikä samaa otsikkoa kannata
kysyä uudelleen jokaisella lähdesignaalilla.

Portti voi vain **suodattaa jonon ulkopuolelle, ei koskaan hyväksyä
julkiseksi**. Suunta on tarkoituksellinen: väärä suodatus piilottaa yhden
liidin, väärä hyväksyntä veisi roskaa käyttäjille asti. Fail-open kauttaaltaan.

### D-020 – Maantiede pisteytetään kerran, tarkimmalla tasollaan
`same_location` (45) + `same_city` (20) + `same_region` (8) laskettiin yhteen,
jolloin yksi ja sama todiste laskettiin kolmesti: sijainti sisältää kaupungin,
kaupunki sisältää maakunnan. Summa 73 ylitti 70:n yhdistämiskynnyksen **ilman
minkäänlaista todistetta samasta hankkeesta**. Mitattu: 16 väärää yhdistymistä
sai täsmälleen 73 pistettä.

Nyt pisteitä annetaan vain tarkimmalta osuneelta tasolta. Katuosoite (60) ja
aluenimi (30) erotetaan toisistaan talonumeron perusteella: "Mannerheimintie
14" osoittaa yhden rakennuksen, "Kruunuvuorenranta" on kaupunginosa jossa on
kymmeniä hankkeita. Kumpikaan ei yksin riitä 70:een, joten sijainti tarvitsee
aina tuekseen otsikko-, rakennuttaja- tai kuvaustodisteen.

Syyt (`reasons`) kirjataan edelleen kaikilta tasoilta, koska todisteportti ja
duplikaattiskannerin laatuvaatimus lukevat niitä.

### D-019 – Tekstivertailu sanoina, ei trigrammeina, kun kyse on nimestä
Nimen etsiminen kuvauksesta (`name_in_description`) toteutettiin ensin
merkkitrigrammien sisältyvyydellä, koska trigrammit kestävät suomen taivutusta
ja `descriptionSimilarity` käyttää niitä. **Se ei toimi nimille.**

Suomen yhdyssanat vuotavat toisiinsa: "tuulivoimahanke" sisältyy lähes
kokonaan tekstiin jossa lukee "tuulivoimapuisto", ja "datakeskus" mihin tahansa
datakeskusuutiseen. Mitattuna tuotantoa vasten 37 osumasta selvästi yli puolet
oli vääriä — "Kotaselän tuulivoimahanke" osui hankkeeseen "Asemakeskus" — ja
yksi väärä ylitti 70:n eli olisi yhdistynyt automaattisesti.

**Päätös:** nimivertailu tehdään kokonaisina sanoina. Taivutus sallitaan vain
vartalon alusta (6 merkin yhteinen alku molempiin suuntiin), geneeriset sanat
pudotetaan ja vaaditaan vähintään kaksi erottelevaa sanaa joista 70 % löytyy
tekstistä. Trigrammit jäävät sinne minne ne sopivat: kahden pitkän
kuvaustekstin vertailuun, jossa yksittäisen sanan vuoto ei ratkaise.

Mitattu korjatusta versiosta: 42 osumaa, väärät jäävät 58 pisteeseen eli alle
70:n kynnyksen — ne näkyvät ehdotuksina mutta eivät yhdisty automaattisesti.

**Uusi todistesyy on lisättävä kaikkiin listoihin jotka luettelevat syitä
nimeltä**: `hasTextEvidence`, `onlyWeakText`, duplikaattiskannerin laatuportti
ja käyttöliittymän kaksi `REASON_LABELS`-listaa. Tämä on unohtunut kahdesti
(`exact_distinctive_title`), ja molemmilla kerroilla seuraus oli että
täsmäytys lakkasi toimimasta hiljaisesti. `name_in_description` jätettiin
tarkoituksella pois skannerin portista — perustelu on kirjattu koodiin.

### D-018 – Yhdistetty hanke piilotetaan, ei poisteta
Duplikaattien yhdistämisessä poistuva rivi voisi houkutella poistettavaksi,
mutta siihen viittaa käyttäjädataa (suosikit, vastuutukset), tuontitapahtumia
ja vaihehistoriaa. **Päätös:** poistuva rivi merkitään `is_public = false` ja
saa `metadata.merged_into_project_id`-osoittimen säilyvään; säilyvä saa
`merged_from_project_ids`. Sama tapa kuin duplikaattinäkymän "Piilota tämä",
joten päätös on peruttavissa eikä historia katoa.

Kolme sääntöä yhdistämisessä:
- **Säilyvän arvot voittavat aina**, poistuvalta täydennetään vain tyhjät.
  Nimeä, kaupunkia, maakuntaa ja vaihetta ei kosketa — ne ovat säilyvän
  identiteetti, ja vaiheen siirtäminen ohittaisi D-013:n.
- **Poistuvan nimi tallennetaan `also_known_as`-kenttään**, jota matcher lukee.
  Ilman sitä saman uutisen toinen otsikkomuoto synnyttäisi duplikaatin
  uudelleen — juuri niin Espoonlahden pari syntyi.
- **Vastuutusta ei siirretä jos säilyvällä on jo omistaja.** Hankkeella on yksi
  vastuullinen, eikä skripti valitse ihmisten välillä; se on esihenkilön päätös.
  Poistuvan vastuutus poistetaan ja tieto jää metadataan.

Yhdistetty rivi rajataan pois täsmäytyksestä (`loadProjectsForMatching`),
muuten rikastus kirjautuisi näkymättömälle hankkeelle.

### D-017 – Rakennuttajaa verrataan organisaationimenä, ei merkkijonona
Sama organisaatio kirjoitetaan lähteissä eri tavoin: genetiivi, sulkeissa oleva
lyhenne, yhtiömuoto, y-tunnus. Merkkijonovertailu piti niitä eri toimijoina, ja
koska rakennuttaja+kaupunki on yksi neljästä hyväksytystä todisteesta, osuma
saattoi jäädä kokonaan syntymättä. Mitattu tapaus: "Pohjois-Pohjanmaan
hyvinvointialue Pohde" vs "Pohjois-Pohjanmaan hyvinvointialueen (Pohde)" —
ehdokas ei saanut yhtään pistettä.

**Päätös:** vertailu sanajoukkona (`lib/projects/organizationName.ts`).
Y-tunnus ja yhtiömuoto pudotetaan, genetiivi puretaan, sanat järjestetään.
Sanajärjestys ei siis vaikuta eikä sulkeissa olevan lyhenteen tarvitse olla
suluissa.

**-nen-loppuisia ei typistetä.** "Virtanen" ei ole genetiivi, ja sen purkaminen
sekoittaisi eri yritykset. Sama periaate kuin muualla täsmäytyksessä: väärä
yhdistäminen on pahempi kuin osumatta jäänyt, koska ihminen näkee osumattoman
ehdokkaan jonossa mutta ei väärin yhdistettyä.

### D-016 – Vanhat lähteet ajetaan discovery-putken kautta adapterilla
`lib/agent/sources.ts`:n 34 fetcheriä ajettiin omalla mekanismillaan, jossa
kierron aloituskohtia oli vain kaksi ja ajo kuoli aikaan ennen listan loppua:
viisi viimeistä lähdettä ei ollut päässyt kertaakaan vuoroon. Vaihtoehdot
olivat (A) kirjoittaa fetcherit discovery-kerääjiksi tai (B) adapteri joka
kutsuu niitä sellaisenaan. **Päätös: B.** Fetcherit toimivat, ja niiden
uudelleenkirjoitus olisi ollut riski ilman hyötyä — ongelma oli ajastuksessa,
ei poiminnassa. Ne ovat nyt `discovery_sources`-taulussa
(`collector = legacyFetchCollector`), saavat per-lähde ajastuksen ja
virheseurannan kuten muutkin. **`lib/agent/sources.ts` ei ole vanhentunut
eikä sitä saa poistaa** — adapteri käyttää sitä; vanhentunut oli vain putki
sen ympärillä, ja se on poistettu.

### D-015 – Duplikaattivertailu rajataan laatuportin omilla avaimilla
Skannaus vertasi jokaista muuttunutta hanketta koko julkiseen joukkoon:
1,57 miljoonaa vertailua ja 358 sekuntia, kun reitin `maxDuration` on 60 —
viikkocron ei ehtinyt kertaakaan loppuun, eikä sitä huomattu koska tyhjä
tulos näytti samalta kuin kaatunut ajo. Laatuportti hyväksyy parin vain jos
sillä on sama lupanumero tai kiinteistötunnus, TAI nimitodiste JA sama
kaupunki. Eri kaupungeissa olevien, tunnisteettomien hankkeiden vertailu ei
siis voi koskaan tuottaa ehdokasta. **Päätös:** vertailujoukko rajataan
näiden kolmen avaimen ryhmiin (`comparisonBuckets.ts`) → 37 598 vertailua,
7 s. Ryhmittely käyttää samoja normalisointifunktioita kuin `calculateMatch`,
jottei se voi ajautua matcherista erilleen. Todennettu 79 kirjattua paria
vastaan: 78 säilyy, ja se yksi joka putoaa ei tuota nykydatalla osumaa
muutenkaan. Jos laatuporttia joskus löysätään, tämä rajaus on päivitettävä
samalla.

### D-014 – Vanhentunut kilpailutus palaa aktiiviseksi kun voittaja selviää
Kilpailutus vanhenee vuosi tarjousten määräajasta (`status = expired`), mikä
piilottaa sen kartalta, /today-näkymästä ja tiimilistalta. Jos voittaja
selvisi vasta sen jälkeen, hanke rikastui oikein mutta jäi piiloon — eli
piiloon jäi juuri se hetki joka on myyjälle arvokkain. **Päätös:** voittajan
ratkeaminen palauttaa hankkeen aktiiviseksi (`shouldUnexpire`), koska se on
tuore tapahtuma riippumatta siitä milloin tarjouspyyntö julkaistiin.
Vastakkainen kanta (kaksi vuotta vanha kilpailutus on vanhaa uutista) on
puolustettavissa, mutta hankkeen vaihe kertoo lukijalle loput.

### D-013 – Vaihe saa vain edetä, ei peruuttaa
`syncApprovedProject` on aina estänyt vaiheen peruuttamisen, mutta agentin
tuonti kirjoitti saman kentän ehdoitta. Vanha uutinen tai suunnitteluvaiheesta
kertova tiedote siirsi käynnissä olevan työmaan takaisin suunnitteluun:
mitattuna 4 vrk:n ikkunassa 29 kertaa 32 aidosta vaihesiirtymästä, ja
agentti kumosi kaikkien kolmen muun päätöslähteen tuloksen (ihmisen
hyväksyntä, auto_sync, käsin tehty korjaus). **Päätös:** yksi sääntö
(`phaseAdvances` tiedostossa `lib/projects/phases.ts`) molemmille reiteille.
Tuntematon tai järjestyksetön vaihe (esim. "Peruttu") ei ohita nykyistä,
koska emme voi tietää onko se edistys.

**Sivuhavainto:** kannassa on kaksi vaiheen esitystapaa — `projects.phase` on
otsikko ("Rakenteilla"), `project_phase_history.phase` on avain
("construction"). `normalizeLegacyPhase` hyväksyy nyt molemmat; aiemmin
avaimella kutsuttu vertailu palautti hiljaa nullin.

### D-012 – Tontinluovutukset jätetty väliin (ei siistiä lähdettä)
Selvitetty kilpailija-aukkona: ei kansallista eikä siistiä kaupunkikohtaista
rajapintaa. Helsingin `tontit.hel.fi` on poistettu, ja tonttiasiat ovat nyt
yleisissä päätösjärjestelmissä (`paatokset.hel.fi` ym.) yksittäisinä
pöytäkirjoina kaiken muun seassa — signaali/kohina huono, rakennuttajan/tontin
louhinta epäluotettavaa, ja tieto hajallaan joka kaupungissa erikseen. Menee
myös päällekkäin kaavan (jo poimitaan) ja rakennuslupien kanssa. **Päätös:**
kohiseva päätös-scraperi haittaisi TIC-jonoa enemmän kuin hyödyttäisi → ei
rakenneta ennen kuin löytyy siisti, korkean signaalin lähde.

### D-011 – Varhaisen vaiheen lähteet kilpailija-aukon sulkemiseen
Metroc/RPT Smart poimivat isot hankkeet aikaisin. Aukon sulkevat lähteet jotka
osuvat hankkeen KAIKKEIN aikaisimpaan julkiseen signaaliin, ennen rakennuslupaa
ja urakkakilpailutusta: **YVA** (ympäristövaikutusten arviointi — suurimmat
energia-/teollisuus-/infrahankkeet), **ympäristölupa** (isot yksityiset
laitokset ilman julkista kilpailutusta, esim. datakeskukset) ja
**suunnittelukilpailu** (SAFA — merkittävät julkiset rakennukset konseptivaiheessa,
myös Hilman ulkopuoliset kutsukilpailut). Kriteeri uudelle lähteelle: korkea
signaali/kohina ja aikaisempi vaihe kuin nykylähteet — ei volyymi volyymin
vuoksi (vrt. [D-012]).

### D-010 – Duplikaatteja yhdistettäessä säilytä hanke jolla on käyttäjädataa
Suosikit (`user_project_favorites`) ja omistajuus viittaavat `project_id`:hen.
Jos yhdistettäessä poistetaan väärä hanke, käyttäjien suosikit eivät seuraa
uuteen kopioon (eri id) — ne katoavat/roikkuvat. **Sääntö:** säilytä se hanke
johon käyttäjät ovat koskeneet; jos suunta on toinen, siirrä `user_project_favorites`
(ja muu project_id-viitteinen data) säilyvälle ennen poistoa.

### D-009 – Tarkoituksella pois kytketty lähde ei ole "ongelma"
Discovery Sources -taulussa "ongelma" = oikeasti rikki (virheitä). Pois
kytketty (`enabled=false`) lähde on eri tila (⚪ pois), ei punainen ongelma.
Esim. vanha Helsingin WFS jätettiin pois-tilaan SUKKAn varalle — se ei saa
näyttää ongelmalta.

### D-008 – Vanhat uutiset kahdella riippumattomalla mekanismilla
Uutispohjaiset lähteet tuovat vanhoja, jo valmistuneita hankkeita. Suodatus:
(1) **teksti** — mennyt valmistumispäivä kuvauksessa → `recommended_action=ignore`
(keskitetty `resolvePotentialProject`iin); (2) **julkaisupäivä** — yli 24 kk
vanha artikkeli (esim. Puolustuskiinteistöt) käsitellään kuin valmistunut.
Kahta tarvitaan, koska osa uutisista ei mainitse päivää tekstissä ja osalla ei
ole luotettavaa julkaisupäivää.

### D-007 – Discovery-cron 6 h välein (4×/vrk)
Kerran/yö -ajolla yksittäisen lähteen häntäkierto oli ~35 pv (250 lähdettä ÷
~7 paikkaa). 6 h -välein (4 ajoa/vrk) se on ~9 pv. Ajon kesto mitattu (~187 s),
selvästi alle 500 s turvarajan / 800 s Fluid Compute -katon.
Ks. `lib/agent/pipeline/cronConfig.ts` (`DISCOVERY_RUNS_PER_DAY`).

### D-006 – Deterministinen ensin, LLM fail-open
Kaikki poiminta yritetään ensin sääntöpohjaisesti; LLM (Haiku) vain kun sääntö
ei riitä, ja aina fail-open (ilman API-avainta ohitetaan). Putki toimii aina
ilman AI:ta. Ks. [`05_AI.md`](05_AI.md).

### D-005 – Rikas lähde deterministisen jäsennyksen sijaan kun rajapinta antaa sen
Helsingin WFS antoi vain geometrian + kaavatunnuksen; SUKKA-rajapinta antaa
kuvauksen, yhteystiedon, vaiheen ja liitteet. Kun kunnalla on rikkaampi
(Sitowise/Oskari) rajapinta, käytä sitä — vähemmän jälkirikastusta.

### D-004 – Manuaalinen "aseta vanhenemaan" pienten hankkeiden suodatukseen
LLM-luokittelun sijaan hyväksyjä voi merkitä pienen hankkeen vanhenemaan
vuoden päästä (tick box). Yksinkertaisempi ja käyttäjän hallinnassa.

### D-003 – Testit `*.spec.ts` (Vitest), ei `*.test.ts`
Repossa oli jo `*.test.ts`-tiedostoja jotka ovat console.log-skriptejä, eivät
framework-testejä. Vitest-testit nimetään siksi `*.spec.ts`. CI ajaa
`npm install` (ei `npm ci`) cross-platform-lockin vuoksi.

### D-002 – Kaksi ehdokasjärjestelmää (siirtymävaihe)
`potential_projects` (pääpolku, uudet resolverit) ja legacy
`candidate_projects` (saveSignal/classifySignal). Uusi työ menee
`potential_projects`iin.

### D-001 – Lähde rekisteröitävä Supabaseen, ei pelkkä koodi
Pelkkä collectorin committaaminen ei riitä — lähde tarvitsee rivin
`discovery_sources`-tauluun. Ks. [`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md)
(luotettavuushuomio + 8-tiedosto-kaava).
