# Tyomaat.fi – Kumppanuudet ja jakelukanavat

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
| **Idea** | Rakennuslehti tarjoaisi Tyomaat.fi PRO:ta tilaajilleen alennettuun hintaan |
| **Malli jota Johannes tarkoittaa** | **tilaajaetu** — ei rahaa liiku, Rakennuslehti saa tilaukseensa lisäarvoa, Tyomaat.fi saa pääsyn yleisöön |
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

**Tyomaat.fi PRO maksaa 149 €/kk ja hinta on julkaistu sivustolla.** Neuvottelu
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

## Tiedote toimitukselle (laadittu 7.10.2026)

Rakennuslehden **Kari Souto** pyysi tiedotteen toimitukseen **ennen kuin
yhteistyö aloitetaan**. Tiedote on siis portti kumppanuuteen, ei sen
markkinointia.

### Linjavalinnat ja miksi

**Kilpailijoita ei nimetä.** Hubexo on lähes varmasti Rakennuslehden
mainostaja. Nimeltä mainittua mainostajaa vastaan asettuva tiedote on
toimituksen helpompi jättää käsittelemättä kuin selvittää kaupallisen puolen
kanssa. Teksti kuvaa alan käytäntöä ("hintoja ei ole tapana julkaista") ja
jättää vertailun toimittajalle — ja toimittajan itse tekemänä vertailu on
juttuna vahvempi kuin meidän väitteenämme.

**Ei väitteitä kilpailijan keruumenetelmästä.** Ensimmäisessä versiossa luki,
että muut keräävät tiedon soittamalla. Johannes poisti sen: emme tiedä sitä
varmasti. Tiedotteessa esitetty varma väite kilpailijasta on juuri se, jonka
toimittaja tarkistaa, ja virhe veisi koko tekstin uskottavuuden.

**Ulkopuolisen rahoituksen puute jätettiin pois.** Se vahvisti "yhden hengen
yritys" -kulmaa heikommin kuin asia itse. Rahoitusrakenne on taloustoimituksen
kysymys, ei rakennusalan lehden.

**Asiakaskommenttia ei ole.** Tämä on tiedotteen suurin heikkous läpimenon
kannalta — toimittaja tarvitsee jonkun muun kuin myyjän kertomaan että tuote
toimii. Jos asiakas myöhemmin suostuu, se kannattaa tarjota Karille erikseen
jatkona; se voi kääntää "ehkä joskus" -jutun tehdyksi jutuksi.

### Lähetetty teksti

