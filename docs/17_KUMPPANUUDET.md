# Työmaat.fi – Kumppanuudet ja jakelukanavat

Jakelu on tämän liiketoiminnan pullonkaula, ei tuote. Markkina on
myyntirajoitteinen: Metroc kasvaa 16 % neljällä asiantuntijalla, RPT nojaa
viidenkymmenen vuoden suhteisiin, ja meillä on yksi ihminen. **Kumppani, jolla
on valmis yleisö, on ainoa asia jota emme voi rakentaa itse.**

Tämä tiedosto kirjaa avatut kanavat, niiden ehdot ja sen mitä niistä opittiin.
Täydentää dokumentteja [`11_COMPETITORS.md`](11_COMPETITORS.md) (kenen kanssa
kilpaillaan) ja [`15_TYOMAARA_JA_ARVIO.md`](15_TYOMAARA_JA_ARVIO.md)
(matalan hinnan strategia).

**Päivitys:** erota aina **mitä on sovittu** siitä **mitä on oletettu**. Sama
sääntö kuin kilpailijadokumentissa: neuvottelukumppanin sanoma ja oma
päättelymme eivät saa näyttää samalta.

---

## Rakennuslehti — keskustelu avattu 7.10.2026

### Mitä tiedetään, mitä ei

| | |
|---|---|
| **Tapahtui** | Johannes tapasi Rakennuslehden toimitusjohtajan messuilla |
| **Heidän kantansa** | kiinnostuneita tekemään yhteistyötä |
| **Idea** | Rakennuslehti tarjoaisi Työmaat.fi PRO:ta tilaajilleen alennettuun hintaan |
| **Malli jota Johannes tarkoittaa** | **tilaajaetu** — ei rahaa liiku, Rakennuslehti saa tilaukseensa lisäarvoa, Työmaat.fi saa pääsyn yleisöön |
| **Alennuksen suuruus** | ❗ **ei tiedossa.** "−50 %" on Johanneksen oma havainnollistus keskustelussa, **ei Rakennuslehden ehdotus** |
| **Alennuksen kesto** | ei tiedossa; voi olla määräaikainen |
| **Kaikki muu** | yksityiskohdista ei ole keskusteltu |

Loppu tästä luvusta on analyysiä, ei sovittua.

### Miksi tämä osuu täsmälleen oikeaan kohtaan

Rakennuslehden tilaajakunta on kolmella tavalla juuri oikea:

1. **Oikea yleisö** — suomalaisia rakennusalan ammattilaisia, valtaosin pieniä
   yrityksiä.
2. **Todistetusti maksuhalukas rakennusalan tiedosta.** He maksavat jo siitä,
   että joku kertoo heille mitä alalla tapahtuu. Kategoriaa ei tarvitse myydä.
3. **Valtaosa heistä ei ole kummankaan kilpailijan asiakas.** Hanketietoa
   ostavia on Suomessa ~1 500–2 300, potentiaalisia ~15 000
   ([`11_COMPETITORS.md`](11_COMPETITORS.md), *Markkinan koko*).

Kolmas kohta on tärkein. Tämä kanava tavoittaa **uusia ostajia, ei vaihtajia** —
eli juuri sen segmentin, jonka varaan matalan hinnan strategia on rakennettu ja
johon meillä ei muuten ole reittiä. Samalla se on lääke kirjattuun vaaraan:
jos ensimmäiset asiakkaat ovat RPT:n vaihtajia, roadmap alkaa seurata heidän
pyyntöjään ja ajaudumme rakentamaan halvempaa Smartia.

Neljäs, vähemmän ilmeinen hyöty: **uskottavuus.** Yhden hengen yrityksellä on
luottamusongelma B2B-tilauksessa, ja se korostuu koska asiakas ei pysty
todistamaan tuotteen arvoa itselleen (ks. *Attribuutio-ongelma*
[`11_COMPETITORS.md`](11_COMPETITORS.md):ssa). Rakennuslehden kautta tuleva
tarjous lainaa institutionaalista luottamusta, jota ei voi ostaa rahalla.

### Huomio: Rakennuslehti on lähteemme, mutta ei ehkä kauaa

`lib/agent/fetchRakennuslehtiSource.ts` on ollut käytössä pitkään, ja
[`04_ROADMAP.md`](04_ROADMAP.md):n mittauksen mukaan Rakennuslehti on
mitattuna kannan paras arvolähde (25 % ehdokkaista sisältää euromäärän).

