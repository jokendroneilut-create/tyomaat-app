# Työmaat.fi – Käyttäjätilanne

Myynti- ja aktivointitoimenpiteiden vaikutus näkyy vain, jos samat luvut
lasketaan samalla tavalla eri ajankohtina. Tämä tiedosto on se sarja.

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

**2. Yksi tili tuottaa 93 % tapahtumista.** `jo***@hotmail.com`, 21 356
tapahtumaa eli 93 % kaikkien asiakastilien tapahtumista.
Todennäköisesti oma tili — **vahvistettava**. Sen
mukanaolo tekee kaikista keskiarvoista ja tapahtumajakaumista
merkityksettömiä, joten skripti erottaa sen automaattisesti (yli 25 %
osuus) eikä piilota sitä.

**3. Aktiivisuus mitataan tapahtumista, ei kirjautumisista.**
`analytics_events` kirjaa `pageview`, `login` ja `project_open`. Auki
jätetty välilehti voi tuottaa tapahtumia ilman että kukaan käyttää
tuotetta.

---

## Tilannekuvat

### 2026-08-15 (data 14.8. asti)

Ensimmäinen mittaus. Aiempaa sarjaa ei ole, joten vertailukohtaa ei
vielä ole — tämä on lähtötaso.

| | |
|---|---|
| Asiakastilejä | **71** (+2 omaa/testiä) |
| Nähty 14.7. jälkeen | **31 / 71** (44 %) |
| Ei jälkeäkään jaksolla | **40** |
| Aktiivinen 7 vrk sisällä | **20** |
| Aktiivinen 30 vrk sisällä | **31** |

**Tilit kuukausittain:** 04/2026: 2 · 05/2026: 40 · 07/2026: 17 ·
08/2026: 12 (kesäkuussa ei yhtään)

**Aktiiviset käyttäjät viikoittain** (mittaus alkaa 14.7.):

| viikko alkaen | aktiivisia |
|---|---|
| 10.7. | 1 |
| 17.7. | 6 |
| 24.7. | 13 |
| 31.7. | 12 |
| 7.8. | **20** |

**Kohortit** – kuinka moni kuukauden tileistä on yhä aktiivinen:

| rekisteröity | tilejä | nähty jaksolla | osuus |
|---|---|---|---|
| 04/2026 | 2 | 2 | 100 % |
| 05/2026 | 40 | 8 | **20 %** |
| 07/2026 | 17 | 12 | **71 %** |
| 08/2026 | 12 | 9 | **75 %** |

**Sitoutuminen** (montako asiakastiliä on tehnyt tämän):

| toiminto | tilejä |
|---|---|
| Tänään-asetukset säätänyt | 25 |
| suosikkeja tallentanut | 11 |
| hankkeen tilaa muuttanut | 8 |
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
| 4.3.2026 | ensimmäinen tallennettu haku käyttöön | 1 käyttäjä |
| 23.4.2026 | toinen tallennettu haku | 1 käyttäjä |
| touko 2026 | 40 tilin erä | 40 tiliä |
| 28.6.2026 | 2 tallennettua hakua (päivittäinen) | 2 käyttäjää |
| 17.7.2026 | broadcast-testi | 1 (testi) |
| **26.7.2026** | **broadcast: "Uusi klusteroituva karttanäkymä julkaistu"** | **61 vastaanottajaa** |
| 27.7.2026 | mahdollisuusherätteet käyntiin | 61 kpl / 5 käyttäjää |
| 3.8.2026 | herätteet jatkuvat | 88 kpl / 6 käyttäjää |
| 10.8.2026 | herätteet jatkuvat | 83 kpl / 8 käyttäjää |
| 12.8.2026 | 2 uutta tallennettua hakua | 2 käyttäjää |

---

## Havainnot 15.8.2026

**Heinä- ja elokuun tilit aktivoituvat 3,5-kertaisesti toukokuun
tileihin verrattuna** (71–75 % vs 20 %). Ero on liian iso ollakseen
sattumaa. Kolme mahdollista selitystä, eikä data erottele niitä:
toukokuun erä oli laadultaan toisenlainen (esim. joukkorekisteröinti),
tuote oli toukokuussa selvästi heikompi, tai toukokuun käyttäjät
käyttivät tuotetta ennen 14.7. eikä siitä ole jälkeä. **Tämä on
ensimmäinen asia joka kannattaa selvittää ennen kuin uusia myyjiä
ohjeistetaan** — jos toukokuun erä oli eri kanavasta, sitä ei kannata
toistaa.

**Aktiivisten määrä lähes kaksinkertaistui viimeisellä viikolla** (12 →
20). Se osuu samaan aikaan kuin herätteiden laajeneminen ja uudet
elokuun tilit. Yhden viikon piikki ei vielä ole trendi.

**Herätteet tavoittavat 8 käyttäjää 31 aktiivisesta.** Tämä on
aktivoinnin selvin vaje: heräte on ainoa mekanismi joka tuo käyttäjän
takaisin ilman että hän itse muistaa tulla. Ero 8 ja 31 välillä on
suoraan tekemättä jäänyttä työtä, ei tuotevirhe.

**40 tiliä ei ole näkynyt kuukauteen.** Näistä 32 on toukokuun erästä.
Ennen kuin niihin käytetään myyntiaikaa, kannattaa varmistaa ovatko ne
ylipäätään oikeita liidejä.

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
| 15.8.2026 | `scripts/snapshot-users.ts` luotu; hallitseva tili (>25 % tapahtumista) erotellaan omaksi rivikseen |
