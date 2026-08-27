# Työmaat.fi – Changelog

Merkittävät toiminnalliset muutokset teemoittain. Yksityiskohdat git-historiassa
(commit-tunnukset suluissa). Ylin = uusin.

Tämä tiedosto kattaa työn edellisen dokumentaatiopäivityksen (`a3aabc8`,
kaavakatalogi) jälkeen. Kuntakohtainen kaavalähteiden kattavuus on omassa
tiedostossaan: [`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md).

---

## 2026-08 (tyo 22.8.)

### Granlund lisatty lahteeksi (D-131)

Granlund on suunnittelutoimisto, joten se on hankkeessa vuosia ennen
urakoitsijaa. Kenttien kattavuus on paras mitattu: Tilaaja 99 %,
Paikkakunta 100 %, kuvaus 100 % (mediaani 651 merkkia).

Loytolahteena se on silti lahes tyhja: 204 hankkeesta 152 on
valmistunut, 42 vanhaa ilman valmistumisvuotta ja 4 konsultointia.
Jonoon jaa 6 aitoa kaynnissa olevaa hanketta.

Arvo on rikastuksessa: Prisma Hyllykallio oli jo jonossa Lujatalolta ja
Granlund taydensi sen. Tasmaytys olemassa oleviin on avoin tyo.

### Taivassalon kaavakuvaukset kohdesivulta (D-130)

Keraaja luki vain listauksen yhden lauseen (55 merkkia). Jokaisella
kaavalla on oma sivu, jolla lukee "Kuvaus kaavasta:" ja koko
suunnittelualueen kuvaus kiinteistoineen, pinta-aloineen ja
tavoitteineen (344-833 merkkia).

Listan lause ja kohdesivun kuvaus ketjutetaan: edellinen kertoo vaiheen
paivamaaran, jalkimmainen sisallon.

Takautuva ajo: 4 ehdokasta ja 2 nakyvaa hanketta. Esimerkki 55 -> 867
merkkia.

### Ajojen ja lahteiden aikabudjetit korjattu (D-127, D-129)

Tampereen paatokset kaatui aikakatkaisuun joka ajolla: pelkka haku kesti
84,4 s kun raja on 90 s. Haku sai oman 55 s budjetin ja hakusanojen
kierratyksen. Mitattu jalkeen: 56,5 s ja 27 kandidaattia (oli 84,4 s ja
18).

9 % keraysajoista sy0i koko budjetin lahdevaiheeseen, jolloin rikastus
jai kokonaan valiin. Lahdevaiheelle annettiin oma katto (70 % ajosta),
joten rikastukselle jaa aina noin 114 s.

Tiedotelahteen kaupunkipaattelya EI muutettu (D-128): erimielisyys on
6/259 eli 2,3 %, ja kaksi korjaushypoteesia kaatui mittauksessa.

### Lujatalon referenssisivun aikataulu luetaan (D-126)

Ehdokas oli jonossa rakenteilla olevana, vaikka lahdesivulla lukee
"Rakentamisen aikataulu 2019 - 2021". Listauksen kaynnissa-merkinta oli
vanhentunut. Keraaja lukee nyt kohdesivun aikataulun ja merkitsee
kohteen valmistuneeksi jos loppuvuosi on mennyt.

Mitattu: 6 elavaa Lujatalo-referenssia, joista 1 oli paattynyt.
Korjattu takautuvasti. GRK:n (18) sivuilla ei ole aikataulua lainkaan,
NCC (15) mitattu jo 19.8., Kreate korjattu 25.8.

### Kuulutuksen kuvaukseen sekä Toimenpide että Lisaselvitykset (D-125)

Kuvaus valitsi toisen kentan ja hukkasi toisen, joten olennaisin osa -
mita tontilla oikeasti tapahtuu - jai pois. Nyt molemmat ketjutetaan.

Samalla korjattiin kaksi virhetta katkaisussa: eilinen
kirjainkokoriippumaton vertailu katkaisi arvon leipatekstin sanaan
(36 kuvausta 309:sta olisi lyhentynyt), ja takautuva ajo ohitti rivin
jos sen 40 ensimmaista merkkia tasmasivat.

Paivitetty: 122 lahdedokumenttia, 36 jonon ehdokasta (622 -> 1 459 mk)
ja 25 nakyvaa hanketta (736 -> 1 594 mk).

### Hankkeen kaikki nakyvat kentat muokattavissa (D-124)

Hyvaksynnassa unohtunutta "aseta vanhenemaan" -ruksia ei voinut korjata
jalkikateen, eika yhteystietoja voinut muokata missaan.

Muokkaukseen lisattiin: asuntojen maara, kerrosala, rakentamisen aloitus,
vanhenemispaiva ja yhteyshenkilot (nimi, nimike, sahkoposti, puhelin).
Vanheneminen laskee saman saannon mukaan kuin hyvaksynta. Tyhja
yhteystietolista on sallittu - se on ainoa tapa poistaa vaarin poimittu
osoite kasin.

Yhteystiedot myos jonon ehdokkaalla (/tic/projects/[id]), jotta vaarin
poimittua ei tarvitse korjata kahdesti. Taulukko on jaettu komponentti.

Asiakkaan /projects-sivun modaaliin lisattiin yllapitajalle nakyva
"Muokkaa"-linkki: virhe huomataan siella, mutta korjaukseen ei johtanut
mistaan polkua.

Todennettu kasin 25.8.2026: muokkauslomakkeet ja korjauslinkki toimivat.

Puuttuu viela: metadata.related_companies.

### Poimija ei enaa liita malliosoitetta oikeaan nimeen (D-123)

Sivulla oleva OHJE ("sahkoposti: etunimi.sukunimi@rovaniemi.fi")
liitettiin viereiseen oikeaan nimeen, ja asiakas lahetti viestin
tyhjaan. Mitattu ajamalla poimija 12 547 kuvaustekstin yli: 670
ristiriidasta 659 oli tata.

Osoite pudotetaan, nimea ei laajenneta - vapaassa tekstissa lahin nimi on
usein nimike tai toinen henkilo. Nimi ja puhelin sailyvat.

Ristiriitoja 670 -> 11, ja kontaktien maara pysyi samana (6 666 ->
6 667). Nimi-osoite-pariutus oli jo korjattu 22.8.; kannassa oli vain
vanhaa dataa.

### Vaarat ja puuttuvat yhteystiedot korjattu (D-122)

5 156 tarkistettavasta sahkopostista 148 ei tasmannut nimeen. Korjattu
kahdessa osassa: 29 vaaraa paria (20 korvattiin oikealla osoitteella,
9 tyhjennettiin) ja 42 malliosoitetta (31 laajennettiin nimesta, 11
tyhjennettiin). Ristiriitoja jaljella 77, joista 64 on roskanimea.

Tyhjennys on tietoinen poikkeus saantoon "yhteystiedoista ei koskaan
poisteta mitaan": vaara osoite nayttaa oikealta ja ohjaa asiakkaan
vaaralle henkilolle, kun taas tyhja kentta on rehellinen.

Sen jalkeen 67 roskanimea siirrettiin oikeisiin kenttiin
(organisaatio, nimike, puhelin) ja 224 puuttuvaa sahkopostia
taydennettiin saman henkilon tarkistetusta tietueesta samasta lahteesta.
Ristiriitoja 148 -> 10, eivatka ne kymmenen ole vikoja.

Jarjestys oli olennainen: taydennys ennen korjausta olisi levittanyt
virhetta, koska se lukee samaa dataa.

Vika on poimijassa: kun sivulla on useita henkiloita, lahin osoite
liitetaan vaaraan nimeen. Raaseporissa sama konsultin osoite paatyi
seitsemalle eri kaavoittajalle, ja Rovaniemella koko tietue on
romahtanut yhdeksi. Takautuva korjaus ei esta uusia.

### Kreaten kuvaukset, osoitteet ja valmistumisajat (D-121)

Kreaten hankesivun sisalto oli kannassa mutta resolveri ei lukenut sita:
kuvaukseksi jai otsikko (70 mk), sijainti tyhja, valmistumisaika
puuttui. Sivulla on rakenteinen kenttalohko, josta Valmistuminen loytyy
41/41 ja Osoite 34/41 - proosasta paattely osui vain 20/41.

Takautuva ajo: 41 ehdokasta ja 34 nakyvaa hanketta. Kuvaus 70 -> n. 2 000
merkkia. 10 hanketta sai menneen valmistumispaivan ja siirtyy
auto-completessa valmistuneiksi; hyvaksytty tietoisesti.

Ansa jonka mittaus paljasti: sivun alalaidan "muut hankkeet" -karuselli
sisaltaa TOISTEN hankkeiden valmistumisaikoja. Ensimmainen toteutus
poimi juuri sen.

Projektinjohtaja lisataan yhteyshenkiloksi jos han ei ole jo listalla.
Mitattuna se koski yhta hanketta 75:sta: yhteystiedot tulivat jo
henkilostoosiosta (nimi, tehtava, puhelin, sahkoposti) ja kattavuus oli
97 %. Nimi ilman osoitetta rikkoo vakiintunutta saantoa, mutta omistaja
paatti etta se on silti hyva tieto.

### Takautuvien ajojen hidastus hylattiin mittauksen jalkeen (D-120)

Ehdotin skripteille kirjoitusten tahdistusta, koska takautuva ajo osui
ajallisesti lahelle 24.8. katkoa. Mitattu: silmukat kirjoittavat 4,3
rivia sekunnissa, ja hitaus tulee verkon viiveesta eika kannasta. Se ei
nalkiinnyta mitaan Postgresia, joten hidastus korjaisi ongelman jota ei
ole. Ei tehda.

Samalla kumoutuu aiempi arvaus katkon syysta: korrelaatio oli ainoa
todiste. Syy jaa tuntemattomaksi.

### Poistetun tunnuksen jaljet ja tililokin ajastus (D-119)

Kolmelta taululta puuttui kayttajaviite, joten poistetun tunnuksen rivit
jaivat kantaan: 16 kuollutta tunnusta ja niilla 251 rivia
(user_today_preferences 7, user_project_status 58, opportunity_alerts
186). Korjaus-SQL docs/sql/2026-08-24_user_cascade.sql, ajettu.

Kannassa on kolme tietoista mallia: CASCADE henkilokohtaiselle
tyodatalle, SET NULL analytics_eventsille (tapahtuma sailyy tilastossa,
henkiloyhteys katkeaa) ja ei viiteavainta lainkaan
account_lifecyclelle.
account_lifecycle on tasta tarkoituksellinen poikkeus (D-069) — sille ei
saa lisata cascadea.

Tililokin tasmaytys oli vain kasin ajettava skripti ja unohtunut 17.8.
jalkeen: 24 tunnusta oli lokin ulkopuolella. Tasmaytetty, ja ajastettu
vuorokausittain (/api/admin/sync-account-lifecycle, 03:00 UTC). Skripti
ja reitti kayttavat nyt samaa moduulia.

### Halytyksen ikkuna on vesiraja (D-118)

Tyotilaisuushalytys katsoi kiinteasti 30 tuntia taaksepain, mika tuotti
pysyvan katveen aina kun yksi ajo jai valiin. 24.8. katveeseen jai 71
hankeilmoitusta kahdeksalle maksavalle asiakkaalle.

Ikkuna alkaa nyt siita mihin edellinen ajo paasi (`alert_watermarks`),
kuten hakuvahdissa. Katto 7 vrk, `?hours=N` ohittaa yha, ja taulun
puuttuessa palataan vanhaan kaytokseen.

### Vantaa kieltaytyi koneellisesta luvusta (D-098)

Lupapyynto paatosten koneluettavasta hausta kirjattiin Vantaan kirjaamoon
11.8.2026 (VD/5640/07.01.07/2026). Kieltava vastaus 24.8.2026:
robots.txt estaa ohjelmalliset haut, toimittaja arvioi robottikutsujen
hidastavan jarjestelmaa, eika lupaa voi antaa yhdelle ilman etta se
annetaan kaikille.

Sama yhdenvertaisuusperustelu kuin Hyvinkaalla, sama tuote (Tweb) —
mutta ilman Hyvinkaan tarjoamaa RSS-vaihtoehtoa. Kaksi riippumatonta
kuntaa samalla vastauksella: Tweb-perhe on suljettu, eika kolmatta
kannata kysya samalla kysymyksella.

Vantaan paatosjarjestelmaan ei kohdisteta pyyntoja. Tarkistettu: ainoa
Vantaa-lahde on gis.vantaa.fi/geoserver/wfs (avoin karttapalvelu), eika
lahteissa ole yhtaan tweb-osoitetta.

### Security Advisorin varoitukset kayty lapi (D-117)

Nelja varoitusta, ei yhtaan vuotoa. Tiimifunktiot `is_team_leader` ja
`is_team_member` ovat tarkoituksellisesti SECURITY DEFINER ja
kirjautuneiden kutsuttavissa — runko paattelee kutsujan `auth.uid()`:lla,
joten kayttaja saa tietaa vain oman jasenyytensa.

`account_lifecycle_no_delete` kovennettiin (`search_path`, EXECUTE
peruttu). Se jai heinakuun kovennuksesta pois koska funktio luotiin
vasta 15.8. Riski oli olematon: runko on yksi `raise exception` eika
viittaa yhteenkaan tauluun.

Todennettu jalkikateen: poisto kaatuu yha triggerin virheeseen, eli
trigger-mekanismi ei vaadi kutsujalta EXECUTE-oikeutta.

### Vahti hälyttää katkosta (D-116)

Supabase-instanssi oli alhaalla 23.–24.8. noin 15 tuntia eikä kukaan
tiennyt siitä ennen kuin ylläpitäjä yritti itse kirjautua. Lokista näkyy
klo 05:22 tehty aito kirjautumisyritys, joka sai 522:n.

Uusi `/api/admin/health-check` tarkistaa viiden minuutin välein
kirjautumisen ja kannan, varmistaa epäonnistumisen uusinnalla ja lähettää
sähköpostin. Tila ei ole Supabasessa vaan Resendin idempotenssiavaimessa,
koska kanta on alhaalla juuri silloin kun vahtia tarvitaan.

**Katkon kulku lokista.** Klo 01:12 (Suomen aikaa) takautuva ajo kirjoitti
`projects`-tauluun. Klo 01:23–01:36 Postgres toisti kahdeksan kertaa
`autovacuum worker took too long to start; canceled`, mikä on merkki
resurssien loppumisesta. Klo 01:45 viimeinen onnistunut pyyntö, klo 02:40
ensimmäinen 522. Uudelleenkäynnistys korjasi tilanteen 6 sekunnissa eikä
data kärsinyt: 5 848 hanketta ja 5 799 näkyvää, samat kuin ennen katkoa.

Kolme muuta selitystä testattiin ja hylättiin: levy (246 MB, 3 % NANO:n
levystä), indeksit (kaikki tila on TOASTissa, `projects` 288 kB indeksiä)
ja jumiin jäänyt keräysajo (klo 18:05–18:13 ajo oli kauttaaltaan
`success`).

**Mittausvirhe, joka kannattaa muistaa.** Päättelin ensin viimeisen
kirjoitushetken `project_changes`-taulusta ja totesin ajojen päättyneen
tuntia ennen kaatumista. Se oli väärin: pelkkä `metadata`-päivitys ei
laukaise muutosliipaisinta, joten kysely ei voinut nähdä sitä mitä
etsin. Sama virhelaji kuin `.neq()`-ansa, jossa NULL-rivit putosivat
pois — kysely vastasi kysymykseen jota en esittänyt.

### Kuulutuksen lomakekentat nakyviin hankkeen sivulle

Kuulutus-PDF:ssa oli kenttia jotka joko poimittiin muttei naytetty tai
jotka jaivat kokonaan poimimatta: kaavan kayttotarkoitus (34 %,
"T-6; teollisuus- ja varastorakennusten korttelialue"), tontin pinta-ala
(67 %), kaavatilanne (66 %), tilavuus (29 %), kerrosala (25 %) ja
rakennusoikeus (8 %).

Oma katto hylkasi puolet parhaasta kentasta: Lisaselvitykset on vapaata
tekstia jonka mediaanipituus on 440 merkkia, ja yhteinen 400 merkin katto
hylkasi 66 kenttaa 119:sta. Katto on nyt kenttakohtainen.

Kolme korjausta naytteista luettuna: numerokentasta otetaan vain luku ja
yksikko ("102 m 2 Rakennusoikeus" -> "102 m 2"), numerokentan on
alettava numerolla, ja otsikon katkaisu tehdaan kirjainkokoriippumatta
("Eikaavaa TOIMENPIDE Va" -> "Eikaavaa").

151 jonon ehdokasta ja 74 nakyvaa hanketta sai kentat. (D-115)

### Kaavaselostuksista poimitaan yhteystiedot, rajattuna

Kaavalahteiden liitteissa oli 245 kaavaselostusta 184 hankkeelle 56
kunnassa, eika yhtakaan ollut haettu. Niissa on nimetty henkilo
puhelimineen ja sahkoposteineen - juuri se mita muualta ei saa.

Koko pakotti rajaamaan: selostukset ovat 229 000 - 884 000 merkkia.
Haetaan vain 6 ensimmaista sivua (perustiedot ovat kansilehdella),
tallennetaan vain poiminta eika tekstia, ja tiedostolla on 25 MB katto.
Luettavaa tekstia jaa 12 175 merkkia keskimaarin.

Nelja siivousta, jokainen otoksesta luettuna: malliosoite laajennetaan
nimesta, yleislaatikon yhteydessa poimittu nimi hylataan ("Risto Rytin"
on kadunnimi), alaviitteen numero katkaistaan puhelimesta, ja
asiakirjan omat sanat hylataan nimena ("Kaavaselostus Kaavaselostus",
"Selostus Copyright").

96 poimintaa, joista 76 nimettya henkiloa ja 16 kaavan laatijaa.
90 jonon ehdokasta ja 86 nakyvaa hanketta paivittyi.
Nimettyja henkiloita 1 262 -> 1 314. (D-114)

### Lupapisteen viranomaiset yhteystiedoiksi, merkittyna

Kuulutuksessa hakija on peitetty (D-102), mutta paatoksen tehnyt
viranhaltija on nimetty: Paattaja 83 %, Valmistelija 20 %. Nama
poimitaan nyt, mutta merkitaan role: "authority" ja kayttoliittyma
nayttaa merkinnan - rakennustarkastaja tuntee hankkeen muttei osta
mitaan, ja kayttajan on nahtava ero ennen kuin han soittaa.

Nimen jasennys vaati kolme korjausta, jokainen loytyi lukemalla tuotos
riveittain: genetiivi jai nimeen ("Kyllonen Tampereen"), hahmosta puuttui
i-lippu ("Neuvonen Rakennusvalvonta", "Laiteenmaki KURIKAN") ja raja osui
keskelle sanaa ("Tavaststjerna Aa"). Vaarin kirjoitettu ihmisen nimi on
pahempi kuin puuttuva, joten epavarma jaa poimimatta.

109 jonon ehdokasta ja 44 nakyvaa hanketta sai nimetyn viranhaltijan.
Nimettyja henkiloita 1 184 -> 1 262. (D-113)

### Lupapisteen kuulutus-PDF:sta luetaan nyt oikeat kentat

Kuulutuksen PDF haettiin 264 dokumentille, mutta kuvaus saatiin vain
KOLMEEN. Poimija etsi kenttaa "Hankkeen kuvaus", jota on 1 %:ssa.
Hyodyllinen teksti on lahes aina muualla:

```
Hankkeen kuvaus       3    1 %   <- ainoa jota luettiin
Toimenpide          244   92 %
Kaavatilanne        210   80 %
Pinta-ala           201   76 %
Lisaselvitykset     114   43 %
```

PDF-teksti on sarakkeetonta, joten otsikko ja arvo ovat kiinni
toisissaan ("LisaselvityksetToimistorakennus, LVI-muutos..."). Arvo
luetaan otsikon jalkeen seuraavaan tunnettuun otsikkoon asti.

Ensimmainen versio vuoti yli osioiden ("Luvan rakennukset7529104289167
Nuudisrakennus"), koska kaikkia otsikoita ei ollut listalla. Lisatty
puuttuvat ja 400 merkin katto - pidempi tarkoittaa etta katkaisu ei
osunut, ja silloin on parempi jattaa poimimatta.

Kuvaus saadaan nyt 244:lle 264:sta. Takautuva ajo: 236 lahdedokumenttia,
joista 214 sai kuvauksen ensimmaista kertaa.

Kuivaharjoitus paljasti viela kaksi roskan lahdetta: maksurivit
("Rakentamislupahakemuksen kasittelysta veloitetaan 988 euroa") ja
RAKENNELMAT-taulukon. Molemmat hylataan nyt, ja 8 jo kirjoitettua
roskakuvausta poistettiin.

Puuttuvat PDF:t haettiin kasin: 264 -> 309. Loppuja ei saatu, koska
kuulutus poistuu verkosta muutoksenhakuajan paatyttya - 241
dokumentille PDF ei ole enaa saatavilla. Kuvauksia 217 -> 244.

TIETO EI SIIRRY ITSESTAAN. Faktapoimija valitsee dokumentit ehdolla
`.is("facts_extracted_at", null)` eli kasittelee jokaisen tasan kerran,
joten lahdedokumenttiin kirjoitettu kuvaus ei paivity jo luotuihin
hankkeisiin. Siirto tehtiin erikseen: 58 jonon ehdokasta ja 24 nakyvaa
hanketta. Kuvausta ei korvattu vaan taydennettiin - vanhassa tekstissa
on kiinteistotunnus ja osoite, uudessa hakijan oma kuvaus tyosta.

### Yhteyshenkilot nakyviin hyvaksyntalistaan

Yhteyshenkilot nakyivat vain hankkeen omalla sivulla, joten hyvaksyja ei
nahnyt listasta onko ehdokkaalla ketaan kenelle soittaa. Nyt listassa
lukee joko yhteyshenkilot (nimetyt ensin) tai "Ei yhteystietoa".

### Vaihesuodattimen kuollut vaihtoehto pois, kartan selite korjattu

Vaihesuodatin tarjosi vaihtoehtoa "Valmistunut", joka palautti aina nolla
tulosta - valmistuneet on suodatettu pois jo aineistosta. Poistettu.

Kartan selitteessa luki "Valmistunut" varille jota kaytannossa kayttaa
vain Valmistumassa-vaihe. Selite sanoo nyt Valmistumassa.

Samalla selvisi etta "Valmistumassa" on maaritelty muttei koskaan
kaytossa: nolla koodipolkua asettaa sen, nolla siirtymaa
vaihehistoriassa, yksi hanke kasin asetettuna. Automaattinen saanto
(valmistumiseen alle 3 kk) koskisi 19 hanketta, mutta roleStageMatrix
antaa vaiheelle MATALAMMAN painon kuin Rakenteilla - tarkentaminen siis
laskisi osumapisteita. Jatetaan kasin asetettavaksi. (D-111)

### Hakuvahti ei enaa kerro valmistuneista hankkeista

Tanaan-nakyma ja hankelista suodattivat valmistuneet pois, mutta
hakuvahti ei - asiakas saattoi saada sahkopostiinsa hankkeen jota han ei
loyda sovelluksesta. Nyt hakuvahti suodattaa seka valmistuneet etta
vanhentuneet kilpailutukset.

Suodatus on null-turvallinen: pelkka neq() pudottaisi myos rivit joilla
kentta on tyhja, koska SQL:ssa null != 'x' on null.

Samalla tutkittiin pitaisiko valmistuminen tunnistaa myos sanoista
"valmistui" ja "otettiin kayttoon". EI PIDA: 163 nakyvaa hanketta osuu
tallaiseen sanaan, ja 16 luetusta naytteesta yksi oli aito. Loput
viittaavat rakennuksen ikaan ("Rakennus on valmistunut 1978") tai
osasuunnitelmaan ("yleissuunnitelma valmistui 2019"). (D-110)

### Valmistuneet hankkeet eivat enaa tule katselmointijonoon

Jonossa oli 19 hanketta 94:sta (20 %) vaiheessa "Valmistunut" - Iso Omena,
Olkiluodon kapselointilaitos, Sokos Hotel Turun Seurahuone. Ne tulevat
urakoitsijoiden referenssiportfolioista, jotka ovat markkinointisivuja jo
rakennetuista kohteista.

D-008:n suodatus ei estanyt niita, koska se vaatii valmistumispaivan
TEKSTISTA ja portfoliossa vaihe on rakenteinen kentta. Uusi saanto: jos
lahde itse ilmoittaa vaiheeksi "Valmistunut", ehdokas ohitetaan.

Tama oli lahella kymmenkertaistua: Kreaten koko kohdeluettelon avaaminen
toi 251 hanketta joista 301 on valmistuneita ja vain 54 kaynnissa (sama
hanke voi olla useassa taksonomiassa). Yksi yoajo olisi tuonut jonoon
~220 valmista rakennusta. Kreaten kollektori ohittaa ne nyt jo
keraysvaiheessa. (D-109)

### Ymparistoonsa tarttuneet sahkopostit korjattu

Poimittu osoite otti mukaansa edeltavan numeron ja seuraavan sanan, koska
rivinvaihdot ja elementtien rajat katoavat tekstiksi muunnettaessa:

```
8368reima.liikamaa@jatke.fiKuvatLataaLataaJatke
kirjaamo@vaala.fiOsallistumis
arttu.makipaa@kuopio.fi
044 718 5435
```

Asiakas lahettaa viestin osoitteeseen jota ei ole olemassa. 70 hanketta
12 lahteessa; 76 osoitetta korjattu, 19 tyhjennetty, 64
organisaatiokenttaa siivottu (sama roska oli vuotanut sinne).

Kaksi omaa virhetta jai kuivaharjoitukseen. Ensimmainen versio vaati
verkkotunnukselta pienaakkosia, jolloin aito "Eveliina.Etelakoski@Raisio.fi"
olisi tyhjentynyt kokonaan. Toinen olisi pienaakkostanut 594 riviä joista
vain 91 oli aitoja korjauksia - kirjainkoko ei ole virhe.

Roskan tuntomerkki on iso kirjain KESKELLA verkkotunnusta kun sita ennen
on jo kelvollinen paate. Paatelistaa ei kayteta, joten @vsb.energy ja
@diplomatie.gouv.fr sailyvat.

### Kayttajalistaan tunnuksen ika ja kokeilun tila

Suurin osa 94 tunnuksesta on testikayttajia, eika tilaus- tai
kokeilutilaa kerata mihinkaan (tietoinen valinta, laskutus hoidetaan
kasin). Ainoa asia josta kokeilun paattymisen voi paatella on tunnuksen
ika, ja se piti laskea paassa luontipaivamaarasta.

Listaan lisattiin "Ika (pv)" -sarake, joka on jarjestettavissa ja
varikoodattu: >= 30 pv punainen "kokeilu ohi", >= 23 pv oranssi
"n pv jaljella". Otsikkoriville tuli lisaksi yhteenveto, jotta luvut
nakyvat ilman selaamista.

Logiikka on omassa moduulissaan (lib/users/trial.ts) testeineen, koska
paivalaskenta on juuri se kohta jossa virhe menisi huomaamatta:
29 pv 23 h ei ole viela 30, tuntematon aikaleima ei ole "ohi", eika
jaljella oleva aika mene negatiiviseksi.

Ika lasketaan auth.users.created_at-kentasta - profiles.created_at ei
ole tilin luontipaiva.

### Vaylan kuvaukset hankesivulta, ei listauksen teaserista

Kuvaus oli listaussivun yksi virke ("Lapin elinvoimakeskuksen
paallystyskohteet kesalla 2026", 56 merkkia). Hankesivulla sama on auki
kirjoitettuna: rahoitus, kilometrit ja kohdeluettelo tienumeroineen,
kunnittain ja pituuksineen.

Sivupohjia on kaksi. Ensimmainen versio luki vain .project__intro-lohkoa
ja jatti 66 hanketta ilman kuvausta - niilla sisalto on
.content-article-lohkossa, jossa on lisaksi hankkeen perustiedot,
aikataulu ja tilaaja.

Lahdetta ei kuormiteta: neljalla rinnakkaisella haulla vayla.fi vastasi
66 kertaa 429, joten rinnakkaisuus on kaksi ja 429:lle on porrastettu
uusinta.

Takautuva ajo 372/376 rivia (99 %), keskimaarin 206 -> 2 697 merkkia.
Yksikaan teksti ei lyhentynyt. (D-107)

Ajon 173 muutosrivia poistettiin samalla perusteella kuin yhteystietojen
ajossa: vanhan hankkeen kuvauksen rikastuminen ei ole uutinen. Poisto
rajattiin ajon omiin hankkeisiin - niista 173:sta viisi oli aitoja
yoajon paivityksia (SRV, Hilma), ja pelkkaan aikaikkunaan nojaava poisto
olisi havittanyt ne. (D-104)

### Otsikoiden vartalointia ei otettu kayttoon

Espoonlahden duplikaattipari jai 50 pisteeseen kynnyksen ollessa 70,
koska otsikkovertailu on sanatarkka: "asuntoa", "asunnoille" ja
"asunnot" ovat kolme eri sanaa.

Kaksi varianttia mitattiin koko nakyvalla aineistolla. Kumpikaan ei
kelvannut: crudeStem tormayttaa "satama" ja "satava" (molemmat -> "sata"),
ja etuliitevariantti tuottaa VAARAN automaattisen yhdistamisen
(Vinkkilan asemakaava == Rautilan asemakaava), mika piilottaisi hankkeen
asiakkailta.

Kolmas kirjattu yritys laajentaa otsikkovertailua ja kolmas joka kaatuu
samaan ilmioon. Otsikko ei ole se signaali josta tasmaytysta kannattaa
parantaa. (D-106)

### Yhteyshenkilot sailyvat hankkeita yhdistettaessa

Yhdistamistyokalu taydensi metadatan vain tyhjiin avaimiin, joten
poistettavan yhteyshenkilot havisivat aina kun sailyvalla oli edes yksi.
Mitattu Espoonlahden parissa: 2 + 3 -> 4, vanhalla saannolla 2.

### Senaatin kilpailutuskalenteri - ensimmainen lahde ENNEN julkaisua

Kaikki 307 aiempaa lahdetta kertovat jostain mika on jo tapahtunut:
kaava vireilla, lupa myonnetty, kilpailutus julkaistu. Senaatin
kilpailutuskalenteri kertoo kilpailutuksesta jota ei ole viela
julkaistu - sarake on "Ennakoitu julkaisuajankohta" ja ulottuu
mitatusti 1-8 nelannesta eteenpain (2026/Q2 - 2028/Q2).

60 rivia, joista 15 rakentamista, ja kaikilla 15:lla yhteystieto
(13 nimettya henkiloa). Osuu konversioesteeseen "liian myohaan", johon
mikaan aiempi lahdetyo ei ole osunut.

Rivit ovat ENNUSTEITA: vaihe on aina Suunnitteilla, ajankohta
sailytetaan nelanneksena eika muunneta keksityksi paivamaaraksi
("2027-01-01" nayttaisi tarkemmalta kuin tieto on), ja kuvaus sanoo
suoraan etta kyse on ennakkotiedosta. Tunniste on otsikko eika
ajankohta, jottei sama hanke monistu rivin siirtyessa. (D-105)

### Kolme lahdetta joissa poiminta oli valmiina mutta katto naannytti sen

Sama vika loytyi kolmesti perakkain: yhteystietojen poiminta oli ollut
olemassa alusta asti, mutta ajokohtainen hakukatto esti sita paasemasta
luettelon lapi.

- **Vaylavirasto**: VAYLA_MAX_DETAIL_FETCHES_PER_RUN = 5, ja vain
  36/188 dokumenttia oli koskaan saanut detaljihaun. Katto 30:een,
  tyhja haku muistetaan contact_checked_at-leimalla. Takautuva ajo
  125/159 (79 %) sai projektipaallikon nimineen ja suorine numeroineen.
  (D-103)
- **Kreate**: per_page=30&orderby=modified, joten jokainen ajo nki saman
  30 tuoreimman hankkeen. Luettelossa on 251 hanketta ja meilla oli 31 -
  ja 229:lla niista on tyomaan vastuuhenkilo suorine matkapuhelimineen
  (91 %). Sivutus koko luetteloon.
- **Senaatti**: SENAATTI_MAX_DETAIL_FETCHES_PER_RUN = 10 eika 44
  hankkeen luettelo ehtinyt lapi. Lisaksi jasennin poimi vain nimen ja
  nimikkeen - puhelinta ei luettu lainkaan ja osoite jai malliksi.
  Backfill 41 hanketta.

### Malliosoitteet pois tuotannosta

Lahteet kirjoittavat yhteystiedon usein muotoon
"etunimi.sukunimi@vayla.fi". Cloudflare-purku onnistui, mutta osoite on
malli eika kenenkaan osoite - ja niita oli kannassa 376 kappaletta 21
lahteessa asiakkaille naytettavana.

Ne tyhjennettiin; nimi, nimike ja puhelin sailyivat aina. Malli
laajennetaan nimen perusteella vain RAKENTEISESTA lahteesta, koska
kuivaharjoitus kaikkiin lahteisiin tuotti roskaa: "Venna Oy" ->
venna.oy@..., "Airi Maatt" -> airi.maatt@... (katkennut sukunimi, jota
ei voi koneellisesti havaita). (D-103)

### Kuntien yleiset yhteystiedot

Kolme uudelleenkayton varianttia kaatui kuivaharjoitukseen ennen kuin
saanto oli oikea: hankkeelle tallennettu yhteystieto ei ole osapuolen
yhteystieto (Tampereen kaupunki -> kirjaamo@ely-keskus.fi), kunta ei
kelpaa varalle yksityiselle (Atria -> kaavoitus@seinajoki.fi), eika
osittainen verkkotunnusosuma kelpaa lainkaan - yleissana "kaupunki" osui
tunnukseen uusikaupunki.fi ja tuotti 794 vaaraa paria.

Voimaan jai: roolilaatikko JA TASMALLINEN kunnan verkkotunnus.
Osoitteita ei myoskaan johdeta kaavasta - Helsingin kirjaamo on
helsinki.kirjaamo@hel.fi, ja arvattu kirjaamo@hel.fi olisi mennyt 578
hankkeelle. Ne haetaan kunnan omalta sivulta ja versioidaan
lahdeviitteineen (107 kuntaa). (D-104)

Nama ovat kirjaamoja, eivat nimettyja henkiloita - nimettyjen maara ei
noussut lainkaan. Tavoite "vahintaan yksi yhteystieto" tayttyy, tavoite
"kenelle soittaa" ei.

### Yhteystiedon lisays nakyy nyt hakuvahdissa

Hakuvahti lukee project_changes-taulua, jonka kirjoittaa liipaisin
log_project_changes(). Se seuraa vain SARAKKEITA, ja contact_persons on
metadata-kentan sisalla. Mitattu: 36 h aikana 151 muutosrivia ja nolla
metadatasta, vaikka yli 1 400 hankkeen metadata paivittyi - yksikaan
takautuvasti lisatty yhteyshenkilo ei ollut tavoittanut asiakasta.

Korjaus on ERILLINEN liipaisin, ei muutos olemassa olevaan funktioon,
jonka runkoa ei ole repossa. Tiedottaa vain kun kontaktien maara kasvaa.
SQL ajettava kasin: docs/sql/2026-08-22_contact_persons_change_log.sql

Kaytanto: takautuvan ajon jalkeen poista sen synnyttamat rivit, mutta
VAIN ne joissa ei ole nimettya henkiloa. Kirjaamo-osoite vanhassa
hankkeessa ei ole uutinen; nimetty henkilo on. (D-104)

### Yhteystietojen kattavuus paivan aikana

```
lahtotilanne                       1 986   34,8 %   nimettyja      -
sahkopostiankkuri tiedotteista     2 756   48,3 %   nimettyja    682
peitetyt osoitteet + puhelin       2 941   51,6 %   nimettyja    939
Hilman ilmoitusten osapuolet       3 099   54,3 %   nimettyja  1 022
Vaylaviraston projektipaallikot    3 222   56,5 %   nimettyja  1 145
kuntien yleiset yhteystiedot       4 709   82,5 %   nimettyja  1 145
Senaatin rakennuttajapaallikot     4 739   83,1 %   nimettyja  1 184
```

Jaljella 966 hanketta (16,9 %). Kasin luoduista mitattiin ettei
niissa ole yhtaan sahkopostia tekstissa, joten LLM:aa ei kaytetty
osoitteiden tuottamiseen - ilman lahdetta se tuottaisi ne muististaan
eika tarkistustieta olisi.

### Yhteyshenkilot omaan rakenteiseen kenttaan

Kayttaja yhdisti uuden tiedotteen olemassa olevaan hankkeeseen eivatka
kolme yhteyshenkiloa tulleet mukana - ne piti lisata kasin. Yhteystiedot
ovat yksi kolmesta syysta joiden takia testiasiakkaat eivat jaaneet
maksaviksi; ne kirjattiin nyt kriittiseksi tavoitteeksi
00_PRODUCT_BLUEPRINT.md:hen, jossa niita ei ollut aiemmin lainkaan.

Yhteyshenkilot poimitaan tiedotteiden tekstista kenttaan
metadata.contact_persons, jota kayttoliittyma jo renderoi kolmessa
paikassa. Poiminta ankkuroidaan sahkopostiin, koska muoto vaihtelee
lahteittain taysin ja osoite on ainoa yhteinen elementti.

Kaksi kenttaa kayttaytyy tarkoituksella eri tavoin: additional_info
korvataan uusimmalla lahteella (vanhentunut teksti oli jaanyt voimaan
ikuisiksi ajoiksi), mutta contact_persons on VAIN-LISAAVA eika siita
poisteta koskaan mitaan. Yhdistaminen poimii vanhan tekstin kontaktit
talteen ennen korvaamista, ja vain-lisaavyys on varmistettu testeilla.

Takautuva ajo: yhteyshenkilollisia hankkeita 1 986 -> 2 773 (48 %),
joista nimetty henkilo 690. Uusia kontakteja 1 812, yhtaan vanhaa ei
menetetty. Naista 112 hanketta oli sellaisia joilla yhteystiedot olivat
pelkastaan lisatietokentassa - osa kasin lisattyja.

Viisi vikaa loytyi mittaamalla, joista yksi olisi ollut tuhoisa:
yhdistaminen avaimensi pelkkaan sahkopostiin, mutta kaavalahteiden
kontakteilla se on usein tyhja - ajo olisi pudottanut niita. (D-101)

## 2026-08 (tyo 21.8.)

### Hyvaksynta rajattu maakuntaan ja reitille asetettu aikaraja

Hyvaksynta luki koko hankekannan joka kerta sumeaa tasmaytysta varten.
Mitattu 5 752 hankkeella: haku 1 200 ms per 1000 rivia, laskenta 0,771 ms
per hanke, eli ~2 s per tuhat hanketta - ja lineaarisesti kasvava.

Tasmaytys rajattu samaan maakuntaan: skannattava joukko 5 752 -> 1 229
(21 %). Haku nopeutui Uusimaalla 4x, muissa maakunnissa 18-19x.

Rajausta ei tehty sokkona: sama tasmaytys ajettiin kaikille 99 jonon
ehdokkaalle molemmilla joukoilla. Osumat 69 -> 64, ja ne kuusi
"menetettya" ovat kaikki tiehankkeita, kaikki alle 70 pisteen eli
automaattisen yhdistamisen ulkopuolella, ja sisallolta vaaria
("Valtatien 4 tavoitetila" osui hankkeeseen "Vt 2 Pori-Helsinki").
Kaupunkirajaus olisi menettanyt 10, joten maakunta on oikea taso.

Hyvaksyntareitti oli ainoa raskas reitti ilman maxDuration-asetusta;
asetettu 60 s. Se ei nopeuta mitaan mutta muuttaa tulevan kaatumisen
siedettavaksi hitaudeksi.

Ilman maakuntaa olevat ehdokkaat (7/99) lukevat koko kannan kuten
ennenkin. (D-100)

### Hartelan asuinalueiden kuvaus ja rakennustyyppi korjattu

Kuvaukseksi luettiin koko sivun teksti, jonka alkuosa markkinoi kaupunkia
eika hanketta. Kaksi vikaa, mitattu kaikilta 15 ehdokkaalta:

Kuvaus alkoi selainkehotuksella 15/15. Poisto oli koodissa mutta trim()
ajettiin vasta sen jalkeen, joten "^Ole hyva" ei osunut koskaan - rivin
alussa oli valilyonti.

Rakennustyyppi oli vaara 6/15. Kaupungin palveluluettelosta luettuna
asuinkerrostalohanke sai tyypikseen Paivakoti (4 kpl), Koulu ja
Liikuntapaikka - sivustolla jonka nimi on "tulevat asuinalueet".

Kuvaus rajataan nyt siihen virkkeeseen josta hankeasia alkaa, ja tyyppi
suodatetaan asuintyyppeihin. Takautuva korjaus ajettu kaikille 15
ehdokkaalle: 6 vaaraa tyyppia pois, 5 tyhjaa sai oikean.

Osoitepoimijaan ei koskettu: Hervannan vaara osoite johtuu puuttuvasta
paatteesta "piha", mutta sen lisaaminen toisi 10 vaaraa osoitetta yhta
oikeaa vastaan. (D-099)

### Lupapisteen paatos-PDF luetaan keraysvaiheessa

Vantaan kuulutus LP-092-2026-02341 nakyi rajapinnassa nimella
"Rakentamista valmistelevat tyot". Paatos-PDF kertoo etta kyse on tulevien
datakeskusrakennusten ja lammontalteenottorakennuksen pohjatoista,
kaivualue 42 465 m2 ja louhinta-alue 22 621 m2. Ilman PDF:aa iso
datakeskushanke nayttaa rutiinikaivuulta.

Rajapinta antaa mitatusti 15-119 merkkia, PDF keskimaarin 6 500.

Kuulutus poistetaan verkosta muutoksenhakuajan paatyttya ja PDF sen
mukana, joten haku on tehtava silloin kun teksti on saatavilla. Se tehdaan
nyt collectorissa, budjetilla 40 per ajo, ja jo haetut ohitetaan.
Takautuva pelastusajo: 491 kuulutuksesta PDF irtosi enaa 275:lta, 216 oli
jo mennyt.

Kuvauksen poiminta rajattiin lainausmerkkeihin kahden kuivaharjoituksen
jalkeen. Pituusheuristiikka osui 15 paatoksesta yhteen ja sekin vaaraan
kohtaan; kappalehaara tuotti kolme poimintaa jotka kaikki jatkuivat
paatosmaarayksiin ja sivunumeroon asti. Nyt poimintoja on 3/275 - harvoin
mutta oikein. Koko PDF-teksti tallennetaan aina, joten siita voi poimia
lisaa myohemmin ilman etta data ehtii kadota.

Lupapiste-riveilla ei ollut lahdelinkkia lainkaan; se lisattiin. Linkki
toimii vain kuulutusaikana, mutta katselmointi osuu siihen ikkunaan.
(D-096, KL-005)

### Geneeriset hankenimet taydennetty sijainnilla

Kasin luoduissa hankkeissa oli nimia kuten "Datakeskus", "Kerrostalo" ja
"Toimitila". Asiakas nakee listassaan seitseman rivia nimelta "Datakeskus",
eivatka ne erotu toisistaan tasmaytyksessakaan.

Taydennetty 34 nimea sijainnista (scripts/backfill-generic-project-names.ts).
Vanha nimi jai also_known_as-kenttaan, joten duplikaattitasmaytys loytaa
hankkeen edelleen silla.

Rajattu kasin tehtyihin: lahteesta tulleet lyhyet nimet ovat kaavan
virallisia nimia ("Puijonsarvi", "Kytola") ja siksi oikein. 202 yhden sanan
nimesta 168 oli kaavalahteista.

Kuivaharjoitus paljasti vian ensimmaisessa saannossa: pelkka kaupunki olisi
antanut kolmelle Helsingin "Kerrostalo"-riville saman nimen "Kerrostalo,
Helsinki" eli tasan saman ongelman kuin ennen. Ne ovat Verkkosaaressa,
Oulunkylassa ja Nihdissa, joten tarkenteeksi otetaan aluenimi kun sellainen
on ja kaupunki vasta varalla. Katuosoitetta ei kayteta.

### Duplikaattitarkistus jonolle

Jono kaytiin lapi kolmella signaalilla (scripts/scan-queue-pairs.ts).
Herttoniemen kaltaisia nakymattomia pareja ei ollut yhtaan. Loytyi kaksi
aitoa duplikaattia: Vt 3 Moreenin eritasoliittyma (GRK + Vaylavirasto,
molemmat jonossa) ja Micropolis 3 (kaksi Hilma-riviä, joissa kaupunki "ii"
ja "Ii"). Molemmat yhdistetty.

Kaksi ehdokasta jotka nayttivat nimen perusteella duplikaateilta EIVAT
olleet: Kajaanissa on kaksi eri datakeskusta (SRV/CSC ja XTX Markets) ja
Rauhanniemessa kaksi eri kerrostaloa (TOAS/NCC ja YIT).

### Otsikoiden yhteiset sanat nostavat hankkeen ehdotuksiin

titleSimilarity on Jaccard: yhteiset sanat jaettuna kaikkien sanojen
maaralla. Kunnan paatosotsikko on lomaketaytetta (osoite, kiinteistotunnus,
kaupunginosat), joten lyhyt tasmallinen otsikko hukkuu siihen. "Herttoniemen
kirkon purku-urakka" ja pitka purkamislupaotsikko jakavat kaksi sanaa, mutta
Jaccard antaa 0,18 - alle 0,3:n rajan, eli nolla pistetta. Kattavuus
lyhyempaa otsikkoa vasten on 0,67.

Kattavuutta kokeiltiin tasmaytyksessa ja se kaadettiin mittauksessa:
duplikaattijono nousi 37 parista 106:een ja 69 uudesta valtaosa oli vaaria
(Helsingin katusuunnitelmapaatokset jakavat lomakekielta). Muutos peruttiin
ja lahtotaso todennettiin.

Kattavuus vietiin sen sijaan ehdotuslistaan, kahdella mitatulla rajauksella:
vahintaan kaksi yhteista sanaa, eika kuntanimi kelpaa yhteiseksi sanaksi.
Ilman jalkimmaista syntyi kolme uutta ehdotusta, kaikki vaaria ja kaikki
pelkan kuntanimen varassa. Nykyjonosta muutos tuottaa 0 uutta ehdotusta -
se on turvaverkko tapaukseen jossa osoite puuttuu. (D-095)

### Kaksi vaaraa rakennuttajaa korjattu

Lahde helsinki_paatokset asettaa rakennuttajaksi aina "Helsingin kaupunki";
kaikilla 519 hankkeella sama arvo. Useimmiten se on oikein, mutta
purkamislupapaatoksissa hakija on joku muu. Korjattu Herttoniemen kirkko
(Helsingin seurakuntayhtyma) ja As Oy Oulunkylantori 2. Alkuperainen arvo
talletettiin metadataan. Kaupungin omat yhtiot (Heka, Kiinteisto Oy
Helsingin Toimitilat) jatettiin ennalleen.

### Sama katuosoite nostaa hankkeen ehdotuksiin

Herttoniemen kirkon purku oli kannassa kahdesti, Helsingin paatoksista ja
Hilmasta, eika pari yhdistynyt eika edes noussut ehdotukseksi. Syy: osoitteita
verrataan merkkijonona, ja "Osoite Hiihtomaentie 23, 00800 Helsinki" ei ole
sama merkkijono kuin "Hiihtomaentie 23, Helsinki". Tulos oli null, ei edes
matalaa pistemaaraa. Duplikaattiskannaus ei olisi loytanyt paria koskaan:
parhaassakin tapauksessa 60, kun portti on 70.

Automaattista yhdistamista ei loysatty - samalla osoitteella on aidosti eri
hankkeita (D-090). Sen sijaan katuavain lisattiin ehdotuslistaan, joka on
ihmiselle katsottavaksi. Sama kaupunki vaaditaan.

Selauslista jarjestetaan nyt osuvuuden mukaan. Aiemmin se otti 25 ensimmaista
saman kaupungin hanketta kannan omassa jarjestyksessa; Helsingissa on 1 044
hanketta ja etsitty oli sijalla 93, joten lista ei voinut nayttaa sita.
Uudella jarjestyksella se on sijalla 1.

Mitattu koko jonosta: 164 ehdokkaasta 49:lla on katuavain, 5:lla osuma ja
niista 1 on uutta tietoa - tasmalleen tama tapaus. Ei kohinaa. (D-094)

### Kuntaluettelon laajennus mitatuilla nimilla

Kuntahaku tunsi vain perusmuotoiset kuntanimet ja kuuden rivin listan
postitoimipaikkoja. Laajennus tehtiin mittaamalla aineistosta mitka nimet
oikeasti jaavat tunnistumatta (scripts/measure-unknown-place-names.ts).

Suurin yksittainen loyto: "Pedersore" esiintyi 26 rivilla. Se ei ole kyla
vaan olemassa oleva kunta, jonka virallinen nimi rekisterissa on
"Pedersoren kunta". Samasta syysta ei loytynyt "Maarianhamina - Mariehamn".

Lisatty nelja ryhmaa aliaksia alkuperan mukaan: postitoimipaikat ja kylat,
lakanneet kunnat, ruotsinkieliset kuntanimet ja rekisterin viralliset nimet.
Kirjoitusvirheita ja monitulkintaisia nimia ei lisatty.

Tuntemattomia nimia 20 -> 6. Testi tarkistaa etta jokainen alias osoittaa
oikeasti olemassa olevaan kuntaan.

Kolme kirjoitusvirhetta korjattiin rivilta, ei aliaksena: Kokkolam ->
Kokkola, Kirkonummi -> Kirkkonummi, Pertumaa -> Pertunmaa
(scripts/fix-city-typos.ts). Kaikki kolme olivat asiakkaille nakyvia.

Kolmas korjaus paljasti ettei "Pertunmaa" ole kuntarekisterissa. Rekisteri
verrattiin Tilastokeskuksen luokituspalveluun: 308/308 tasmaa. Pertunmaa
liitettiin Mantyharjuun 1.1.2025 ja on luokituksen ainoa muutos 2024 -> 2025.

Samalla korjattu edellisen ajon virhe: suorituspaikkataydennys asetti
hankkeelle kaupungin mutta ei maakuntaa, jolloin kuusi asiakkaille nakyvaa
hanketta putosi alueittain suodatetuista nakymista. Korjattu skriptissa ja
takautuvasti (scripts/backfill-project-region.ts). Hankkeita ilman maakuntaa
on nyt 0. (D-093)

### Tyomaan osoite Hilman suorituspaikkakentasta

Hilma-hankkeiden osoite poimittiin tahan asti vain vapaasta kuvaustekstista,
joten se jai usein tyhjaksi ja piti kaivaa kasin tarjouspyynnosta.

Selvitettiin ensin voiko tarjouspyynnon PDF:n lukea automaattisesti: ei voi.
Ilmoituksen "Liitteet ja linkit" sisaltaa vain ilmoituksen oman tulosteen,
attachments-kentta on tyhja, ja varsinaiset asiakirjat ovat tarjouspalvelu.fi:n
kirjautumisen takana.

Osoite loytyi silti: eForms-ilmoituksessa on rakenteinen suorituspaikka
(BT-5101), jota ei luettu. Kentta ei tule kayttamastamme hakurajapinnasta vaan
vaatii erillisen haun ilmoitussivun rajapinnasta, joka tehdaan nyt silloin kun
osoite tai kunta puuttuu.

Takautuva korjaus: 306 vajaasta ehdokkaasta 93 sai osoitteen ja 24 kunnan,
niista syntyneista hankkeista 59 sai osoitteen ja 14 kunnan. Uusintaajo ei
loyda enaa muutettavaa. Osoitteen alkupera nakyy TIC-esikatselussa.

Kuivaharjoitus esti kaksi virhetta: kahden paallystysurakan osoitteeksi olisi
tullut tilaajan postilokero "PL 125", ja yhden ilmoituksen postinumeroksi
kuusinumeroinen "123390". Molemmat suodatetaan.

Kunta taytetaan vain jos kuntaluettelo tunnistaa sen; 15 tapauksessa kentassa
oli kyla tai ruotsinkielinen nimi ("Ylamylly", "Jakobstad"), jolloin osoite
otettiin mutta kunta jatettiin tyhjaksi. (`1a08a95`, D-092, KL-004)

### Saman Hilma-hankinnan ilmoitukset sidottu hankintatunnuksella

Sama hankinta julkaistaan useana ilmoituksena ja jokainen sai oman
ilmoitusnumeronsa, joten korjausilmoitus loi uuden ehdokkaan vaikka hanke oli
jo kannassa. Tunnisteeksi otettiin hankintatunnus, joka pysyy samana, ja
jonossa olleet duplikaatit sivuutettiin takautuvasti.

Kaavapaatokset tarkistettiin samalla: niissa ei ole tata ongelmaa, koska
kaavatunnus pysyy samana kaavan edetessa. 2 966 tunnistetta, 0 tapausta jossa
sama tunniste osuisi useaan ehdokkaaseen. (`15aa0f9`, D-091)

---

## 2026-08 (tyo 15.8.)

### Yrityslahteiden rikastus tallennettuihin riveihin

Yrityslahteiden rikastuskoukku createCompanyEnricher hakee tiedotesivun
leipatekstin ja paattelee siita kuvauksen, osapuolet, vaiheen ja
kohdetyypin. Se toimii - mitattuna kuvaus 100 % kahdeksalla testatulla
lahteella. Mutta tuonnissa koukkua kutsutaan vain viela nakemattomille
osoitteille, ja budjetti on 40 kandidaattia per ajo, joten kerran
kuvauksettomana tuotu rivi ei koskaan taydenny itsestaan.

Uusi scripts/backfill-company-enrichment.ts purkaa kertyneen jaaman:
ajaa koukun jo tallennettujen rivien yli, taydentaa kuvauksen,
urakoitsijan, kohdetyypin ja euromaaran. Ei ylikirjoita olemassa
olevaa tietoa muuten kuin kuvauksen osalta eika peruuta vaihetta
taaksepain.

Huom aiempaan kirjaukseen: vaite "13 lahdetta palauttaa kuvauksen
0 %:lla" oli mitattu ilman --enrich-lippua, eli ennen koukkua. Lahteet
eivat ole rikki. Ks. roadmap 3¾.

### Hankkeen euromaarainen arvo: kolme katkennutta kytkentaa

Arvo oli 4 %:lla aktiivisista hankkeista. Kyse ei ollut puuttuvasta
datasta vaan siita ettei sita viety perille.

Hilman sopimusarvo poimittiin jo faktana metadata.contract_value:hyn,
mutta syncApprovedProject paivitti vain metadatan eika koskaan
estimated_cost-saraketta: 105 hankkeella oli sopimusarvo, ja niista
104:lla sarake oli tyhja. Tekstipoimija extractCostFromText oli
olemassa mutta sita kutsuttiin vain kasin ajettavasta skriptista, eli
uudet hankkeet eivat saaneet kustannusta lainkaan. Ja poimija tunnisti
vain miljoonia, joten alle miljoonan hankkeet olivat rakenteellisesti
nakymattomia - Hilman sopimusarvojen mediaani on 278 600 €.

Ratkaisu keskitettiin resolveProjectCost-funktioon, joka merkitsee myos
arvon alkuperan (metadata.cost_source: contract | text). Eksakti
sopimusarvo ja arvio eivat saa nayttaa samalta, ja sopimusarvo saa
korvata arvion muttei toisinpain. Poiminta ajetaan nyt
resolvePotentialProjectissa kaikille lahteille, kuten valmistumisajan
paattely.

Kattavuus 200 -> 315 / 5 607, joista 104 on eksaktia sopimusarvoa.
Jonossa 197 rivia odottaa hyvaksyntaa. Olemassa olevista 200 arvosta
tasmalleen yksi muuttui (425 000 -> 395 000, arvio korvautui
sopimusarvolla). Ks. D-072.

### Puolet kayttajista sai vihdoin vaihepisteytyksen

Rooli "Muu" oli pisteytysmatriisissa tyhja, joten 13 tilia 26:sta ei
saanut lainkaan sita moduulia joka on P1:n suurin yksittainen (40 p
160:sta). Syy ei ollut kayttajissa: "Muu"-tilien verkkotunnukset olivat
henkilostovuokrausta (4 tilia), erikoisurakointia, konevuokrausta ja
mittauspalvelua - yhtaan naista ei ollut yhdeksan vaihtoehdon listalla.

Roolin paattely toimialasta suljettiin pois, koska avainsanoja oli
asettanut 0 tilia 26:sta - ja se johtuu siita ettei niita kysyta
pakollisessa aktivointimodaalissa lainkaan, toisin kuin roolia ja
myyntihetkea (26/26 on siis pakotettu luku, ei vapaaehtoinen).
Painon ratkaisu on nyt kolmiportainen: rooli -> kayttajan omat
myyntihetket -> mitattu oletus. Nelja puuttunutta roolia lisattiin ja
niiden painot johdettiin samojen tilien omista valinnoista.

Pikkulappu jolla oli iso vaikutus: myyntihetkimoduuli vertasi vapaaseen
tekstiin viidella substring-saannolla, joten "Sopimus myonnetty",
"Valmistumassa", "Valmistunut" ja "Ideointi" eivat tuottaneet pisteita
koskaan. Nyt vertailu on kanoniseen vaiheeseen.

Mitattuna todellisilla asetuksilla: "Muu"-tileilla vaihepisteet
nousivat nollasta keskimaarin 43 %:lle hankkeista, mutta top 20 vaihtui
vain 3/20 - koko ja tuoreus hallitsevat yha karkea. Roolillisilla
vaihtui 8/20, ja se tuli kokonaan vaihesanaston korjauksesta. Ks. D-071.

---

## 2026-08 (tyo 12.8.)

### Lahdepaikkoja 14 -> 20 per ajo

Vuorokauden refresh_minutes ei toteutunut lahellakaan: 299 lahdetta ja
13 perustason paikkaa per ajo (yksi paikka menee aina Hilmalle) = 52
lahdetta vuorokaudessa, eli taysi kierros 6 vrk. Korjatun lahteen paluu
terveeksi kesti siis paivia.

Nosto perustuu kahteen mittaukseen. Aika: lahteet veivat 14.8. klo 21
yhteensa 317 s 380 sekunnin budjetista, 15.8. klo 12 samat 14 paikkaa
veivat ~138 s - ero tulee nahty-tarkistuksen korjauksesta. Jonot:
kasittelypuoli on tyhja, 0 dokumenttia odottaa faktojen poimintaa.

Valivaiheet nostettiin samassa suhteessa. Kierros 6 -> 4 vrk ja
vanhentumisraja 9 -> 6 vrk. Kesto on mitattava Ajot-sivulta parin ajon
jalkeen; oma rajamme on 500 s ja alustan kova katto 800 s.

---

### Keskeytetty hankinta ei ole enaa "Sopimus myonnetty"

Hilma julkaisee hankinnan keskeyttamisen samalla ilmoitustyypilla kuin
sopimuksen myontamisen, joten peruttu kilpailutus sai vaiheen "Sopimus
myonnetty" - asiakkaalle kerrottiin etta urakka on annettu jollekin
vaikka ketaan ei valittu. Kolme tallaista rivia oli nakyvissa.

Hilman oma isCancelled-kentta on false myos aidoilla
keskeytysilmoituksilla, eika notice_type erottele niita (tyyppi 29: 83
rivia joista 5 keskeytyksia). Voittajan puuttuminen yksin on liian
loysa: 45 sopimusilmoitusta ilman voittajaa, joista vain 10
keskeytyksia. Tunnistus tehdaan otsikon ja voittajan puuttumisen
yhdistelmalla - osuu kaikkiin 11 eika yhteenkaan vaaraan.

Hanketta ei hylata: keskeytetty kilpailutus kilpailutetaan yleensa
uudelleen, joten liidi on yha aito. Vaihe palautetaan kilpailutukseen.
Korjattu 10 rivia.

---

### Tunnuksesta jaa pysyva merkinta, ja kayttajatilanteen seuranta

Tunnuksen poisto oli kova poisto eika siita jaanyt mitaan jaljelle.
Uusi taulu account_lifecycle saa merkinnan jokaisesta tunnuksesta: ei
vierasavainta auth.users-tauluun, poisto estetty triggerilla, vain
lisayksia. Kaikki 73 tilia kirjattu. Yllapito on tasmaytys
(scripts/sync-account-lifecycle.ts), ei triggeri Supabasen omaan
skeemaan.

Kaksi raporttia: scripts/report-accounts.ts (montako tilia luotu,
milloin, mille yrityksille) ja scripts/snapshot-users.ts (kuka niista
kayttaa tuotetta). Tilannekuva kirjataan docs/10_USERS.md:hen.

Mittauksessa loytyi kaksi vikaa omassa laskennassa. profiles.created_at
ei ole tilin luontipaiva vaan profiilirivin luontipaiva - 40 rivia oli
luotu samana paivana taulun kayttoonoton taydennysajossa, ja 51 tilia
73:sta oli eri paivalla kuin auth.users. Lisaksi yksi admin-tili tuotti
93 % kaikista tapahtumista, mika teki jokaisesta keskiarvosta
merkityksettoman.

Tilaus- ja trial-tilaa ei kerata: omistaja laskuttaa asiakkaat itse.

---

### Kasitelty kandidaatti muistetaan, myos hylatty

Nahty-tarkistus kysyi project_sources-taulua, joka vaatii project_id:n
eli vastaa kysymykseen "syntyiko tasta hanke". Hylatty kandidaatti ei
jattanyt sinne jalkea, joten se tuotiin ja hylattiin uudelleen joka
ajossa. Ikkuna oli lisaksi 24 h, kun lahteiden ajovali on myos 24 h -
ikkuna joka ei ole pidempi kuin ajovali ei ohita mitaan.

Mitattu stt_haku: 861 kandidaatista 859:lla oli jo tuontitapahtuma ja
vain 2 oli aidosti uusia, mutta tuontiin meni 866 - noin 12 minuuttia
tyota 90 sekunnin budjetissa.

Tarkistus lukee nyt project_import_events-taulua ja ikkuna on viikko.
Todennettu: stt_haku 874 -> 50 tuontiin, rakennuslehti 16 -> 2.

Hinta: kuvaustaydennys ajetaan vain nakemattomille kandidaateille, eli
jo tuodun rivin kuvausta ei enaa taydenneta tata kautta. Takautuva
taydennys hoidetaan omilla skripteillaan.

---

### "Ongelmia 13" oli enimmakseen oman valvonnan jalkia

TIC naytti 13 rikkinaista lahdetta. Mitattu: 2 062 ajoa, mediaanikesto
4,1 s, ja viimeisesta 1 000 ajosta 971 onnistui. Aidosti rikki oli yksi.

Vahtikoira leimasi jumiajon virheeksi siivoushetkeen, joka voi olla
viikkoja ajon jalkeen - Rovaniemen Kaavatorin virhe oli oikeasti 20.7.
mutta leimattuna 13.8. Aikaleima otetaan nyt ajon omasta alusta, ja
kesto rajataan tuntiin (aiemmin kirjautui 2 131 658 s). Vanhat rivit
korjattiin ajolokista: 4 lahdetta lakkasi nakymasta rikkinaisena.

Yli viikon vanha korjaamaton virhe naytetaan omana tilanaan eika
lasketa "ongelmiin". Katkaisuviesti ei enaa syyta lahdetta: 90 s raja
kattaa koko ajon, ei pelkkaa hakua.

STT oli se yksi aito, ja syy oli katkaisu itse: sen onnistuneet ajot
kestivat 209-216 s, eli 90 s raja teki onnistumisen mahdottomaksi.
Tuonti lopetetaan nyt siististi ennen katkaisua ja ajo kirjataan
onnistuneeksi silla mita ehdittiin.

Samalla korjattiin kaatava vika: nahty-tarkistus pilkkoi osoitelistan
sadan paloihin, ja STT:n pitkilla osoitteilla pala oli 17 585 merkkia -
yli PostgRESTin 16 kt otsikkorajan. Pala mitoitetaan nyt pituuden
mukaan.

---

### Urakoitsija myos ingressista, artikkelin loppu ja kuvateksti

Edellinen saanto ei poiminut urakoitsijaa silta rivilta josta se sai
alkunsa ("Nyab rakentaa sahkoaseman Forssaan"), koska otsikko ei nimea
tilaajaa. Tilaaja on kuitenkin ingressissa: "Nyab on sopinut Fingridin
kanssa ... rakentamisesta". Todiste kelpaa nyt myos sielta.

Sopimuskumppanin nimea ei poimita - genetiivin perusmuoto ei ole
yksikasitteinen. Urakoitsijapaattelyyn riittaa todiste erillisesta
tilaajasta.

Allatiivi hyvaksytaan enaa otsikossa ja vain jos se ei ole paikannimi:
"rakentaa pysakointitalon Hyvinkaalle" ei nimea tilaajaa vaan
maaranpaan. Mitattu 1 tapaus 57:sta.

Artikkelin katkaisu ei enaa nojaa maksumuuriin. Maksuttomassa jutussa
sita ei ole, jolloin teksti jatkui naapuriartikkelien otsikoihin:
"Harmalanojan silta" venyi 4 000 merkkiin. Se muuttui vaaralliseksi kun
kuvauksesta tuli todistusaineistoa - naapurijutun yritysnimi olisi
vaara urakoitsija. Nyt sama juttu on 2 778 merkkia.

Kuvateksti (figcaption) poistetaan kaikilta tiedotelahteilta. Teksti
alkoi "Kuvituskuva. Kuva: Nyab", eli valokuvaajan krediitti oli juuri
siina ikkunassa josta osapuolet luetaan.

Ajettu: 50 kuvausta haettu uudelleen, 2 urakoitsijaa taydennetty.
Rakennuttaja jaa yha tyhjaksi (Fingrid); se vaatii genetiivin
perusmuodon paattelyn.

---

### Urakoitsija otsikosta, artikkelin teksti ja pelkka vuosi

Kolme puutetta samalta rivilta. Urakoitsija poimitaan nyt uutisotsikosta
kun tilaaja on allatiivissa - pelkka "X rakentaa" ei riita, koska
omaperusteisessa tuotannossa tekija on rakennuttaja. Saanto osuu 57
riviin joista 42:lla nimi oli jo kirjattu samana.

Rakennuslehden kuvaus haetaan artikkelisivulta RSS-ingressin sijaan
(56 -> 223 merkkia), maksumuuriin katkaisten jottei muiden artikkelien
otsikoita paady kuvaukseen.

Pelkka vuosi ilman kuukautta poimitaan nyt valmistumisajaksi (109
rivia oli tassa tilassa). Samalla korjattiin piileva vika: "valmis"
-vartalo osui myos sanaan "valmistelu", joka tarkoittaa painvastaista.

Ajettu 15 urakoitsijaa ja 277 valmistumisaikaa.

---

### Vaihepaattely oli kuollutta koodia tiedotelahteille

"Nyab rakentaa sahkoaseman Forssaan" jai vaiheeseen Suunnittelussa
vaikka kuvaus sanoo "Rakentaminen alkaa elokuussa". Syy: tekstipaattely
ajettiin vain jos lahde ei antanut vaihetta, ja noin 20 lahdetta asettaa
sen kiinteasti - ehto ei tayttynyt koskaan.

Avainsana yksin ei riita, ja se mitattiin: Rakennuslupa-osumista yksi
kuudesta oli oikein, Kilpailutus osui aikataululistaan ja Rakenteilla
sisalsi "rakentaminen alkaa suunnitelmien mukaan 2028". Teksti saa nyt
siirtaa vaihetta vain rakentamisen alkamiseen ja vain kun ajankohta on
mennyt.

Vartija poimi ensin vaaran vuoden: "alkaa elokuussa ja valmista on
vuonna 2028" antoi 2028. Ikkuna katkaistaan nyt lauseenosaan.

Ajettu 13 rivia.

---

### Kerays ja kasittely omiin cron-kutsuihinsa

Ajokohtainen budjetti paljasti pullonkaulan heti: 14.8. klo 21 ajo
paattyi merkintaan `stopped_at: "facts"`. Lahteet veivat 317 s 380
sekunnin budjetista, faktavaihe ehti 14 tyota ja jono kasvoi 34 -> 41.

Kerays on kunnossa, kasittely ei pysy perassa. Toinen cron ajaa nyt
kymmenen minuuttia myohemmin (`?mode=process`) omalla budjetillaan:
120 faktatyota ja 40 tunnistuksen kiinniottoa aiemman 45/5 sijaan.

Jako oli jo kuvattu discoveryPipeline.ts:n kommentissa suunnitelmana
mutta jaanyt kytkematta vercel.jsoniin.

---

### Ajokohtainen aikabudjetti

Lahdekohtainen 90 s katkaisu ei riittanyt: 14.8. klo 15 ajossa nelja
hidasta yritystiedotelahdetta osui perakkain (Asura 55 s, SRV 92 s
katkaistu, Jatke 112 s katkaistu) ja Tekova alkoi vasta +375 s.
Alusta tappoi funktion 500 s katossa kesken Tekovan.

Tapettu ajo katoaa tilannekuvasta kokonaan, koska lokirivi kirjoitetaan
vasta lopussa. Budjetti (380 s) pysayttaa uusien toiden aloittamisen,
jolloin ajo paattyy siististi ja kertoo mihin se ehti. Tarkistus on
jokaisen vaiheen silmukassa, ei vain lahdevaiheessa.

---

### STT-lahde ei jumittunut vaan oli liian hidas

Rajapinta vastaa moitteetta; lahde oli vain liian hidas mahtuakseen ajon
budjettiin. Mitattu: 58 pyyntoa ja 59,6 s pelkkaan hakuun, keskimaarin
1 027 ms per pyynto. Ajo ylitti reitin maxDurationin, alusta tappoi sen
kesken, eika rivi paivittynyt - siita ikuinen "started"-tila.

Hakusanat haetaan nyt kuusi kerrallaan rinnakkain: 59,6 s -> 15,1 s,
sama 876 kandidaattia. Jokaisella pyynnolla on 15 s katkaisu, koska yksi
hakusana vastasi kerran 15,5 sekunnissa mediaanin ollessa noin sekunti.

Huom: ensimmainen arvioni (440 pyyntoa, 200 s) oli vaara, koska mittasin
sivukoolla 20 kun todellinen on 100.

---

### Jumittunut lahde pysaytti keraysputken kahdeksi paivaksi

Cron kasittelee 14 lahdetta ajossa, mutta 11.8. klo 12 lahtien jokainen
ajo kasitteli enaa kaksi: Hilman ja yhden jumittajan (ensin YVA, sitten
STT). 70 lahdetta 300:sta jai ajamatta viikoksi.

Kolme korjausta: 90 sekunnin aikakatkaisu lahdeajolle, `last_run_at`
kirjoitetaan ajon ALUSSA (jotta jumittunut lahde ei pysy ikuisesti
jonon karjessa), ja vahtikoira merkitsee yli tunnin `started`-tilassa
olleet ajot virheiksi.

Aikakatkaisu mitoitettiin ajon budjettiin: maxDuration on 500 s ja
lahteita 14, joten viiden minuutin raja olisi syonyt 60 % budjetista
eika olisi korjannut mitaan.

Siivottiin 18 kesken jaanytta ajoa.

---

### Kohdetyyppi LLM:lla: 35 % -> 59 %, 198 arvoa -> 20

Kohdetyyppi on asiakkaan ensisijainen suodatin ja oli kahdella tavalla
rikki: 3 688 rivilta puuttui, ja asetetuissa oli 198 eri arvoa - "Koulu"
ja "koulu" erikseen, "Tuulivoima" ja "Aurinkopuisto" erikseen.

Kontrolliajo ennen kirjoitusta 100 rivilla joiden tyyppi tiedetaan
otsikosta: 94 samaa mielta, 4 tyhjaa, 2 eri mielta. Tarkkuus vastatuissa
98 %. Saanto ajetaan ensin, LLM vain kun saanto ei osaa.

Sanasto on suljettu (20 arvoa) ja tyhja on sentineli EI_TIEDOSSA.

Lopputulos: 1 907 -> 3 174 rivia (59 %), eri arvoja 198 -> 20.

---

### Duplikaattien purku ja energiaparien vaimennus

Taysi duplikaattiskannaus massahyvaksynnan jalkeen paljasti kaksi vikaa.

41 vahvistetusta duplikaattiparista 21:lla molemmat rivit olivat yha
asiakkaan listalla - vahvistus on paatos, purku erillinen toimenpide.
Purettu, ja tieto siirrettiin ennen piilotusta (19 rivia sai lisatietoa).

68 uudesta ehdokkaasta 51 oli energiahankkeiden ristiinpariutumista:
"Vitsakankaan tuulivoimaa koskeva osayleiskaava" vs "Pitkamaan
tuulivoimaa koskeva osayleiskaava". Eri paikannimi samassa kunnassa on
nyt ehdoton veto.

Testi paljasti piilevan vian: pysaytyssanastossa oli "tuulivoima" mutta
ei partitiivia "tuulivoimaa", joten yleissana laskettiin paikannimeksi.
Se saattoi YHDISTAA kaksi eri tuulipuistoa. Sanasto perustuu nyt
vartaloihin.

---

### Luvattu valmistumisaika erotetaan aikataulusta

Kayttoonottopaivien poiminta (edellinen kohta) oli oikea poiminta mutta
vaara johtopaatos. NCC:n hankesivu todisti: kaupungin tarveselvitys
lupasi Kirsikkapuiston paivakodin kayttoon 8/2023, mutta rakentaminen
kesti 1/2024-5/2025 ja kohde luovutettiin 8/2025 - kaksi vuotta
myohemmin.

`estimated_completion` ohjaa auto-completea, joten tavoitteen
kirjoittaminen kenttaan olisi piilottanut tyomaan juuri kun se alkoi.
Tavoite tunnistetaan paatoksen tyypista (tarveselvitys, hankesuunnitelma,
lausunto) tai yli 18 kuukauden etaisyydesta paatokseen.

Mittaus paljasti myos mahdottomia paivia: pienimmillaan -124 kuukautta
eli valmistuminen vuosia ennen omaa paatostaan.

171 rivia siirtyi `metadata.planned_completion`-kenttaan ja 42
mahdotonta paivaa poistettiin. Naista 99 oli jo mennyt.

---

### Kayttoonotto tunnistetaan valmistumiseksi

Jonossa oli tarveselvityksia paivakodeista jotka ovat jo auki. Abraham
Wetterin tien paivakoti (paatos 8/2021) toimii tanaan nimella Paivakoti
Kirsikkapuisto, ja sen omassa tekstissa lukee "Uudisrakennus otetaan
kayttoon kalustettuna elokuuhun 2023 mennessa".

Poimija vaati "valmis"-vartaloisen sanan eika tuntenut kayttoonottoa,
eika kuukausikuvio tunnistanut illatiivia ("elokuuhun"). Mitattu: 31
jonorivia kaytti muotoa, ja vain kaksi sai paivan.

Vaistotilan kayttoonotto suljetaan pois - se on painvastainen signaali,
koska vaistotila otetaan kayttoon kun tyo alkaa. Este luetaan vain
samasta lauseesta, koska kuvauksissa mainitaan usein etta vaistotiloja
ei tarvita.

Loysi myos regression: kuukausipaatteen valinnaisuus paasti lapi
rakennusvuoden (1982-08-31). Vuosi rajattu 2000-luvulle.

155 rivia sai valmistumisajan, jonosta siirtyi 13. Jono 538 -> 525.

---

### Lyhyet tyot merkitaan valmistuneiksi hanketyypin mukaan

Voiko lahteesta paatella onko hanke paattynyt? Mitattu: ei suoraan.
Valmistuminen ei ole paatos - koko Ahjon indeksissa (143 318 paatosta)
"loppuselvitys" esiintyy 8 otsikossa ja "vastaanottotarkastus" 0:ssa.
Sana "valmistui" paatosteksteissa tarkoittaa lahes aina kohteen
alkuperaista rakennusvuotta ("Rakennus on valmistunut 1976"), joten
saanto sen varassa sulkisi peruskorjaushankkeita.

Sen sijaan hanketyyppi kertoo: purkupaatos tehdaan ja tyo tehdaan
kuukausissa, kun peruskorjaus saa kestaa vuosia. `selfCompletingWork.ts`
merkitsee purkuhankkeen tehdyksi kun paatoksesta on yli kaksi vuotta.
Yleinen ikaraja olisi sulkenut Finlandia-talon perusparannuksen, joka
oli vuosia kesken ja koko ajan elossa.

Ajettu: 27 jonorivia ja 6 asiakkaille nakyvaa hanketta, jotka olivat
kaikki vuodelta 2020 ja yha vaiheessa "Suunnittelussa".

---

### Helsingin tuoreusraja ei ollut voimassa lainkaan

Jonoon ilmestyi 2021-vuoden paatoksia. Syyta etsiessa loytyi kaksi vikaa:
muoto "5 kk/2021" jai valmistumisajan poimijalta huomaamatta (22 rivia,
18 mennytta), ja Helsingin lahteen 18 kuukauden tuoreusraja oli tehoton.

Elasticsearch tulkitsee paljaan luvun epoch-millisekunneiksi, joten
sekunteina annettu raja tarkoitti sille 21.1.1970. Mitattu: sama kysely
ilman suodatinta ja sekuntirajalla palautti kummallakin 143 318 osumaa,
vanhin 2015. ISO-merkkijonolla 25 943, vanhin 2025-02-13.

Lisaksi paatospaiva tallennetaan nyt (`metadata.decision_date`) kaikista
kolmesta paatosalustasta. Dynastyssa ja CaseM:ssa kokouspaiva oli jo
jasennetty suodatusta varten mutta heitetty pois, joten hankkeen ikaa ei
voinut mitata lainkaan.

Paivat haettiin myos takautuvasti asiatunnuksella: 1 156 / 1 209 rivia
(96 %), ja jonon jokaisella 579 rivilla on nyt paatospaiva. Valitaan
asiatunnuksen UUSIN paatos, ei vanhin - 2021 avatussa asiassa voi olla
2026 tehty paatos, jolloin hanke on elossa.

Jono 596 -> 579. Jonossa on 211 rivia joiden viimeisin paatos on yli
kolme vuotta vanha, asiakasnakymassa 74.

---

### Asiakirjan valmistuminen erotetaan hankkeen valmistumisesta

Valmistumisajan poimija vartioi paivaa pelkalla "valmis"-vartalolla, ja
hankkeen alussa valmistuu papereita: "kehitys- ja hankesuunnitelmat
valmistuvat elokuussa 2026" olisi merkinnyt 45 M€:n sairaalahankkeen
valmiiksi, vaikka tyomaavaihe on 2027-2028.

Paiva hylataan nyt jos valmistuva subjekti on asiakirja (suunnitelma,
kaava, selvitys, selostus, auditointi). "Suunnitelman mukaan rakennus
valmistuu" on poikkeus, koska siina suunnitelma on vain viittaus.

Ehdokkaat 87 -> 26, joista 24 tulevia ja 2 menneita (molemmat
tarkistettu kasin). Kirjoitettu jonoriveille.

---

### STT-tiedotteiden leipateksti ja kustannusarvio

Tiedotteen leipateksti haetaan erikseen, mutta budjetti (40/ajo) kului
aina listan alkuun koska jarjestys on ajosta toiseen sama - 186 jonorivia
ja 66 hyvaksyttya oli yha pelkan metadescriptionin varassa. Kandidaatit
jarjestetaan nyt tallennetun kuvauksen pituuden mukaan, lyhin ensin.
Olemassa olevat 254 rivia haettiin erikseen (`backfill-stt-bodies.ts`),
47 sai samalla kunnan.

Uusi kustannuspoimija (`extractCostFromText`) ankkuroi nimettyyn
lauseeseen eika summan laheisyyteen: laheisyysehdolla 391 osumaa joista
useita vaaria (koko maan vuosibudjetti, palveluhankinta, tilauskanta),
ankkuroituna 49 joista jokainen tarkistettu. Hyvaksynta siirtaa arvon nyt
`estimated_cost`-sarakkeeseen, mika ei aiemmin tapahtunut lainkaan.

Valmistumisaikaa ei taydennetty: teksteissa "hankesuunnitelmat valmistuvat"
tarkoittaa suunnitelmaa, ei rakennusta.

---

### Kuvausvika loytyi 19 keraajasta lisaa

D-047 korjasi nelja keraajaa, mutta haku loysi vain yhden kirjoitusasun.
Sama asia oli kirjoitettu myos `paragraphs.find((p) => p.length > 40)`
-muodossa 16 kertaa. Mitattu: 79 kaavalahteella 205:sta kuvauksen
mediaani oli alle 250 merkkia.

Uudelleenkerays ei yksin riittanyt: Seinajoki ja Kerava valimuistittavat
alasivun haun ja ohittavat sen kokonaan jos arvo on jo tallessa. Merkinta
on nyt mitatoitavissa (`--refetch`), ja keraysta ajetaan silmukassa koska
haku on rajattu kahdeksaan sivuun ajoa kohti.

21 keraajaa 23:sta parani, 475 dokumenttia. Pieksamaki 194 -> 1421,
Kirkkonummi 390 -> 1262, Valkeakoski 131 -> 516, Seinajoki 174 -> 344.
Lappeenranta ja Ilmajoki eivat liikkuneet, mutta niilla ei ole sivuilla
enempaa tekstia poimittavaksi.

---

### Tuulipuiston paikannimi tunnistaa saman hankkeen kahdesta menettelysta

Tuulivoimahanke tulee meille kahtena rivina: kunnan osayleiskaavana ja
ELY:n YVA:na, eri nimella ja eri lahteesta. Mitattu viidella
varmennetulla parilla: kaksi ei tuottanut tasmaytyksessa osumaa lainkaan
ja loput jaivat 38-50 pisteeseen (yhdistys vaatii 70).

Tunnistus perustuu paikannimeen, joka on kunnan sisalla yksiloiva.
Kuntanimet, sahkonsiirto, ilmansuunta ja laajennus pudotetaan - kukin
loytyi mittaamalla vaarat osumat. Aiempi different_name_subjects-saanto
leikkasi kaikki parit 65:een, koska eroavat sanat kertovat menettelysta
eivat kohteesta; kappi ohitetaan kun paikannimi on todistanut kohteen.

Painoarvoa ei nostettu niin etta maantiede yksin ylittaisi kynnyksen -
siita on jo maksettu oppi (16 vaaraa yhdistymista 73 pisteella).
Jo kannassa olleet parit purettiin erikseen
(`merge-energy-site-duplicates.ts`): 29 yhdistettiin ja 14 jai jonoon
ehdotukseksi. Jokainen 29 hankkeesta sai ensin YVA-rivin rakennuttajan
ja/tai pidemman kuvauksen, joten yhdistaminen ei havittanyt tietoa.
Jono 805 -> 762.

Loput 14 luettiin lapi kasin ja yhdistettiin `--min=40`. Kuvaukset
LIITETAAN, ei korvata: ensimmainen versio otti pidemman tekstin, jolloin
kaavarivin oma teksti havisi 25 hankkeelta. Kaavateksti kertoo hankkeen
etenemisen - Ranualla se sisalsi tiedon etta hanketoimija keskeytti
kaavoituksen 17.4.2026. Tekstit palautettiin lahdedokumenteista
(`restore-merged-kaava-descriptions.ts`) ja Kupinavaaran vaiheeksi
merkittiin Peruttu.

---

### Kunta taydennettiin - mutta vain kun tilaaja on paikallinen

Hilma-rivit jaivat ilman kuntaa vaikka tilaajan osoitteessa oli
postitoimipaikka. Mitattu: kun seka ilmoituksen teksti etta osoite
antoivat kunnan, ne olivat eri mielta 16 kertaa 24:sta - osoite on
valtakunnallisilla toimijoilla paakonttori, ei tyomaa.

Lisatty yksi periaatteellinen poikkeus: yhden kohteen kiinteistoyhtion
osoite ON kohde ("Kiinteisto Oy Eliel Saarisen tie 41-45"), joten sille
ei vaadita vahvistusta tekstista. Valtakunnalliset suljetaan pois nimen
perusteella - Puolustuskiinteistot sisaltaa sanan "kiinteisto" mutta
rakennuttaa koko maahan.

Taydennetty 150 jonorivia ja 14 hyvaksyttya hanketta
(`backfill-missing-municipality.ts`). 148 jatettiin tyhjaksi
tarkoituksella.

---

### YVA-menettelyn tila luetaan nyt lahteesta

Jokainen YVA-rivi sai kovakoodatun vaiheen "Suunnittelussa", vaikka
lahde kertoo tilan itse kentassa `projectPhase` - kentta oli haettu
alusta asti mutta jaanyt kayttamatta. Mitattu 1324 hanketta:
"Paattynyt / perusteltu paatelma annettu" 1073, "Vireilla" 251.

Tila EI kaanny vaiheeksi: "paattynyt" tarkoittaa etta YVA-menettely on
ohi ja hanke etenee luvitukseen, ei etta hanke olisi valmis. Vaiheeksi
"Valmistunut" mappaaminen olisi siivonnut yli tuhat elavaa hanketta pois
jonosta ja asiakasnakymasta. Tila talletetaan kenttaan
`metadata.yva_status` ja kirjoitetaan kuvauksen alkuun.

Taydennetty 288 jonorivia ja 122 hyvaksyttya hanketta
(`backfill-yva-status.ts`).

---

### Kaavan kuvaus katkesi ensimmaiseen kappaleeseen - ja piilotti datakeskuksen

Kirkkonummen Microsoft-datakeskus (50 ha) loytyi meilta vasta YVA-lahteen
kautta 11.8. Syyta etsiessa paljastui etta naapurikaavan "Energiakuja"
kuvaus katkesi ennen kohtaa jossa lukee "Microsoft 3465 Oy:n
datakeskuskokonaisuus" - nelja keraajaa poimi vain ensimmaisen
`<p>`-kappaleen ja hylkasi loput ennen relevanssiluokitusta.

Energiakuja ei ole datakeskus vaan sen naapuritontti (8,2 ha), joten
YVA oli aidosti ensimmainen lahteemme: hanke on yksityinen eika osu
Hilmaan tai kunnan hankintapaatoksiin. Tekstin laajennus ei siis olisi
loytanyt datakeskusta aiemmin, mutta naapurin kaavan maininta on
itsessaan signaali alueen rakentamisesta.

Kuvaus kerataan nyt 1500 merkin budjetin verran useasta kappaleesta, mika
pitaa mukana kuvailevan alkuosan mutta katkaisee ennen paatoshistoriaa ja
liitelinkkeja. Kirkkonummen kaavasivuilla kuvauksen mediaani nousi 390 ->
1262 merkkiin. Muuttuneet dokumentit (42) ajettiin putken lapi ja jo
hyvaksytyt hankkeet taydennettiin erikseen (26 rivia).

Uudet skriptit: `recollect-descriptions.ts`, `backfill-kaava-descriptions.ts`.
Taydennys vain laajentaa - rivi paivitetaan vain jos uusi teksti alkaa
tasmalleen vanhalla, jolloin kasin tehtya muokkausta ei voi hukata.

---

## 2026-08 (työ 9.8.)

### Hilman lahdelinkki puuttui kokonaan - ja rakennettu osoite oli vaara

"Avaa lahde" ei tehnyt mitaan Hilma-riveilla: `source_url` puuttui
kaikilta 320:lta. Korjatessa paljastui isompi vika - kerajan
lahdeasiakirjoille rakentama osoite vei sivulle "Ilmoitusta ei loytynyt".
Oikea muoto tarvitsee myos menettelyn tunnisteen:
`/fi/public/procedure/{procedureId}/enotice/{noticeId}/`.

Virhe ei ollut nakynyt, koska Hilma on yksisivusovellus: vaara polku
vastaa 200:lla ja samalla 9 656 tavun kuorella kuin oikea. Osoite selvisi
vain avaamalla sivu selaimessa - ks. [D-046](03_DECISIONS.md).

Linkki taydennetty 318/320 riville.

**Muut lahteet.** Linkki puuttui myos 1 865 rivilta, mutta syy oli eri:
osoite oli tallessa `source_documents`-taulussa eika vain kulkenut
ehdokkaalle. Puute oli historiallinen - kaikki puuttuvat ovat heinakuulta,
elokuun 1 243 rivilla linkki on jokaisella, joten keraajiin ei tarvittu
muutosta.

Sokea kopiointi olisi silti ollut vaarin: otos jokaisesta lahteesta
ajettiin lapi, ja nelja hylattiin (Tampere ja Pori 404, Kuopio pelkka
SPA-kuori, Kerava 500). Lisaksi ohitettiin 93 API-paatepistetta, jotka
palauttavat XML:aa mutta menivat status- ja kokotarkistuksesta lapi.

Taydennetty 1 522 rivia.

**Jokainen linkki tarkistettiin.** Kaikki 5 886 eri osoitetta kaytiin
lapi. Otos ei riittanyt perusteeksi hylata lahdetta: yksitellen
tarkistettuna 169 osoitetta toimi, joista 126 Tampereelta jonka olin
hylannyt kokonaan. Yksi tarkistus ei myoskaan riita toteamaan linkkia
kuolleeksi - 162:sta kaatuneesta 66 toipui toisella yrityksella.

Aidosti kuolleet (96 osoitetta, 192 rivia) tyhjennettiin; osoite sailyy
`dead_source_url`-kentassa jaljitettavyytta varten. Ehdokkaista 96 %
linkilla ja katselmointijonossa 100 % (761/761).

### Eri kohteet yhdistyivät, koska nimien yhteinen osa on geneerinen

"Tikan päiväkodin purku-urakka" ja "Tikkakosken päiväkodin purku-urakka"
yhdistyivät yhdeksi hankkeeksi, vaikka ovat eri päiväkoti (JyväskyläDno-
2025-1438 ja -1439). Täsmäytys antoi niille varmuuden **100**, eli
yhdistäminen oli järjestelmän suositus.

Syy: nimivertailu painottaa yhteistä osaa, ja se on kunnan aineistossa
geneerinen ("…päiväkodin purku-urakka", "Asunto Oy Espoon …"). Erottava
sana kertoo kohteen mutta hukkuu.

Uusi rajoitus `different_name_subjects` painaa tällaisen parin
yhdistämiskynnyksen alle, jolloin se jää ihmisen katsottavaksi — sama
rajoittava malli kuin numeroerossa, ei estävä. Ks.
[D-045](03_DECISIONS.md).

Mitattu 4 472 hankkeella: yhdistämiskynnyksen ylittäviä pareja **267 → 65**.
Väärä yhdistäminen purettiin myös kannasta.

### Otsikko nimeää hankkeen, ei päätöstä

Otsikot kuvasivat kokouksen asiaa: "Puhjon risteyssilta (W) korjausurakka
2026 (KU), korjausurakan kilpailuttaminen, kilpailutusperiaatteet (salassa
pidettävä, julkisuuslaki 6.1 § 2)". Sama silta oli jonossa toisenkin
kerran nimellä "… – urakan hankinta", eivätkä ne täsmänneet keskenään.

Päätöslaji ja salassapitomerkintä poistetaan nyt otsikosta
(`lib/agent/decisionTitle.ts`). Poisto perustuu **sanastoon eikä
välimerkkeihin**, koska mitattuna yleisin pilkulla erotettu häntä on
kaupunginosa (Malmi 19, Vartiokylä 15, Jätkäsaari 14) eli sijaintitietoa —
ks. [D-042](03_DECISIONS.md).

21 otsikkoa siistiytyi, 0 jäi liian lyhyeksi, ja **kaksi uutta oikeaa
duplikaattiparia** löytyi: Puhjon risteyssilta ja Asfalttiurakka, molemmat
sama hanke kilpailutus- ja hankintapäätöksenä.

**Täydennys:** yleisin hallinnollinen häntä on `<asiakirja>n
hyväksyminen` (177 otsikkoa). Pelkkä hännän poisto jättäisi genetiivin
roikkumaan, joten poisto ja sijamuodon muunnos tehdään yhdessä:
"…korjauksen hankesuunnitelman hyväksyminen" → "…korjauksen
hankesuunnitelma". Tunnistamattomasta genetiivistä otsikko jätetään
koskematta (5 riviä). Korjattu 167 ehdokasta ja 10 hyväksyttyä hanketta.

**Korjaus näkyi ensin vain hankesivulla, ei listassa.** Otsikko on
kahdessa paikassa (`title` ja `metadata.operation`), ja lista renderöi
jälkimmäisen. Operation synkataan nyt — mutta vain kun se on vanhentunut
kopio otsikosta: Lupapisteellä se on tarkoituksella eri ja parempi
("Rakennuslupa: Vanha-Stens 5" vs. "Urheilukentän rakentaminen tontille").
21 riviä synkattu, Lupapisteen 304 riviä koskematta. Ks.
[D-044](03_DECISIONS.md).

Samalla korjaantui vaihe: kilpailutuksen **aloituspäätös** oli merkitty
"Sopimus myönnetty", koska otsikossa on sana "urakka". Urakoitsijaa ei ole
vielä valittu, joten vaihe on nyt "Kilpailutus" (2 riviä).

Salassapitomerkinnästä: se koskee liitettä (tarjouspyyntö tulee julkiseksi
vasta kun hankinta on tehty), ei asiaa. Asiasivu on kunnan itse julkaisema
ja julkinen, eikä yksikään jäsentäjä lataa PDF-liitteitä — tarkistettu.
Ks. [D-043](03_DECISIONS.md).

### Dynastyn sivukalusteet ja katkennut lause pois kuvauksesta

Kuvaus alkoi katkenneella lauseella ("tarkastetaan heti.") ja päättyi sivun
navigaatioon ("Navigointi Edellinen asia | Seuraava asia Muutoksenhakuohje
Kokousasia PDF-muodossa ©"). Kaksi eri vikaa:

**Navigaatio ja alatunniste** jäivät mukaan, koska sivukalusteita ei
rajattu. Rajaus tehdään nyt alustan omista tunnisteista
(`<!--DATABEGIN-->`…`<!--DATAEND-->` ja navigaatiotaulu), samalla
periaatteella kuin CaseM:ssä — ks. [D-041](03_DECISIONS.md).

**Katkennut lause** oli isompi vika kuin miltä näytti: jäsentäjä pilkkoi
tekstin osiotunnisteista (`split`) ja liitti palat takaisin **ilman
tunnistesanaa**, jolloin sana katosi myös keskeltä virkettä:

```
lähde:  "Sopimus astuu voimaan, kun päätös on saanut lainvoiman."
kuvaus: "Sopimus astuu voimaan, kun on saanut lainvoiman."
```

Pilkkomisen tilalla on nyt katkaisu, joka säilyttää tekstin ehjänä.

**Täydennys:** myös liiteluettelo tuli mukaan. Se on oma taulunsa ja
edeltää leipätekstiä, joten kuvaus alkoi tiedostonimillä
("Hankesuunnitelman liite 11: Pohjatutkimusraportti_Tela02042026…").
Poisto ankkuroitiin `<caption>`-otsakkeeseen, joka on sama yhdeksällä
isännällä vaikka luokkanimi vaihtelee.

Samalla paljastui **hiljainen tietohäviö**: osiotunnistetta haettiin
kirjainkoosta riippumatta, jolloin se osui liitetiedoston nimeen
("selostus_Tela02042026", "Huoneselostus") ja katkaisi kuvauksen väärästä
kohdasta. Yksi kuvaus oli kutistunut 41 merkkiin. Korjauksen jälkeen
useimmat kuvaukset **pitenivät**, koska alkuosa palautui. Liitetiedosto-
nimiä 31 → 0.

Korjattu kolmessa paikassa: jäsentäjä (jatkossa), 110 Dynasty-riviä
`potential_projects`-taulussa (`--refetch`-tila) ja 9 jo hyväksyttyä
hanketta `projects`-taulussa
(`scripts/backfill-projects-dynasty-text.ts`). Hyväksyttyjen kohdalla
kirjoitetaan vain kun `additional_info` ja `metadata.description` ovat
identtiset — ero tarkoittaisi käsin muokattua tekstiä.

### Ulkoliikuntapaikat ja leikkipuistot puuttuivat kohdetyyppitaulusta

Tekonurmihanke sai kohdetyypin "Koulu", koska ingressissä luki "urakoitsija
asentaa vanhaa tekonurmea Rautiosaaren **koulun** kentälle". Syy oli
laajempi kuin yksi rivi: kentät, liikuntapuistot ja leikkipuistot puuttuivat
taulusta kokonaan, vaikka ne ovat kunnan päätösaineistossa yleisiä. Ne
olivat lähes kaikki tyhjiä, ja neljä oli aktiivisesti väärin — leikkipuistot
olivat "Kerrostalo" ja "Rivitalo".

Kaksi uutta tyyppiä: **Liikuntapaikka** (laajennettu kentillä, tekonurmilla
ja liikuntapuistoilla) ja **Leikkipuisto**. Pelkkä "kenttä" ei kelpaa
tunnisteeksi — "Lentokenttäalueen rakennushanke" ei ole liikuntapaikka.

**Ulkoalueet ratkaistaan vasta rakennustyyppien jälkeen.** Ne esiintyvät
kahdessa roolissa: kunnan päätöksessä hankkeen kohde, yrityksen tiedotteessa
naapuruston palvelu ("76 asunnon kohde … lähellä on leikkipuisto"). Taulun
alkupäässä ne veivät kaksi asuntokohdetta leikkipuistoksi; loppuun
siirrettynä hankkeen oma rakennus voittaa ympäristön palvelun.

Täydennys korjasi 72 päätösriviä (40 Liikuntapaikka, 32 Leikkipuisto).
Kohdetyyppi on nyt 460 rivillä 1017:stä.

### Vaihe luetaan päätöstekstistä, ei otsikosta

Rovaniemen tekonurmihanke oli merkitty "Suunnittelussa", vaikka päätös on
5.12.2025, urakoitsija valittu ja teksti sanoo "Hankinnan sopimuskausi on
15.4.–24.5.2026" — hanke on jo tehty. Syy oli otsikkoheuristiikka
(`/urak/` → sopimus myönnetty), joka oli kopioituna kolmeen jäsentäjään.
Otsikossa ei ole sanaa urakka, joten rivi jäi suunnitteluvaiheeseen.

Vaihe luetaan nyt päätöstekstistä (`lib/agent/decisionPhase.ts`):
sopimuskausi kertoo missä hanke on juuri nyt, voittaja kertoo että sopimus
on myönnetty. Otsikkopäättely jää viimeiseksi varalle. Toteutusaikataulu ja
päivämäärätön urakka-aika jätettiin tietoisesti pois — ks.
[D-038](03_DECISIONS.md).

Sopimuskausi kytkettiin myös **tuontiin**: `inferCompletionDateFromText`
esti jo ennestään vanhentuneiden hankkeiden pääsyn TIC-jonoon, mutta se
tunsi vain tiedotteiden sanamuodot ("valmistuu syyskuussa 2025") — kunnan
päätös ei puhu niin. Jo tehty hankinta ei siis enää päädy jonoon
mahdollisuutena. Mitattu ennen kytkentää: sopimuskausi tunnistuu 8 rivillä,
joista 4 on jo päättynyt, eikä yhtään väärää osumaa.

Täydennys muutti 13 riviä: 3 valmistunutta, 2 rakenteilla olevaa ja 8
sopimuksen saanutta. Varalla on nykyinen arvo, joten ilman vahvaa signaalia
rivi jää ennalleen — otsikosta uudelleen laskettuna 28 riviä olisi
heilahtanut "Suunnittelu" ↔ "Suunnittelussa" ilman että mikään niissä
korjaantui.

### Viranhaltijavalikko vuoti kuvaukseen ja myrkytti kohdetyypin

CaseM-päätösrivin kuvaus alkoi kymmenillä viranhaltijanimikkeillä
("Alueellisten palvelujen päällikkö Apulaisrehtori Korkalovaaran peruskoulu
Elinkeinopäällikkö…") ennen kuin varsinainen asia alkoi. Kyseessä oli
asiasivun sivuvalikko, joka tulee HTML:ssä ennen sisältöä.

Seuraus ei ollut vain kosmeettinen: kohdetyyppi luetaan tekstin alusta, ja
valikossa on kymmenien koulujen rehtorit. **Sipolantien 9 purku-urakka sai
kohdetyypin "Koulu".** Sisältöalue rajataan nyt alustan omilla tunnisteilla
— ks. [D-037](03_DECISIONS.md).

Kaikki 59 CaseM-riviä haettiin uudelleen
(`scripts/backfill-casem-descriptions.ts`): valikko oli kuvauksessa
jokaisella, ja 22:lla kohdetyyppi korjaantui. Suurin osa korjaantui väärästä
arvosta tyhjäksi — purku-urakalla ei ole kohdetyyppiä.

Kaksi mittauksessa paljastunutta puutetta `inferBuildingType`:ssä korjattiin
samalla:

- `\bkoulu` ei osunut yhdyssanaan. "Muurolan **peruskoulun** tarveselvitys"
  jäi tunnistamatta, jolloin tyyppi luettiin rungosta ja tuloksena oli
  "Päiväkoti" (teksti mainitsi viereen rakennetun päiväkodin). Sananraja
  poistettiin ja kielto laajennettiin muotoon `koulu(?!t)`, joka estää yhä
  "koulutus" ja "kouluttaa" — ja nyt myös katunimen "Koulutie".
- Nuorisotila puuttui tyyppitaulusta. Sen teksti kuvaa lähes aina nykyisiä
  ahtaita tiloja koulun yhteydessä, joten runko vei tyypin väärään suuntaan.

### Urakan voittaja poimitaan hankintapäätöksestä

Kuntien päätösrivit näyttivät urakoitsijakentän tyhjänä silloinkin kun teksti
listasi kahdeksan valittua yritystä nimellä ja y-tunnuksella. Poiminta
lisättiin (`lib/agent/decisionWinners.ts`) ja kytkettiin neljään jäsentäjään
(Dynasty, CaseM, Turku, Helsingin päätökset).

Ensimmäinen versio ankkuroi poiminnan y-tunnukseen ja **osui väärään
kohteeseen 8 kertaa 11:stä**: päätösteksti listaa y-tunnuksineen myös
häviäjät. Uudelleen tehtynä ankkurina on päätöslause ja roolisanan sija —
ks. [D-036](03_DECISIONS.md). Uudelleenmittaus samalla otoksella 9/9 oikein.

Jonossa olleet päätösrivit korjattiin
(`scripts/backfill-decision-sources.ts`): 1003 rivistä 27:llä on voittaja,
24 yksittäistä urakoitsijaa ja 3 puitesopimusta. Yksi voittaja täyttää
urakoitsijakentän; puitesopimuksessa kenttä jätetään tyhjäksi, koska yhtä
pääurakoitsijaa ei ole.

**Täydennys:** viides lausemuoto lisättiin — monikkorooli mutta yksi
voittaja, perustelu verbin ja nimen välissä ("sopimustoimittajiksi valitaan
hinnaltaan halvimman kokonaistarjouksen jättänyt Lapin Timanttisahaus Oy").
Se paljasti samalla, että kuvion `i`-lippu mitätöi nimen kirjainkokoehdon:
kantaan oli päätynyt voittajina "kokonaistaloudellisesti edullisimman
tarjouksen jättänyt Oteran Oy" ja "halvimman tarjoushinnan tehnyt Lappset
Group Oy". Korjauksen jälkeen voittaja on 35 rivillä (ennen 27), eikä
yhdelläkään nimessä ole enää pienellä alkavaa etuliitettä.

**Kolmas täydennys:** ablatiivin ostoverbi tunsi vain aktiivin `hankkii`,
koska kuvio vaati kaksois-k:n. Aineistossa **passiivi on yleisempi**:
"hankitaan" 9 rivillä. Verbilista luettiin lähteistä ja laajennettiin
mitattuihin muotoihin (`hankitaan`, `hankittiin`, `tilata`, `ostetaan`).
11 uutta voittajaa, ei yhtään muuttunutta tai poistunutta. Voittaja on nyt
52 päätösrivillä (48 yksittäistä urakoitsijaa, 4 puitesopimusta).

**Kuudes taydennys — ja poiminnan valmistuminen.** Ennen viimeisia
saantoja mitattiin paljonko poimittavaa on jaljella: 964 voittajattomasta
rivista 657:ssa ei ole yritysnimea lainkaan ja 290:ssa ei hankintakielta,
eli vain 17 oli epailtya puutetta. Ne luettiin lapi: kahdeksan oli oikein
tyhjia, yhdeksan jakautui kahteen muotoon (partisiippi + genetiiviobjekti,
seka liian pitka vali roolin ja nimen valilla).

Molemmat toteutettiin: 8 uutta voittajaa, 0 muuttunutta. Voittaja nyt 60
paatosrivilla.

Saantopohja ei siis lopu kesken vaan valmistuu — tunnettuja muotoja ei jaa
jaljelle, ja 947 rivia 964:sta ei sisalla voittajaa lainkaan.

**Viides taydennys:** allatiivi eli tyon antaminen yritykselle
("suunnittelu annetaan ... tarjouksen jattaneelle Insinooritoimisto
Lepisto Oy:lle"). Saanto on kapea: "Oy:lle" esiintyy 50 kertaa mutta
lahes aina vuokrauksena, tonttivarauksena tai kustannusten korvauksena.
Siksi vaaditaan seka luovutusverbi etta kilpailutuskonteksti - kumpikaan
yksin ei riita. Voittaja nyt 52 paatosrivilla.

**Neljäs täydennys:** rooli "toteuttajaksi" puuttui sanastosta. Koska sama
puute oli osunut kohdalle jo kahdesti, sanastoa ei täydennetty yhdellä
sanalla vaan haettiin kaikki translatiivimuodot joita seuraa yritysnimi —
`toteuttajaksi` oli ainoa aito puute. "Valvojaksi" jätettiin tietoisesti
pois: valvoja on rakennuttajan konsultti, ei urakoitsija, ja olisi
päätynyt `builder`-kenttään hankkeen rakentajaksi. Ryhmittymästä poimitaan
johtava yritys — ks. [D-036](03_DECISIONS.md).

**Toinen täydennys:** kuudes lausemuoto, jossa valintaverbi on roolin
edellä ("Päätän valita … urakan pääurakoitsijaksi kokonaishinnaltaan
edullisimman tarjouksen jättäneen Oulun Maa- ja Vesirakennus Oy:n").
Samassa lauseessa paljastui, että nimen sisällä oleva "ja" katkaisi
isokirjainketjun — kuvio ei osunut koko lauseeseen. Se sallitaan nyt, mutta
toisto tehtiin laiskaksi, jottei "Rakennus Oy ja Kone Oy" yhdisty yhdeksi
nimeksi. Korjasi samalla puitesopimuslistan katkenneen nimen
"Poltinhuolto Oy" → "Kvl Putki- ja Poltinhuolto Oy". Voittaja on nyt
37 rivillä.

Backfill-skriptin säilytyssääntö käännettiin samalla: uusi laskenta voittaa
myös tyhjänä. Aiemmin `winners.length ? winners : md.winners` olisi jättänyt
väärät voittajat voimaan — sama ansa oli kaatanut kohdetyypin kahdesti.

### Yrityslähteet tuottivat tyhjiä ehdokkaita — 25 lähdettä korjattu kerralla

Lähti liikkeelle yhdestä TIC-jonon rivistä: Peabin tiedotteesta oli poimittu
vain kaupunki ja vaihe "Suunnittelussa", vaikka urakka oli jo myönnetty ja
urakkasumma 14,5 M€ luki tekstissä. Syy oli että lähde luki vain listaussivun
otsikon eikä hakenut tiedotesivua lainkaan.

**Sama vika oli 25 lähteessä.** Mitattiin ajamalla ne läpi
(`scripts/audit-company-sources.ts`): 13 lähdettä tuotti ehdokkaita **ilman
kuvausta**, ja niistä 80–100 % hylättiin katselmoinnissa — kuvaukseton
ehdokas ei ole arvioitavissa ([D-027](03_DECISIONS.md)). Rakennuttaja,
urakoitsija ja kohdetyyppi olivat 0 % kaikilla, ja vaihe lähes aina
"Suunnittelussa" vaikka urakoitsija tiedottaa tyypillisesti vasta kun sopimus
on tehty.

Korjaus yleistettiin jaetuksi moduuliksi `lib/agent/companyRelease.ts`, joka
kokoaa neljä asiaa: tiedotesivun haku, vaiheen päättely urakkamerkeistä,
osapuolten ratkaisu ja kohdetyyppi. Kytketty 25 lähteeseen enrich-koukkuna,
jota kerääjä kutsuu vain vielä näkemättömille ehdokkaille.

Jonossa olleet 819 riviä täydennettiin jälkikäteen
(`scripts/backfill-company-sources.ts`):

| kenttä | ennen | jälkeen |
|---|---|---|
| kuvaus | 33 % | 100 % |
| maakunta | 91 % | 98 % |
| kohdetyyppi | 1 % | 69 % |
| urakoitsija | 1 % | 95 % |

Vaihe oli ennen "Suunnittelussa" käytännössä kaikilla. Jälkeen: Suunnittelu
517, **Sopimus myönnetty 187, Rakenteilla 111**, Valmistunut 4 — eli 302
hanketta oli tosiasiassa jo sopimus- tai rakennusvaiheessa.

Kaksi päätöstä matkan varrelta: [D-034](03_DECISIONS.md) (julkaisijan rooli on
lähteen ominaisuus, ei pääteltävä) ja [D-035](03_DECISIONS.md) (osapuolet ja
kohdetyyppi luetaan ingressistä, ei koko sivulta).

### Maakunta johdetaan kunnasta tuonnissa

Valtaosa lähteistä palauttaa `region: null`, koska tiedotteessa lukee vain
kaupunki — ja kenttä jäi silloin pysyvästi tyhjäksi vaikka kunta oli tiedossa.
Johtaminen siirrettiin `importCandidate`iin, joten se koskee kaikkia lähteitä.
Sama johtaminen tehtiin ennen jälkikäteen `backfill-region.ts`:llä.

### Otsikon katkaisu rikkoi lauseita

`stripCompanyPrefixFromHeadline` poisti yrityksen ja verbin otsikon alusta,
mutta suomen objekti on genetiivissä — verbin poisto jättää lauseenpätkän
("Koulun ja kirjaston Evijärvelle"). Rinnasteisesta predikaatista tunnistettiin
lisäksi vain ensimmäinen verbi, jolloin otsikko alkoi konjunktiolla ("Ja
uudistaa Iisalmen kulttuurikeskuksen").

Katkaisu hylätään nyt kun jäljelle jäisi konjunktio, pienellä alkava genetiivi
tai saaja allatiivissa; silloin säilytetään koko uutisotsikko. Kokonainen
otsikko on huonompi hankenimenä kuin siisti katkelma, mutta parempi kuin
rikkinäinen.

## 2026-08 (työ 7.–8.8.)

### Valmistumistieto: mikä toimii ja mikä ei

Lähtökohtana kysymys siitä, saadaanko rakennusvalvonnasta tieto valmistumisesta
(loppukatselmus, käyttöönotto). Vastaus mitattiin, ja se on kaksiosainen.

**Varmennettua valmistumista ei ole saatavilla.** Aineistossa oli 9 mainintaa
sanasta "loppukatselmus" ja 2 sanasta "käyttöönottokatselmus", kaikki
satunnaisia mainintoja leipätekstissä. Lupapisteen julkipano ei kelpaa: se
julkaisee päätöksiä eikä katselmuksia, eikä julkaise lupaa uudelleen tilan
muuttuessa (366 lupatunnusta, 1 toisto, **0 tilanmuutosta**). Kansallinen avoin
data antaa koko Suomesta 6 aineistoa haulla "rakennusluvat". Ks.
[D-028](03_DECISIONS.md).

**Arvioitu valmistumisaika sen sijaan toimii, eikä sitä käytetty.**
`parseFinnishCompletionDate` on ollut olemassa ja toimii, mutta sitä ei ajettu
koskaan hankkeiden kuvauksia vasten: `estimated_completion` oli täytetty **24
hankkeella 4412:sta (1 %)**.

Kenttä on tärkeä, koska `auto-complete-projects`-cron siirtää hankkeen
valmistuneeksi vasta kun päivä on mennyt — ilman päivämäärää hanke jää
ikuisesti rakenteille.

| | ennen | jälkeen |
|---|---|---|
| `estimated_completion` täytetty | 24 (1 %) | **166** |
| määräpäivä jo mennyt | 0 | 11 |

Poiminta kytkettiin myös tuontipolkuun (`importCandidate`), jottei tämä jää
kertaluontoiseksi. Se ajetaan viimeisenä vaihtoehtona, joten lähteen omaa tai
käsin korjattua arviota ei ylikirjoiteta.

**Testien kirjoittaminen paljasti kaksi vikaa jäsentäjässä:**

- `valmistuvan` puuttui avainsanoista, eli *"kohteen arvioidaan valmistuvan
  lokakuussa 2026"* — suomen tavallisin tapa ilmaista arvio — ei osunut
  lainkaan. Muodot muutettiin vartaloiksi.
- 40 merkin ikkuna ylitti virkkeen rajan: *"Kohde valmistuu aikanaan.
  Rakennustyöt käynnistyivät tammikuussa 2025"* antoi valmistumisajaksi
  **2025-01-31** eli aloituspäivän. Piste suljettiin pois välistä.

Korjaukset toivat 33 lisäosumaa, eikä yksikään jo asetetuista 133 arviosta
osoittautunut virkerajan yli poimituksi.

**Peruttu työ:** aloitin 69 hankkeen merkitsemisestä valmistuneiksi tekstin
perusteella. Todisteet luettuani se osoittautui virheelliseksi — laskin
mainintoja, en valmistumisia. Ks. D-028. Tarkistin myös ne 30 hanketta jotka on
jo merkitty valmiiksi ja piilotettu asiakkailta: ne ovat kunnossa, koska ne
tulevat lähteen rakenteesta (Senaatti-kiinteistöjen eksplisiittinen teksti,
Kreaten ja Väyläviraston referenssilistat) eivätkä heikosta tekstihausta.

### Selvitys ilman muutosta: Helsingin vanha kaavalähde

Kuvauksettomien ehdokkaiden korjaussarjan jälkeen suurin jäljellä oleva ryhmä
oli "Helsingin vireillä olevat kaavat" (91 ehdokasta, 61 ilman kuvausta, 99 %
hylätty). **Tälle ei tehty mitään, ja syy kannattaa tietää**, jottei sitä
tutkita uudelleen.

Toisin kuin ne neljä yrityslähdettä, tämä ei ole poimijavika. Lähde on
karttapalvelun WFS-taso eli geometriahakemisto, ja sen koko sisältö per kaava
on `luokka`, `tyyppi`, `pintaala`, `kaavatunnus`, päivämäärät ja polygoni.
**Kuvausta ei ole olemassa**, eikä ehdokkailla ole `source_url`:ia, joten
artikkelisivua ei voi hakea. Lähde on lisäksi jo pois käytöstä ja korvattu
SUKKA-lähteellä (217 ehdokasta, 4 % hylätty, oikeat kuvaukset). Kaikki 91
ehdokasta syntyivät yhtenä päivänä 13.7., 90 on hylätty, yksikään ei ole
jonossa.

Kattavuus tarkistettiin siltä varalta että sulkeminen olisi menettänyt jotain:

```
WFS "vireillä"    83 kaavaa      SUKKA   105 kaavaa
molemmissa        72
vain WFS:ssä      11             vain SUKKAssa  33 (myöhempiä vaiheita)
```

SUKKA ei siis ole ylijoukko — 11 kaavaa on vain vanhassa lähteessä. Ne ovat
kaavahakemistossa vireillä mutta ilman aktiivista SUKKA-tietuetta, ja
päivämäärät selittävät miksi: kahdeksaa ei ole koskettu kahteen vuoteen ja
Kluuvin kaava 11803 on ollut vireillä vuodesta 2008 (viimeksi muokattu 2013).
Ne ovat vireillä paperilla, eivät valmistelussa.

Kaksi poikkeusta joissa on tuoretta liikettä eikä hanketta kannassa:
**12245 Mellunkylä** (89 948 m², muokattu 2025-04) ja **12273 Pukinmäki**
(19 632 m², muokattu 2023-11).

Lähdettä ei kannata avata uudelleen: WFS ei sisällä kuvausta, joten ne 11
tulisivat sisään muodossa `Kaava 12245 – MELLUNKYLÄ` — samanlaisina riveinä
joista 99 % hylättiin — ja mukana tulisi 72 päällekkäistä. Jos nuo kaksi
liikkuvaa kaavaa kiinnostavat, ne ovat kertaluontoista käsityötä.

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

### Neljä yrityslähdettä tuotti kuvauksettomia ehdokkaita

Lähtökohtana yksi ehdokas (Pikkuapollo, srv): kuvaus ja lähteen tiedot
puuttuivat. Syy osoittautui järjestelmälliseksi, ja se selittää samalla
hylkäysasteet joita oli aiemmin pidetty lähteen laadun mittarina — ks.
[D-027](03_DECISIONS.md).

**srv, pohjola_rakennus, kas_asunnot ja lujatalo** laskivat rungon tai otteen
avainsanasuodatusta varten mutta jättivät sen palauttamatta. Data oli siis jo
haettu. Sama vika oli aiemmin mangrovessa. Koko kannassa 1125/5338 (21 %)
ehdokasta oli ilman kuvausta.

Poimijat korjattiin ja ajettiin livenä — kaikilla 140 uudella ehdokkaalla on
nyt kuvaus:

```
srv               82 ehdokasta   kuvaus mediaani 4 542 merkkiä
lujatalo          25             kuvaus mediaani 2 624
pohjola_rakennus  26             kuvaus mediaani   141
kas_asunnot        7             kuvaus mediaani   195
```

**Lujatalon runko oli sivukalustetta.** `fetchArticleBodyText` luki koko
`<body>`:n, mikä kelpasi kaupungin ja päivämäärän päättelyyn mutta ei
näytettäväksi: mitattu ensimmäinen rivi oli
`<iframe src=googletagmanager...>Toggle nav`. Nyt luetaan artikkelielementti ja
poistetaan nav/header/footer/iframe.

**Vanhat täydennettiin hakemalla artikkelisivut.** Toisin kuin YVA:ssa runko ei
tule listaushaussa, joten `scripts/backfill-company-descriptions.ts` noutaa
jokaisen ehdokkaan `source_url`:n erikseen (250 ms tauko pyyntöjen välissä —
lähteet ovat pieniä yrityssivustoja):

| | ennen | jälkeen |
|---|---|---|
| täydennetty | — | **453 / 453**, nolla epäonnistumista |
| katuosoite poimittu | — | 59 |
| koko kanta ilman kuvausta | 1125 (21 %) | **672 (13 %)** |

Cisionin sivutunniste (`... 09.00 CET Report this content`) päätyi ensin
kuvauksen alkuun 291 rivillä. `stripLeadIn` pudottaa alustan tunnisteen ja
kaiken sitä ennen — mutta vain jos se osuu tekstin alkuun, jottei myöhempi
osuma hukkaa leipätekstiä. Vanhat rivit siivottiin paikan päällä ilman uutta
hakua.

Artikkelin rungon poiminta on nyt jaettu moduuli
(`lib/agent/fetchArticleBody.ts`), samoin HTML:n riisuminen
(`lib/agent/stripHtml.ts`) — kolme lähdettä tarvitsee jälkimmäistä.

### YVA-lähde: haettu sisältö otettiin käyttöön

Lähtökohtana havainto katselmointijonosta: YVA-ehdokkailla ei ollut mitään
tietoja — ei sijaintia, rakennuttajaa, kohdetyyppiä. Syitä oli kaksi, eri
kohdissa samaa poimijaa.

**1. Haettu sisältö heitettiin pois.** `_source`-listassa pyydettiin kentät
`content` ja `projectType`, mutta kumpaakaan ei käytetty, ja
`developer`/`property_type` oli kovakoodattu nulliksi. Mitattu "Halmemäen
tuulivoimahanke, Kärsämäki": tiivistelmä 78 merkkiä, `content` **8 639
merkkiä** — ja jälkimmäisessä voimaloiden määrä, teho, tornin korkeus,
hankealueen pinta-ala ja sijainti suhteessa keskustaajamaan. Data oli siis jo
haettu samassa vastauksessa ja jätetty lukematta.

Nyt `content` on kuvaus ja `subjectArea` kohdetyyppi (otoksessa 25/25
täytetty; `projectType` oli 0/25 eli aina tyhjä). Rakennuttaja poimitaan
leipätekstistä — `organization` on viranomainen eikä kelpaa, mikä oli jo
todettu tiedostokommentissa.

Poiminta vaatii yhtiömuodon, koska kuvio "X suunnittelee" on löyhä. Kaksi
mitattua virhekaappausta korjattiin: sivun lyhytosoite liittyi nimeen
(`...rikastushiekka-YVA Dragon Mining Oy`) ja pienellä alkava nimi katkesi
(`wpd Suomi Oy` → `Suomi Oy`). Jälkimmäinen hylätään nyt kokonaan — mieluummin
tyhjä kuin väärä rakennuttaja. Kaikki 61 poimittua nimeä tarkistettiin käsin.

**2. `size: 150` katkaisi haun ennen tuoreusikkunaa.** Ks.
[D-026](03_DECISIONS.md). Aineistossa on 1337 hanketta, joten haku ulottui vain
kolme kuukautta taaksepäin ja 3–18 kuukauden ikäiset hankkeet jäivät hakematta.
Haku sivuttaa nyt tuoreusrajaan asti: **103 → 312 hanketta**, 1052 ms.

Vanhat ehdokkaat täydennettiin (`scripts/backfill-yva-details.ts`, täyttää vain
tyhjät kentät ja korvaa kuvauksen vain jos uusi on pidempi):

| | ennen | jälkeen |
|---|---|---|
| kuvauksen mediaani | 78 merkkiä | **5 049** |
| rakennuttaja | 0/123 | **74** |
| kohdetyyppi | 0/123 | **122** |

Sivutus tuo seuraavassa ajossa noin 200 uutta ehdokasta jonoon. Se on lähteen
dokumentoitu tarkoitus, ja 18 kuukauden ikkuna päätettiin pitää ennallaan.
Osa niistä on vanhoja YVA-menettelyjä jotka ovat jo edenneet rakennusluvaksi
tai kilpailutukseksi, eli sama hanke voi olla kannassa toisesta lähteestä —
ne nousevat esiin päivittäisessä duplikaattiskannauksessa tai hyväksynnän
täsmäytyksessä.

Yritysnimen muoto ja siivous siirrettiin jaettuun moduuliin
`lib/agent/companyName.ts`, koska YVA ja STT tarvitsevat saman.

### Duplikaattiskannaus: päivittäin, ja numerot huomioidaan

Skannauksen tiheys ei ollut varsinainen ongelma — inkrementaalinen ajo löysi
viimeksi **nolla paria** 37 598 vertailusta, koska hyväksyntähetken täsmäytys
nappaa duplikaatit jo ennen skanneria. Ongelma oli ikkuna: ajo vertasi
viimeisen 7 päivän hankkeita ja cron ajoi 7 päivän välein, eli yksi väliin
jäänyt ajo jätti sen viikon hankkeet pysyvästi skannaamatta. Cron on nyt
päivittäinen, ks. [D-025](03_DECISIONS.md).

Samalla ajettiin kertaalleen `mode=full` uusilla pisteytyssäännöillä (47 s,
180 131 vertailua): **65 uutta katselmoitavaa paria**. Niistä 48 oli
kaavapareja ja 34:llä numero erosi:

```
[90%] Levin kortteleiden 207 ja 208 asemakaavamuutos
      Levin kortteleiden  57 ja  58 asemakaavamuutos

[75%] XVI (Tammela), Vellamonkatu 11, täydennysrakentaminen
      XVI (Tammela), Vellamonkatu  8, täydennysrakentaminen
```

Syy: `titleWords` pudottaa alle neljän merkin sanat, joten `11`, `8`, `295` ja
`XVI` katosivat ennen vertailua ja nimistä jäi täsmälleen sama sanajoukko.
Kaavoituksessa ja katuosoitteissa numero on kuitenkin koko identiteetti.

Uusi sääntö ([D-024](03_DECISIONS.md)) **rajoittaa eikä estä**: varmuus
painetaan 65:een eli yhdistämiskynnyksen alle, jolloin pari jää ihmisen
katsottavaksi. Numero ei aina ole tunniste — uutisotsikossa voi lukea "48
asuntoa" ja toisessa lähteessä "50 asuntoa" samasta hankkeesta.

| | ennen | jälkeen |
|---|---|---|
| kaksoiskappalejono | 65 | **26** |
| ehdokasjonon automaattiosumat | 7 | **7** |

39 paria poistettiin kannasta. Poistoehto oli "nykyinen pisteytys antaa alle
70", ei "kaikki katselmoimattomat" — arvioidut rivit säilyivät.

Jäljelle jääneissä 26:ssa on aitoja löytöjä joita hyväksyntähetken täsmäytys
ei nappaa (`Pyhäaamu asemakaavan muutos` ↔ `Asemakaavan muutos Pyhäaamu`,
sanajärjestys) sekä pari tunnistettua väärää osumaa (`Tampereen
selviämishoitoasema` ↔ `pääpoliisiasema`), jotka eivät liity numeroihin.

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