**Mutta sen poistamisesta on jo keskusteltu.** Johannes 7.10.2026:
*"Se on enemmän lähteiden lähde nyt."* Rakennuslehti raportoi asioista, jotka
saadaan alkuperäisestä lähteestä suoraan — eli se tuottaa johdannaista tietoa
ja kaksoiskappaleita, ja se on lisäksi maksumuurin takana
([`03_DECISIONS.md`](03_DECISIONS.md), lähdetaulukko).

Kumppanuuden kannalta tämä on **hyvä asia, ei huono**:

- **Emme ole riippuvaisia heidän sisällöstään.** Neuvotteluasetelmassa ei ole
  epätasapainoa eikä heillä ole meihin vipuvartta.
- **Ei "te skrapaatte meitä" -ongelmaa.** Jos lähde poistuu, se poistuu
  teknisistä syistä, ei kumppanuuden takia.
- **Älä silti myy sitä argumenttina.** "Käytämme journalismianne lähteenä" on
  huono avaus, jos lähde ollaan poistamassa — se selittyisi kiusallisesti
  myöhemmin.

Parempi kehys: sisältökumppanuus **korvaisi** yksisuuntaisen lukemisen
sovitulla vaihdolla. Me annamme heille indeksin julkaistavaksi, ja jos heidän
raportointinsa on meille arvokasta, siitä sovitaan erikseen maksumuurin ehdoin.
Se on siistimpi rakenne molemmille kuin nykytila.

### Ehto jota ei saa rikkoa: hinnan julkisuus

Koko asemointi on *hinta näkyvissä, ei neuvottelua, ei myyjää*
([`11_COMPETITORS.md`](11_COMPETITORS.md), *Päätetty asemointi*). Siitä seuraa
yksi sitova ehto:

> **Kumppanihinnan on oltava yhtä julkinen kuin listahinnan.**

Piilossa oleva kanava-alennus tarkoittaisi, että suora asiakas maksaa enemmän
samasta tuotteesta kuin tilaaja — eli että julkinen hinta on fiktio. Se on
täsmälleen se mistä kilpailijoita arvostellaan tässä dokumentaatiossa.

Ratkaisu on helppo ja itse asiassa parempaa markkinointia: *"Rakennuslehden
tilaajille X €/kk."* Läpinäkyvä, perusteltu, ja tekee Rakennuslehden tilauksesta
arvokkaamman — mikä on heidän puolensa kaupasta.

### Listahinta on jo olemassa: 149 €/kk

*Korjaus 7.10.2026 — tässä luki aiemmin, että listahinta on päättämättä. Se ei
pitänyt paikkaansa.*

**Työmaat.fi PRO maksaa 149 €/kk ja hinta on julkaistu sivustolla.** Neuvottelu
käydään siis oikeasta luvusta, ei tyhjästä. Vertailuksi: RPT Smart 600 €/kk
yhdestä maakunnasta, Hubexo Finlandin keskimääräinen asiakas ~470 €/kk, Metroc
~250–350 €/kk.

Mitä alennus tarkoittaisi käytännössä:

| alennus | hinta tilaajalle | vuodessa |
|---|---|---|
| — | 149 €/kk | 1 788 € |
| −25 % | 112 €/kk | 1 341 € |
| −50 % | 75 €/kk | 894 € |

Olennainen havainto: **149 €/kk on jo harkinnan rajalla ja alennettuna selvästi
sen alapuolella.** 1 788 €/v vaatii pieneltä yritykseltä päätöksen; 894 €/v on
lähempänä heräteostosta. Kanava-alennus siirtää tuotteen harkintaostosta
impulssiostoon, ja juuri se on tilaajaedun arvo — ei se että saadaan vähän
enemmän katetta per asiakas.

Siksi **määräaikainen alennus on tässä parempi kuin pysyvä**: se tuo asiakkaan
sisään impulssihinnalla ja palauttaa hänet listahintaan, kun tuote on jo
käytössä ja arvo todettu.

### Alennus ei ole ainoa valuutta

Pysyvä prosenttialennus siirtää hinta-ankkurin pysyvästi: jos kanavasta tulee
päähankintareitti, alennettu hinta **on** oikea hinta, ja nosto myöhemmin
maksaa churnina. Vaihtoehtoja jotka eivät polta ankkuria:

