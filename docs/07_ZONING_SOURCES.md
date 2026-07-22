# Kaavoitus-lähteiden kattavuus

Tämä tiedosto listaa, mistä kunnista tyomaat.fi kerää kaavoitustietoa (`discovery_sources`,
`category = zoning_plan` / `zoning`) ja mistä kunnista lähdettä ei ole (vielä) saatu
toteutettua. Tarkoitus on välttää saman kunnan turhaa uudelleentutkimista tulevissa
istunnoissa.

**Tilanne 23.7.2026 — kaikki Manner-Suomen maakunnat on nyt käyty läpi kokonaan,
eikä yhdessäkään maakunnassa ole enää "ei vielä tutkittu" -kuntia.**
Luvut on generoitu suoraan Supabasen `discovery_sources`-taulusta ja
`lib/geo/municipalities.ts`-tiedostosta, ei istunnon tehtävälistasta — ks.
luotettavuushuomio lopussa.

## Yhteenveto

- Manner-Suomen kuntia yhteensä: 292 (Ahvenanmaan 16 kuntaa rajattu pois, ei toistaiseksi
  tavoitteena).
- Katettu (rekisteröity lähde): **241**
- Ei vielä katettu: **51**
  - kaikilla 51:lla syy on nyt tiedossa ja dokumentoitu (ks. alla) — kaikki
    Manner-Suomen maakunnat on käyty läpi kokonaan, ei enää "ei vielä tutkittu"
    -kuntia missään maakunnassa.
- Valtakunnallisia / usean kunnan lähteitä (ei kuntakohtaisia, ei mukana yllä olevissa
  luvuissa): Hilma, Lupapiste kuulutukset, Väylävirasto hankkeet, Senaatti-kiinteistöt
  hankkeet, Puolustuskiinteistöt uutiset, Kreate hankkeet.

## Katetut kunnat maakunnittain

Muoto: `Kunta: discovery_sources.name`

### Etelä-Karjala (6)
Imatra, Lappeenranta, Lemi, Rautjärvi, Savitaipale, Taipalsaari

### Etelä-Pohjanmaa (14)
Alajärvi, Alavus, Ilmajoki, Isojoki, Isokyrö, Kauhajoki, Kauhava, Kuortane, Kurikka,
Laihia, Lapua, Seinäjoki, Vimpeli, Ähtäri

### Etelä-Savo (10)
Enonkoski, Heinävesi, Hirvensalmi, Juva, Kangasniemi, Mikkeli, Pieksämäki, Puumala,
Savonlinna, Sulkava

### Kainuu (7)
Hyrynsalmi, Kajaani, Kuhmo, Paltamo, Puolanka, Ristijärvi, Suomussalmi

### Kanta-Häme (9)
Forssa, Hattula, Hausjärvi, Hämeenlinna, Janakkala, Jokioinen, Loppi, Riihimäki, Tammela

### Keski-Pohjanmaa (6)
Kannus, Kokkola, Lestijärvi, Perho, Toholampi, Veteli

### Keski-Suomi (15)
Joutsa, Jyväskylä, Jämsä, Keuruu, Kinnula, Laukaa, Multia, Muurame, Petäjävesi,
Pihtipudas, Saarijärvi, Toivakka, Uurainen, Viitasaari, Äänekoski

### Kymenlaakso (7)
Hamina, Iitti, Kotka, Kouvola, Miehikkälä, Pyhtää, Virolahti

### Lappi (20)
Enontekiö, Inari, Kemi, Kemijärvi, Keminmaa, Kittilä, Kolari, Muonio, Pelkosenniemi,
Pello, Ranua, Rovaniemi, Salla, Savukoski, Simo, Sodankylä, Tervola, Tornio, Utsjoki,
Ylitornio

### Pirkanmaa (20)
Akaa, Hämeenkyrö, Ikaalinen, Kangasala, Kihniö, Lempäälä, Mänttä-Vilppula, Nokia,
Orivesi, Pirkkala, Punkalaidun, Pälkäne, Ruovesi, Sastamala, Tampere, Urjala,
Valkeakoski, Vesilahti, Virrat, Ylöjärvi

### Pohjanmaa (12)
Kaskinen, Korsnäs, Kristiinankaupunki, Kruunupyy, Luoto, Maalahti, Mustasaari,
Pedersören kunta, Pietarsaari, Uusikaarlepyy, Vaasa, Vöyri

