# Työmaat.fi – Käyttäjätilanne

Myynti- ja aktivointitoimenpiteiden vaikutus näkyy vain, jos samat luvut
lasketaan samalla tavalla eri ajankohtina. Tämä tiedosto on se sarja.

**Kaksi raporttia:**

| komento | vastaa kysymykseen |
|---|---|
| `npx tsx scripts/report-accounts.ts` | montako tiliä on luotu, milloin, mille yrityksille |
| `npx tsx scripts/snapshot-users.ts` | kuka niistä oikeasti käyttää tuotetta |

Hankintaraportti lukee `account_lifecycle`-taulusta, joten **myös
poistetut tilit ovat mukana**. Aikaikkunan saa vaihdettua:
`--months 24`.

**Päivitys:** aja `npx tsx scripts/snapshot-users.ts` ja lisää tulos
kohtaan [Tilannekuvat](#tilannekuvat) uusin ylimmäksi. Älä muuta
laskentatapaa jälkikäteen — jos mittari on muutettava, kirjaa muutos
kohtaan [Mittarin muutokset](#mittarin-muutokset), muuten sarjan
vertailukelpoisuus katoaa huomaamatta.

---

## Mitä luvut tarkoittavat ja mitä ne eivät tarkoita

**Tili luotu** on myynnin tulos. **Aktiivisuus** on tuotteen tulos.
Rekisteröityneiden määrä yksin ei kerro kummastakaan mitään, ja se on
juuri se luku jota on helpoin katsoa.

Kolme rajoitusta, jotka on tunnettava ennen kuin lukuja tulkitsee:

**1. Analytiikka alkoi 14.7.2026.** Sitä ennen rekisteröityneiden
käytöstä ei ole tietoa lainkaan. "Ei jälkeäkään" ei siis tarkoita "ei
koskaan käyttänyt" vaan "ei tapahtumia 14.7. jälkeen". Viikkokäyrän
nollat ennen heinäkuun puoltaväliä ovat mittarin alku, eivät käyttäjien
käytös.

**2. Omat tilit on suljettu pois, ja se on tarkistettava.**
`johannessippola@hotmail.com` (admin) tuotti yksin 21 367 tapahtumaa eli
**93 %** kaikista. `jokendroneilut@gmail.com` on testitili. Molemmat on
lueteltu skriptissä täsmällisinä osoitteina, ei kuviona — kuvio joka ei
osu jättää tilin hiljaisesti mukaan lukuihin eikä sitä huomaa mistään.
Juuri niin kävi ensimmäisellä mittauskerralla. Skripti varoittaa, jos
nimetty osoite katoaa kannasta.

**Vielä ratkaisematta:** `johannes.sippola@koneunion.fi` on kannassa
erikseen (luotu 28.7.). Se on toistaiseksi laskettu asiakastiliksi —
lisää poissulkulistaan jos on omasi.

**3. Aktiivisuus mitataan tapahtumista, ei kirjautumisista.**
`analytics_events` kirjaa `pageview`, `login` ja `project_open`. Auki
jätetty välilehti voi tuottaa tapahtumia ilman että kukaan käyttää
tuotetta.

---

## Mitä EI ole tallessa: tilaus- ja trial-tila

Tarkistettu 15.8.2026. Kantaa ei ole tauluja `subscriptions`, `plans`,
`invoices`, `payments`, `customers`, `trials` eikä `leads`. `profiles`
sisältää vain `id`, `email`, `full_name`, `created_at`. Maksullisuudesta
ei ole kenttää missään.

**Tunnus säilyy, tila ei.** Jokainen koskaan luotu tili on tallessa:
`auth.users` 73 ja `profiles` 73 täsmäävät, orpoja ei ole eikä mitään
ole poistettu. Sähköpostiosoite ja luontipäivä ovat siis aina
saatavilla.

**Mutta järjestelmä ei tiedä kuka on trialilla, kenen trial päättyi tai
kuka maksaa.** Listaa "trialit jotka eivät jääneet maksaviksi
asiakkaiksi" ei voi tuottaa datasta. Lähin korvike on tili + käyttö:
*luotu helmikuussa, ei jälkeäkään 14.7. jälkeen*. Se on eri asia kuin
konvertoitumaton trial, koska syy voi yhtä hyvin olla ettei tiliä
koskaan otettu käyttöön.

**Yritys tunnistetaan vain sähköpostin domainista.** Erillistä
yrityskenttää ei ole. 21 tiliä 73:sta on ilmaissähköpostissa (gmail 15,
hotmail 4), eikä niitä voi yhdistää yritykseen millään. Jos yritystieto
on myynnille tärkeä, se on kysyttävä rekisteröityessä — jälkikäteen
sitä ei saa mistään.

**Domain säilyy vain niin kauan kuin sähköposti.** Jos `email` nollataan
GDPR-poistopyynnön takia, myös yritystieto katoaa siltä riviltä. Jos
yritystason luvut halutaan säilyttää poistojen yli, `account_lifecycle`
tarvitsee oman `company_domain`-sarakkeen.

**Tunnuksen säilyminen on varmistettu.** `account_lifecycle`-taulu
otettiin käyttöön 15.8.2026 ja siihen kirjattiin kaikki 73 tiliä
`created`-tapahtumina oikeilla `auth.users`-luontipäivillä. Se toimii
kuin päiväkirja: kirjoitetaan kerran, ei poisteta.

| suoja | miten |
|---|---|
| tilin poisto ei kosketa merkintää | ei vierasavainta `auth.users`iin |
| merkintää ei voi poistaa | trigger `account_lifecycle_block_delete` |
| ei auki anon-avaimelle | RLS päällä ilman policyja |
| poistettu tili jää kirjoihin | `/api/admin/delete-user` kirjaa `created` + `deleted` ennen poistoa |

Nimen ja sähköpostin **saa** nollata poistopyynnön yhteydessä — merkintä
ja päivämäärä jäävät, joten luvut säilyvät ilman henkilötietoa.

SQL: [`2026-08-15_account_lifecycle.sql`](sql/2026-08-15_account_lifecycle.sql)
ja [`2026-08-15_account_lifecycle_no_delete.sql`](sql/2026-08-15_account_lifecycle_no_delete.sql)
(molemmat ajettu 15.8.2026).

Ylläpito on täsmäytys, ei tapahtumakaappaus:
`npx tsx scripts/sync-account-lifecycle.ts --apply` vertaa lokia
`auth.users`iin ja täydentää molempiin suuntiin. Aja se silloin tällöin
— erityisesti jos tilejä on poistettu Supabasen hallintapaneelista,
joka ohittaa sovelluksen poistoreitin.

**Näin on päätetty (15.8.2026): tilaustietoa ei kerätä.** Omistaja
laskuttaa asiakkaat itse ja tietää maksavien määrän ilman järjestelmää.
`account_lifecycle` tukee tapahtumia `trial_started`, `converted` ja
`cancelled`, mutta niitä ei kirjoiteta mistään. Tätä ei tarvitse
ehdottaa uudelleen.

Käytännön seuraus: tämä tiedosto vastaa kysymykseen *montako tunnusta
on luotu ja kuka niistä käyttää tuotetta*. Maksavien määrä tulee
laskutuksesta, ja vertailu tehdään käsin.

---

## Tilannekuvat

### 2026-08-15 (data 14.8. asti)

Ensimmäinen mittaus. Aiempaa sarjaa ei ole, joten vertailukohtaa ei
vielä ole — tämä on lähtötaso.

| | |
|---|---|
| Asiakastilejä | **70** (+3 omaa/testiä) |
| Nähty 14.7. jälkeen | **30 / 70** (43 %) |
| Ei jälkeäkään jaksolla | **40** |
| Aktiivinen 7 vrk sisällä | **19** |
| Aktiivinen 30 vrk sisällä | **30** |

**Tilit kuukausittain** (`auth.users.created_at`): 02/2026: 27 ·
03/2026: 11 · 04/2026: 3 · 06/2026: 1 · 07/2026: 16 · 08/2026: 12
(touko- ja kesäkuussa käytännössä ei yhtään)

**Aktiiviset käyttäjät viikoittain** (mittaus alkaa 14.7.):

| viikko alkaen | aktiivisia |
|---|---|
| 10.7. | 0 |
| 17.7. | 5 |
| 24.7. | 12 |
| 31.7. | 11 |
| 7.8. | **19** |

**Kohortit** – kuinka moni kuukauden tileistä on yhä aktiivinen:

| rekisteröity | tilejä | nähty jaksolla | osuus |
|---|---|---|---|
| 02/2026 | 27 | 6 | **22 %** |
| 03/2026 | 11 | 2 | **18 %** |
| 04/2026 | 3 | 1 | 33 % |
| 06/2026 | 1 | 0 | 0 % |
| 07/2026 | 16 | 12 | **75 %** |
| 08/2026 | 12 | 9 | **75 %** |

Tiivistettynä: **helmi–huhtikuun 41 tilistä 9 on aktiivisia (22 %),
heinä–elokuun 28 tilistä 21 (75 %).**

**Yritykset** (sähköpostin domainin mukaan, kaikki 73 tiliä):

| | |
|---|---|
| eri yrityksiä | **23** |
| tilejä yritysdomainissa | **52** |
| ilmaissähköpostilla | **21** (ei yhdistettävissä yritykseen) |

Useamman tilin yritykset: `koneunion.fi` 15 (ensimmäinen 19.2.),
`sarlin.com` 12 (23.3.), `henkilostomestarit.fi` 4 (30.7.),
`priimamaalaus.fi` 2 (24.7.). Loput 19 yritystä yhden tilin varassa.

**Sitoutuminen** (montako asiakastiliä on tehnyt tämän):

| toiminto | tilejä |
|---|---|
| Tänään-asetukset säätänyt | 24 |
| suosikkeja tallentanut | 10 |
| hankkeen tilaa muuttanut | 7 |
| tallennettu haku | 4 |

**Tapahtumat 30 vrk** ilman hallitsevaa tiliä, yhteensä 1 660:
`pageview` 1 152 · `login` 319 · `project_open` 189.
Tapahtumia per aktiivinen käyttäjä: mediaani 36, p90 140, max 178.

---

## Toimenpiteiden aikajana

Tähän kirjataan myynti- ja aktivointitoimenpiteet, jotta käyrän
muutokset voi yhdistää tekoihin eikä arvailuun.

| pvm | toimenpide | laajuus |
|---|---|---|
| helmi 2026 | ensimmäinen hankinta-aalto | 27 tiliä |
| 4.3.2026 | ensimmäinen tallennettu haku käyttöön | 1 käyttäjä |
| maalis 2026 | hankinta jatkuu | 11 tiliä |
| 23.4.2026 | toinen tallennettu haku | 1 käyttäjä |
| touko–kesä 2026 | **tauko hankinnassa** | 1 tili |
| 28.6.2026 | 2 tallennettua hakua (päivittäinen) | 2 käyttäjää |
| heinä 2026 | hankinta uudelleen käyntiin | 16 tiliä |
| 17.7.2026 | broadcast-testi | 1 (testi) |
| **26.7.2026** | **broadcast: "Uusi klusteroituva karttanäkymä julkaistu"** | **61 vastaanottajaa** |
| 27.7.2026 | mahdollisuusherätteet käyntiin | 61 kpl / 5 käyttäjää |
| 3.8.2026 | herätteet jatkuvat | 88 kpl / 6 käyttäjää |
| 10.8.2026 | herätteet jatkuvat | 83 kpl / 8 käyttäjää |
| 12.8.2026 | 2 uutta tallennettua hakua | 2 käyttäjää |

---

## Havainnot 15.8.2026

**Hankinnassa on ollut kolmen kuukauden tauko.** Helmi–huhtikuussa
syntyi 41 tiliä, touko–kesäkuussa yksi, ja heinä–elokuussa 28. Tauko
näkyy suoraan siinä ettei kohorttia ole mistä mitata.

**Heinä- ja elokuun tilit aktivoituvat kolminkertaisesti alkuvuoden
tileihin verrattuna** (75 % vs 22 %). Ero on liian iso ollakseen
sattumaa, mutta data ei erottele syytä. Kolme mahdollista: alkuvuoden
tilit ovat 5–6 kuukautta vanhoja ja ehtineet hiipua normaalisti, tuote
oli silloin heikompi, tai he käyttivät tuotetta ennen 14.7. eikä siitä
ole jälkeä. **Ikäero yksin riittäisi selittämään paljon** — tuoretta
kohorttia verrataan puolen vuoden takaiseen, mikä ei ole reilu
vertailu. Vasta kun heinäkuun kohortti on puoli vuotta vanha, luvut
ovat vertailukelpoisia.

**Aktiivisten määrä lähes kaksinkertaistui viimeisellä viikolla** (11 →
19). Se osuu samaan aikaan kuin herätteiden laajeneminen ja uudet
elokuun tilit. Yhden viikon piikki ei vielä ole trendi.

**Herätteet tavoittavat 8 käyttäjää 30 aktiivisesta.** Tämä on
aktivoinnin selvin vaje: heräte on ainoa mekanismi joka tuo käyttäjän
takaisin ilman että hän itse muistaa tulla. Ero 8 ja 31 välillä on
suoraan tekemättä jäänyttä työtä, ei tuotevirhe.

**40 tiliä ei ole näkynyt kuukauteen.** Näistä 32 on helmi–huhtikuulta.
Ne ovat vanhin ja kylmin joukko — ennen kuin niihin käytetään
myyntiaikaa, kannattaa varmistaa ovatko ne ylipäätään oikeita liidejä.
Huomaa myös ettei kannassa ole tietoa siitä, oliko kyse trialista joka
ei konvertoitunut — ks. [Mitä EI ole
tallessa](#mitä-ei-ole-tallessa-tilaus--ja-trial-tila).

**Tallennettuja hakuja on 6 ja yksi niistä ei ole koskaan lähtenyt.**
Pieni määrä, mutta tallennettu haku on sitoutumisen vahvin merkki —
käyttäjä on kertonut mitä haluaa. Kannattaa tarkistaa miksi yksi ei
lähetä.

---

## Mittarin muutokset

Jokainen laskentatavan muutos kirjataan tähän päivämäärällä, muuten
sarjan hyppy luetaan käyttäjien käytökseksi.

| pvm | muutos |
|---|---|
| 14.7.2026 | `analytics_events` otettu käyttöön — kaikki aktiivisuusluvut alkavat tästä |
| 15.8.2026 | `scripts/snapshot-users.ts` luotu |
| 15.8.2026 | admin- ja testitili suljettu pois (`johannessippola@hotmail.com`, `jokendroneilut@gmail.com`). Ennen tätä luvut olivat: 71 asiakastiliä, 31 aktiivista |
| 15.8.2026 | **rekisteröitymispäivä luetaan `auth.users`ista, ei `profiles`ista.** `profiles.created_at` on profiilirivin luontipäivä: 40 riviä oli luotu kaikki samana päivänä 3.5.2026 (taulun käyttöönoton täydennysajo), ja 51 tiliä 73:sta oli eri päivällä kuin `auth.users` (suurin ero 78 vrk). Ennen korjausta kohortit raportoitiin muodossa "05/2026: 39 tiliä" — sellaista erää ei ollut |