- kolme ensimmäistä kuukautta veloituksetta tilaajille
- pidempi kokeilujakso kuin muilla
- lisäkäyttäjä samaan hintaan
- jotain joka ei ole hinta lainkaan: tilaajille oma näkymä tai raportti

Määräaikainen alennus (jos se on heidän ajatuksensa) on tässä mielessä
selvästi parempi kuin pysyvä.

### Avoimet kysymykset ennen yksityiskohtia

1. **Miten tarjous käytännössä välitetään tilaajille?** Uutiskirje, printti,
   oma sähköposti tilaajarekisterille vai maininta sivustolla? Mekaniikka
   ratkaisee volyymin kokonaan — maininta alatunnisteessa tuottaa nollan, oma
   sähköposti satoja.
2. **Montako tilaajaa, ja mikä osa heistä on yrityksiä?**
3. **Alennuksen suuruus ja kesto** — heidän ehdotuksensa, ei meidän.
4. **Kesto ja yksinoikeus.** Yksinoikeutta ei anneta todistamattomasta
   kanavasta; jos sitä pyydetään, aikarajataan (12 kk) ja sidotaan
   volyymitavoitteeseen.
5. **Mittaus**: oma laskeutumissivu tai koodi.

### Isompi mahdollisuus: markkinaindeksi

Rakennuslehti on mediatalo. Heidän valuuttansa on sisältö ja yleisö, ja
alennuskuponki on heille pieni asia. **Meillä on jotain arvokkaampaa:
julkaistavaa dataa.**

Suomen rakennushankkeiden markkinaindeksi — aloitukset ja suunnitelmat
kuukausittain, alueittain ja sektoreittain — on journalismia jota he voivat
julkaista omanaan. Hubexolla on vastaava, mutta se on maksumuurin takana ja se
on *kilpailijan* luku; Byggfakta Risen analytiikkanäkymässä esitettiin Suomen
luvut 6.10.2026 webinaarissa.

Kumpikin voittaa enemmän kuin alennuksesta:

- heille toistuvaa, erottuvaa sisältöä jota kukaan muu ei saa
- meille joka kuukausi nimi ja numerot alan päämediassa — tunnettuutta ja
  uskottavuutta, jota yhden hengen yritys ei voi ostaa
- siteeraukset ovat linkkejä, eli ne ruokkivat samaa hakukonenäkyvyyttä jota
  julkiset hankesivut rakentavat

**Suositus: vie keskusteluun kaksi asiaa yhden sijaan** — tilaajaetu *ja*
sisältökumppanuus. Alennus on näistä pienempi puolisko.

### Riskit

- **Hubexo on lähes varmasti Rakennuslehden mainostaja**, ja Rakennuslehti on
  uutisoinut Metrocin rahoituskierroksista. Kaupallinen puoli voi empiä, jos
  diili näyttää ison mainostajan haastamiselta. Ei syy jättää tekemättä, mutta
  syy **olla rakentamatta suunnitelmia allekirjoittamattoman sopimuksen
  varaan** ja viedä asiaa eteenpäin ripeästi kun toimitusjohtaja on itse
  innostunut.
- **Tukikuorma.** Yhden hengen yrityksessä sitova rajoite ei ole kate vaan
  aika. Kanava joka tuo kerralla satoja asiakkaita on hyvä ongelma, mutta se on
  ongelma. Itsepalveluosto ja -käyttöönotto (R1) ovat edellytys sille että
  kanava ylipäätään kestetään.

### Mittaus — tämä on kanavan tärkein osa

Oma laskeutumissivu tai alennuskoodi, jotta tiedetään tarkalleen montako tuli,
paljonko he maksavat ja paljonko kanava tuottaa churnia. Lisäksi nämä
asiakkaat merkitään laskutustietoihin **"ei koskaan ostanut"** -ryhmään
(ks. muistiinpano `customer-billing`).

Syy on isompi kuin raportointi: **tämä kanava on markkinanluontiteesin
ensimmäinen oikea testi.** Jos Rakennuslehden tilaajista tulee maksavia
asiakkaita, uusi markkina on olemassa. Jos ei tule, se tiedetään halvalla ja
aikaisin — ja se tieto on yhtä arvokas.

---

## Tila

| kanava | tila | seuraava askel |
|---|---|---|
| Rakennuslehti | keskustelu avattu 7.10.2026, ei yksityiskohtia | päätä listahinta (R1), sitten sovi tapaaminen jossa käydään avoimet kysymykset |