### Pohjois-Karjala (8)
Ilomantsi, Joensuu, Kitee, Kontiolahti, Lieksa, Liperi, Nurmes, Tohmajärvi

### Pohjois-Pohjanmaa (29)
Alavieska, Haapajärvi, Haapavesi, Hailuoto, Ii, Kalajoki, Kempele, Kuusamo, Kärsämäki,
Liminka, Lumijoki, Merijärvi, Muhos, Nivala, Oulainen, Oulu, Pudasjärvi, Pyhäjoki,
Pyhäjärvi, Pyhäntä, Raahe, Reisjärvi, Sievi, Siikajoki, Siikalatva, Taivalkoski, Tyrnävä,
Vaala, Ylivieska

### Pohjois-Savo (12)
Iisalmi, Keitele, Kiuruvesi, Kuopio, Lapinlahti, Pielavesi, Siilinjärvi, Sonkajärvi,
Suonenjoki, Tuusniemi, Varkaus, Vieremä

### Päijät-Häme (9)
Asikkala, Hartola, Heinola, Hollola, Kärkölä, Lahti, Orimattila, Padasjoki, Sysmä

### Satakunta (11)
Eura, Huittinen, Jämijärvi, Kankaanpää, Kokemäki, Nakkila, Pori, Rauma, Siikainen,
Säkylä, Ulvila

### Uusimaa (22)
Espoo, Hanko, Helsinki, Hyvinkää, Inkoo, Järvenpää, Karkkila, Kauniainen, Kerava,
Kirkkonummi, Lohja, Loviisa, Mäntsälä, Nurmijärvi, Pornainen, Porvoo, Raasepori,
Sipoo, Siuntio, Tuusula, Vantaa, Vihti

### Varsinais-Suomi (24)
Aura, Kaarina, Kemiönsaari, Koski Tl, Kustavi, Laitila, Lieto, Loimaa, Marttila, Masku,
Mynämäki, Naantali, Paimio, Parainen, Pyhäranta, Pöytyä, Raisio, Rusko, Salo,
Somero, Taivassalo, Turku, Uusikaupunki, Vehmaa

## Ei vielä katettu

### Tutkittu ja todettu ei (toistaiseksi) toteutettavaksi — syy tiedossa

