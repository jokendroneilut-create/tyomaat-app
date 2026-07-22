# Kaavoitus-lähteiden kattavuus

Tämä tiedosto listaa, mistä kunnista tyomaat.fi kerää kaavoitustietoa (`discovery_sources`,
`category = zoning_plan` / `zoning`) ja mistä kunnista lähdettä ei ole (vielä) saatu
toteutettua. Tarkoitus on välttää saman kunnan turhaa uudelleentutkimista tulevissa
istunnoissa.

**Tilanne 22.7.2026.** Luvut on generoitu suoraan Supabasen `discovery_sources`-taulusta ja
`lib/geo/municipalities.ts`-tiedostosta, ei istunnon tehtävälistasta — ks. luotettavuushuomio
lopussa.

## Yhteenveto

- Manner-Suomen kuntia yhteensä: 292 (Ahvenanmaan 16 kuntaa rajattu pois, ei toistaiseksi
  tavoitteena).
- Katettu (rekisteröity lähde): **212**
- Ei vielä katettu: **80**
  - joista syy tiedossa ja dokumentoitu (ks. alla): 11
  - loput (69) ovat joko tutkimatta kokonaan tai niiden tutkinnan tulos on kadonnut
    aiemman (tiivistetyn) istunnon mukana — ei tarkoita automaattisesti "toteutettavissa".
- Valtakunnallisia / usean kunnan lähteitä (ei kuntakohtaisia, ei mukana yllä olevissa
  luvuissa): Hilma, Lupapiste kuulutukset, Väylävirasto hankkeet, Senaatti-kiinteistöt
  hankkeet, Puolustuskiinteistöt uutiset, Kreate hankkeet.

## Katetut kunnat maakunnittain

Muoto: `Kunta: discovery_sources.name`

### Etelä-Karjala (5)
Imatra, Lappeenranta, Lemi, Rautjärvi, Savitaipale

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

### Keski-Suomi (14)
Joutsa, Jyväskylä, Jämsä, Keuruu, Laukaa, Multia, Muurame, Petäjävesi, Pihtipudas,
Saarijärvi, Toivakka, Uurainen, Viitasaari, Äänekoski

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

### Pohjois-Karjala (7)
Ilomantsi, Joensuu, Kitee, Kontiolahti, Lieksa, Liperi, Tohmajärvi

### Pohjois-Pohjanmaa (17)
Alavieska, Hailuoto, Ii, Kalajoki, Kempele, Kuusamo, Liminka, Nivala, Oulainen, Oulu,
Raahe, Sievi, Siikajoki, Siikalatva, Taivalkoski, Vaala, Ylivieska

### Pohjois-Savo (7)
Iisalmi, Kiuruvesi, Kuopio, Lapinlahti, Pielavesi, Siilinjärvi, Varkaus

### Päijät-Häme (4)
Heinola, Hollola, Lahti, Orimattila

### Satakunta (8)
Eura, Huittinen, Kankaanpää, Kokemäki, Pori, Rauma, Siikainen, Ulvila

### Uusimaa (22)
Espoo, Hanko, Helsinki, Hyvinkää, Inkoo, Järvenpää, Karkkila, Kauniainen, Kerava,
Kirkkonummi, Lohja, Loviisa, Mäntsälä, Nurmijärvi, Pornainen, Porvoo, Raasepori,
Sipoo, Siuntio, Tuusula, Vantaa, Vihti

### Varsinais-Suomi (23)
Aura, Kaarina, Kemiönsaari, Kustavi, Laitila, Lieto, Loimaa, Marttila, Masku,
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

Huom: Pertunmaa (Etelä-Savo) ei ole omalla rivillään kuntalistassa — se liittyi
Mäntyharjuun 1.1.2025, joten sitä ei lasketa erilliseksi katteettomaksi kunnaksi.
Jalasjärvi (Etelä-Pohjanmaa) liittyi Kurikkaan 1.1.2016 ja on katettu Kurikan lähteen
kautta.

### Ei vielä tutkittu (tai tutkinnan tulos ei ole tallessa)

Nämä eivät ole "todettu toteuttamiskelvottomiksi" — ne on vain rajattu pois
`discovery_sources`-taulun perusteella, eikä niitä ole (varmuudella) käyty läpi tässä
istunnossa. Osa saattaa olla helpostikin toteutettavissa, osa ei.

- **Etelä-Karjala:** Luumäki, Parikkala, Ruokolahti, Taipalsaari
- **Etelä-Savo:** Joroinen, Rantasalmi
- **Kanta-Häme:** Humppila, Ypäjä
- **Keski-Pohjanmaa:** Halsua, Kaustinen
- **Keski-Suomi:** Hankasalmi, Kannonkoski, Karstula, Kinnula, Kivijärvi, Konnevesi,
  Kuhmoinen, Kyyjärvi, Luhanka
- **Pohjanmaa:** Närpiö
- **Pohjois-Karjala:** Juuka, Nurmes, Outokumpu, Polvijärvi, Rääkkylä
- **Pohjois-Pohjanmaa:** Haapajärvi, Haapavesi, Kärsämäki, Lumijoki, Merijärvi, Muhos,
  Pudasjärvi, Pyhäjoki, Pyhäjärvi, Pyhäntä, Reisjärvi, Tyrnävä, Utajärvi
- **Pohjois-Savo:** Kaavi, Keitele, Leppävirta, Rautalampi, Rautavaara, Sonkajärvi,
  Suonenjoki, Tervo, Tuusniemi, Vesanto, Vieremä
- **Päijät-Häme:** Asikkala, Hartola, Kärkölä, Padasjoki, Sysmä
- **Satakunta:** Eurajoki, Harjavalta, Jämijärvi, Karvia, Merikarvia, Nakkila, Pomarkku,
  Säkylä
- **Uusimaa:** Lapinjärvi, Myrskylä, Pukkila
- **Varsinais-Suomi:** Koski Tl, Nousiainen, Oripää, Sauvo

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