> **TIEDOTE** — Julkaisuvapaa heti · Espoo, 7.10.2026
>
> **Rakennushankkeiden seurantaan suomalainen palvelu, jonka hinta on
> julkisesti nähtävillä**
>
> Tyomaat.fi PRO kokoaa Suomen rakennushankkeet sadoista lähteistä ja kertoo
> niistä kiinnostuneille yrityksille, kun hanke etenee. Palvelun hinta, 149
> euroa kuukaudessa, on nähtävissä verkkosivulla, ja tilaus on irtisanottavissa
> 30 päivän kuluessa. Hanketietopalveluiden hintoja ei alalla ole tapana
> julkaista.
>
> Rakennusalan hanketietoa on myyty Suomessa vuosikymmeniä, mutta hinnan
> selvittäminen on edellyttänyt yhteydenottoa myyntiin ja useimmiten
> esittelytapaamista. Hinta on riippunut markkina-alueesta ja sopimuksen
> laajuudesta. Tyomaat.fi on päättänyt tehdä toisin.
>
> *"Jos hintaa ei kerrota, ostaja ei voi vertailla eikä päättää itse.
> Pienyrittäjä ei halua varata palaveria selvittääkseen, onko jokin hänelle
> liian kallista"*, sanoo palvelun perustaja Johannes Sippola.
>
> Sama ajatus näkyy sopimusehdoissa. Tilaus on irtisanottavissa 30 päivän
> kuluessa milloin tahansa, kun alalla on tavanomaista sitoa asiakas vuodeksi
> kerrallaan. *"Kuukauden irtisanomisaika tarkoittaa, että palvelun on
> ansaittava paikkansa joka kuukausi. Se on epämukavaa minulle, mutta se on
> oikein asiakkaan kannalta."*
>
> **Hankkeet kootaan sadoista lähteistä.** Palvelu seuraa kaavoitusta,
> rakennuslupia, julkisia hankintailmoituksia, kuntien ja hyvinvointialueiden
> päätöksiä, ympäristövaikutusten arviointeja, rakennusalan yritysten omia
> tiedotteita ja lukuisia muita lähteitä. Aineisto haetaan koneellisesti ja
> yhdistetään hankekohtaisiksi kokonaisuuksiksi, joita seurataan
> suunnitteluvaiheesta valmistumiseen asti. Seurannassa on tällä hetkellä yli
> 6 000 rakennushanketta.
>
> *"Julkinen aineisto on Suomessa poikkeuksellisen hyvää. Kunnat julkaisevat
> päätöksensä, kaavat ovat avoimia ja hankinnat ilmoitetaan. Ongelma ei ole
> tiedon puute vaan se, ettei kukaan ehdi lukea niitä läpi joka päivä."*
>
> **Mukana myös hankkeen osapuolet ja yhteystiedot.** Hankkeen tietojen ohella
> palvelu kertoo, ketkä hankkeessa ovat mukana: rakennuttaja, urakoitsijat ja
> suunnittelijat. Käyttäjä saa myös yhteystiedot hankkeen keskeisiin
> henkilöihin.
>
> *"Pelkkä tieto siitä että hanke on olemassa ei riitä. Myyjän pitää tietää
> kenelle soitetaan ja missä vaiheessa se kannattaa tehdä."*
>
> **Kohderyhmänä yritykset, jotka eivät ole ostaneet hanketietoa.** Palvelun
> kohderyhmä on pienet ja keskisuuret rakennusalan yritykset — urakoitsijat,
> aliurakoitsijat, suunnittelutoimistot, tavarantoimittajat ja palveluyritykset.
>
> *"Suurin osa rakennusalan yrityksistä työllistää alle kymmenen henkeä. Ne
> eivät ole koskaan ostaneet hanketietoa, koska se on hinnoiteltu isommille.
> Minä en yritä viedä asiakkaita keneltäkään — olen tehnyt tuotteen niille,
> joille sitä ei ole myyty."*
>
> **Palvelua rakentaa yksi ihminen.** Tyomaat.fi:tä kehittää ja ylläpitää
> Johannes Sippola, joka on rakentanut palvelun vuonna 2025.
>
> *"Keveys on tässä etu eikä puute. Kun ei ole isoa organisaatiota
> katettavana, hinnan voi asettaa sinne missä pienyrityksen on helppo sanoa
> kyllä."*
>
> **Faktat:** Tyomaat.fi PRO · 149 €/kk julkisesti nähtävillä · irtisanottavissa
> 30 päivän kuluessa, ei määräaikaa · yli 6 000 hanketta seurannassa · satoja
> lähteitä · asiakkaita ja testikäyttäjiä yhteensä satoja · Sippola
> Enterprises Oy, Y-tunnus 3627561-2, perustettu 2026 · www.tyomaat.fi
>
> **Lisätiedot:** Johannes Sippola, perustaja, 040 962 4170, info@tyomaat.fi. Toimitukselle
> tarjotaan pyydettäessä tunnukset palveluun sekä kuvamateriaalia.

### Mitä tiedotteessa luvattiin

Tunnukset toimitukselle ja kuvamateriaali pyydettäessä. **Nämä on pystyttävä
toimittamaan heti**, jos toimitus tarttuu — toimittaja joka pääsee itse
etsimään oman alueensa hankkeita kirjoittaa jutun selvästi todennäköisemmin
kuin se, joka lukee pelkän tiedotteen.

---

## Tila

| kanava | tila | seuraava askel |
|---|---|---|
| Rakennuslehti | keskustelu avattu 7.10.2026; toimitus pyysi tiedotteen ennen yhteistyön aloittamista, tiedote laadittu 7.10. | lähetä tiedote Kari Soudolle, varmistu että tunnukset ja kuvat ovat heti annettavissa; sitten avoimet kysymykset |