| Kunta | Maakunta | Syy |
|---|---|---|
| Askola | Uusimaa | Staattinen sivu, ei rakenteista vireillä-listaa |
| Juupajoki | Pirkanmaa | Ei rakenteista kaavalistaa / tyhjä sivu |
| Parkano | Pirkanmaa | Ei rakenteista kaavalistaa / tyhjä sivu |
| Sotkamo | Kainuu | Vain PDF-tiedostoja, ei rakenteista listaa |
| Mäntyharju | Etelä-Savo | Puhtaasti clientillä renderöity React SPA (`<div id="root">`), ei palvelinpuolen sisältöä |
| Posio | Lappi | Sivun aktiiviset-kaavat-osio on tyhjä (placeholder-tageja, ei sisältöä) |
| Evijärvi | Etelä-Pohjanmaa | Vain yksi Google Drive -PDF-linkki, ei rakenteista listaa |
| Karijoki | Etelä-Pohjanmaa | Vain PDF-kaavoituskatsaus |
| Lappajärvi | Etelä-Pohjanmaa | Vain yleistekstiä, ei aktiivista listaa |
| Soini | Etelä-Pohjanmaa | Vain PDF-tiedostoja (`kunta.soini.fi`), ei rakenteista listaa |
| Teuva | Etelä-Pohjanmaa | Vain "voimassa olevat kaavat" -PDF-listaus, ei vireillä-osiota |
| Eurajoki | Satakunta | Cloudflare-bottitunnistus palauttaa haasteen ("Just a moment...") kaikille palvelinpuolen hauille — ei UA-ongelma vaan TLS/HTTP-fingerprint, ei korjattavissa header-yhdistelmällä |
| Harjavalta | Satakunta | Vain yleistekstiä + karttapalvelulinkki, ei aktiivista listaa |
| Karvia | Satakunta | Vain markkinointitekstiä + ulkoinen karttapalvelulinkki (karttatiimi.fi) |
| Merikarvia | Satakunta | Ei ylläpidettyä vireillä-listaa; yksittäiset kaava-uutiset julkaistaan yleisessä 332-postauksen "Ajankohtaista"-blogissa ilman kaavoitus-kategoriaa |
| Pomarkku | Satakunta | Vain ajantasakaava- ja kaavoituskatsaus-PDF, ei aktiivista listaa |
| Kaavi | Pohjois-Savo | Vain iso litania kaikkia (enimmäkseen jo lainvoimaisia) kaavoja, ei erillistä vireillä-osiota |
| Leppävirta | Pohjois-Savo | Vain voimassa olevien kaavojen PDF-listaus, ei vireillä-osiota |
| Rautalampi | Pohjois-Savo | Kuulutukset ohjautuvat JS-renderöityyn cloudnc.fi-portaaliin, vaatisi Kangasniemen tapaisen erillisen reverse-engineering-työn |
| Rautavaara | Pohjois-Savo | Vain yleiskaava/asemakaava/ranta-asemakaava-PDF:t, ei vireillä-osiota |
| Tervo | Pohjois-Savo | Vain yleistekstiä, ei aktiivista listaa |
| Vesanto | Pohjois-Savo | "Vireillä olevat kaavat" -osio on vanhentunutta sisältöä vuosilta 2018-2020, ja teksti itse toteaa ettei mitään ole tällä hetkellä vireillä |
| Luumäki | Etelä-Karjala | Ei kaavoitus-alasivua lainkaan, vain ulkoinen karttatiimi.fi-linkki |
| Parikkala | Etelä-Karjala | "Vireillä olevat kaavat" -sivu on täysin tyhjä (vain otsikko) |
| Ruokolahti | Etelä-Karjala | Vain yleistekstiä + kaavoituskatsaus-PDF, ei aktiivista listaa |
| Joroinen | Etelä-Savo | "Vireillä olevat kaavat" ohjaa kuulutussivulle jonka suodatus on client-puolen JS:ää — palvelinpuolen haussa ei näy yhtään kaava-kuulutusta |
| Rantasalmi | Etelä-Savo | Yksi aktiivinen hanke (sisäjärvien yleiskaavamuutos) mainitaan, mutta vain irrallisena lauseena juoksevassa tekstissä ilman otsikkoa tai liitteitä — liian hauras luotettavaan poimintaan |
| Humppila | Kanta-Häme | "Valmisteilla olevat kaavat" -osio on rakenteeltaan hyvä mutta sisältö toteaa suoraan "Ei valmisteilla olevia kaavoja" — ei voi vahvistaa poimintalogiikkaa ilman oikeaa esimerkkiä |
| Ypäjä | Kanta-Häme | "Vireillä olevat kaavahankkeet" -osiossa vain kaavoituskatsaus-PDF, ei yksittäisiä hankkeita |
| Halsua | Keski-Pohjanmaa | Ei kaavoitussisältöä sivustolla lainkaan (vanha, suppea page_id-pohjainen WP-sivusto) |
| Kaustinen | Keski-Pohjanmaa | Vain vanhoja (2006-2021) PDF-kaavatiedostoja, ei vireillä-osiota |
| Närpiö (Närpes) | Pohjanmaa | Vain yleistekstiä ruotsiksi + ulkoinen karttalinkki, ei aktiivista listaa |
| Hankasalmi | Keski-Suomi | Vain staattista selitystekstiä + jo lainvoimaisten kaavojen PDF-viitteitä, ei vireillä-listausta |
| Kannonkoski | Keski-Suomi | Vain jo lainvoimaisten kaavojen kaavakartta-arkisto; iso vireillä oleva tuulivoimahanke (Vuorijärvet) elää vain erillisissä uutispostauksissa, ei pysyvässä listausrakenteessa |
| Karstula | Keski-Suomi | Ei omaa vireillä-asemakaavat-sivua, vain vuosittainen kaavoituskatsaus-PDF ja tuulivoima-osio |
| Kivijärvi | Keski-Suomi | Vain kaavoituskatsaus-PDF ja katuluettelo, ei vireillä-sisältöä |
| Konnevesi | Keski-Suomi | Vain kaavakartta-/kaavamääräysviitemateriaalia, ei vireillä-sisältöä |
| Kuhmoinen | Keski-Suomi | Sivusto ohjaa JS-pohjaisen näytönleveys-uudelleenohjauksen ja evästetarkistuksen kautta — palvelinpuolen fetch ei pääse sisällön läpi |
| Kyyjärvi | Keski-Suomi | Sivulla ei ole muuta sisältöä kuin vuosittainen kaavoituskatsaus-viite |
| Luhanka | Keski-Suomi | "Kaavat ja alueet" -sivu on tosiasiassa yleinen kylä-/tapahtumasivu; varsinaiset kaava-asiakirjat ovat vain Google Drive -kansiossa |
| Juuka | Pohjois-Karjala | "Vireillä olevat kaavat" -sivu on rakenteeltaan hyvä mutta toteaa suoraan "Tällä hetkellä vireillä olevia kaavoja ei ole" |
| Outokumpu | Pohjois-Karjala | "Laadinnassa olevat kaavat" -osio on olemassa mutta täysin tyhjä, ei yhtään aktiivista hanketta |
| Polvijärvi | Pohjois-Karjala | Vain jo voimassa olevien kaavojen ja vanhojen (2018) ranta-asemakaavojen PDF-viitteitä, ei vireillä-listaa |
| Rääkkylä | Pohjois-Karjala | Kaavoituskatsaus toteaa suoraan "Rääkkylän kunnan alueella ei ole kaavoja vireillä eikä uusia kaavoja ole tiedossa" |
| Utajärvi | Pohjois-Pohjanmaa | Aiemmin löytynyt "Vireillä olevat kaavat" -sivu ei enää resolvoidu erilliseksi sisällöksi (ohjautuu yleiselle laskeutumissivulle); Tuulivoima-sivu sisältää vain yleistä markkinointi-/koulutustekstiä 7 hankkeesta ilman yksilöityjä hankenimiä tai -tiloja |
| Pukkila | Uusimaa | Asemakaavat-sivu toteaa suoraan "Ei vireillä olevia asemakaavoja"; yleiskaavat-osiossa vain kolme jo voimassa olevaa (2003/2007) referenssikaavaa, ei tuulivoima-/aurinkovoimasisältöä |
| Lapinjärvi | Uusimaa | Sivustolla vain kaksi kaava-aiheista sisältösivua: jo voimassa olevat yleiskaavat (2001/2002) ja yksi arkistoitunut yksittäishanke (Ingermaninkylän yritysalue, hyväksytty valtuustossa jo 13.2.2019) — ei ajantasaista vireillä-listaa |
| Myrskylä | Uusimaa | Ei kaavoitussisältöä sivustolla lainkaan (koko sivukartta, tekniset palvelut -osio ja rakennusvalvontasivu käyty läpi); ainoat kaavaviitteet ovat karttatiimi.fi-linkit jo voimassa oleviin osayleiskaavoihin |
| Nousiainen | Varsinais-Suomi | Asemakaavat- ja Yleiskaava-sivut sisältävät vain yleistä määritelmätekstiä ja jo hyväksyttyjä referenssikaavoja; kaavoituskatsaus-sivu toteaa vireillä olevien hankkeiden löytyvän vain katsaus-PDF:stä, ei erillistä vireillä-listaa verkkosivulla |
| Oripää | Varsinais-Suomi | Vain kaavoituskatsaus-PDF:iä (2016-2026) sekä nimettyjä tonttimarkkinointisivuja (Reinosen/Urponmäen/Uitonmäen/Toimintaloman alue) — ei rakenteista vireillä-kaava-sisältöä |
| Sauvo | Varsinais-Suomi | Kaavat ja kaavamääräykset -sivu sisältää vain yleistä määritelmätekstiä asemakaavasta/rantaosayleiskaavasta/maakuntakaavasta, ei yksilöityjä vireillä olevia hankkeita |

Huom: Pertunmaa (Etelä-Savo) ei ole omalla rivillään kuntalistassa — se liittyi
Mäntyharjuun 1.1.2025, joten sitä ei lasketa erilliseksi katteettomaksi kunnaksi.
Jalasjärvi (Etelä-Pohjanmaa) liittyi Kurikkaan 1.1.2016 ja on katettu Kurikan lähteen
kautta.

### Ei vielä tutkittu (tai tutkinnan tulos ei ole tallessa)

Kaikki Manner-Suomen maakunnat on nyt käyty läpi kokonaan — jäljellä olevat 51
katteetonta kuntaa ovat kaikki dokumentoituja infeasibility-tapauksia yllä olevassa
taulukossa, ei enää "ei vielä tutkittu" -kuntia.

## Luotettavuushuomio: istunnon tehtävälista ei ole totuudenmukainen

Tätä tiedostoa tehdessä havaittiin, että session-sisäinen tehtävälista (TaskCreate/
TaskUpdate) merkitsee tehtäviä valmiiksi, vaikka työtä ei olisi koskaan viety loppuun asti:

- **"Build Harjavalta zoning-plan collector"** ja **"Investigate Eurajoki zoning-plan
  source"** on merkitty valmiiksi, mutta kummastakaan ei löydy riviä `discovery_sources`-
  taulusta, koodia `apiCollector.ts`:stä eikä yhtään git-committia koko historiasta.
- Sama pätee **Suonenjokeen** ja **Tuusniemeen** (Pohjois-Savo) — tehtävät merkitty
  valmiiksi, mutta ei mitään jälkeä toteutuksesta.

Todennäköinen syy: konteksti on tiivistetty (compaction) useita kertoja tämän erittäin
pitkän istunnon aikana, ja jokin näistä tehtävistä on merkitty valmiiksi ennenaikaisesti
tai tiivistys on sekoittanut suunnitellun ja toteutuneen työn.

**Johtopäätös: älä luota tehtävälistaan sen suhteen, onko jokin lähde oikeasti olemassa.**
Tarkista aina suoraan `discovery_sources`-taulusta ja/tai `apiCollector.ts`:stä (ks. alla).
Tämä tiedosto on generoitu juuri siksi, että olisi yksi paikka joka kuvaa oikeaa tilaa.

## Miten tämä tiedosto päivitetään

1. Hae kaikki lähteet Supabasesta:
   ```
   GET {SUPABASE_URL}/rest/v1/discovery_sources?select=id,name,url,category,type,enabled&order=name
   ```
2. Hae kuntalista maakuntineen: `lib/geo/municipalities.ts` (`MUNICIPALITIES`-objekti).
3. Täsmää jokainen lähde kuntaan **URL:n hostnamen perusteella**, ei lähteen `name`-kentän
   perusteella — suomen kielen taivutusmuodot (esim. "Kauhajoki" → "Kauhajoen ...")
   tekevät nimipohjaisesta täsmäyksestä epäluotettavan. Käytä ensin täsmällistä
   (ASCII-foldattua, esim. ä→a) vertailua hostnamen ja kuntanimen välillä, ja vasta
   sen jälkeen manuaalista poikkeuslistaa niille kunnille, joiden verkkotunnus ei
   vastaa suomenkielistä nimeä (esim. kaksikieliset Pohjanmaan kunnat käyttävät usein
   ruotsinkielistä verkkotunnusta: Kruunupyy→kronoby.fi, Maalahti→malax.fi,
   Vöyri→vora.fi, Korsnäs→korsnas.fi, Uusikaarlepyy→nykarleby.fi, Luoto→larsmo.fi,
   Kristiinankaupunki→kristinestad.fi; lisäksi Oulu→ouka.fi, Nokia→nokiankaupunki.fi,
   Helsinki→hel.fi, Pedersören kunta→pedersore.fi).
4. Kunnat joita ei täsmätä mihinkään lähteeseen = kandidaatit "ei katettu" -listalle.
5. Päivitä tämän tiedoston taulukot ja päivämäärä yllä.

## Uuden kunnan lisäämisen 8-tiedosto-kaava

Kun uusi kunta rakennetaan, muista rekisteröidä lähde myös Supabaseen — pelkkä koodin
committaaminen ei riitä (ks. luotettavuushuomio yllä; sama virhe löytyi tämän istunnon
aikana myös Alajärvi/Alavus/Ilmajoki/Kauhajoki/Kurikka/Seinäjoki-lähteille, jotka oli
rakennettu mutta joiden `discovery_sources`-rivi puuttui, kunnes se lisättiin
jälkikäteen). Kahdeksan muokattavaa tiedostoa:

1. `lib/agent/discovery/collectors/apiCollector.ts` — kerääjäfunktio + dispatch-haara
2. `lib/agent/facts/extract{Kunta}KaavaFacts.ts`
3. `lib/agent/facts/resolveFacts.ts` — haara
4. `lib/agent/identity/resolvers/{kunta}KaavaResolver.ts`
5. `lib/agent/workers/factWorker.ts` — `JSON_ONLY_SOURCES`-taulukon rivi
6. `lib/agent/workers/identityWorker.ts` — haara
7. `lib/projects/identity.ts` — identifier-tyyppi KAHTEEN paikkaan (tyyppiunioni +
   runtime-taulukko)
8. `app/api/tic/projects/approve/route.ts` — `isXxxKaava`-lippu KAHTEEN paikkaan

Ja lisäksi: `discovery_sources`-rivi Supabaseen (`POST /rest/v1/discovery_sources`).
