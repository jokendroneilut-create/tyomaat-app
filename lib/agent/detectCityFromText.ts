import { MUNICIPALITIES } from "@/lib/geo/municipalities"

/*
 * Suomen sijamuodot eivät taivu säännöllisellä liitteellä kaikissa
 * tapauksissa (esim. "Helsinki" -> "Helsingin", konsonanttivaihtelu
 * k -> g), joten epäsäännölliset/yhdyssanamuodot käsitellään erikseen
 * ennen yleistä kanta+pääte-tunnistusta. Yleinen tunnistus kattaa
 * suurimman osan ~300 kunnasta ilman että jokaista pitää luetella
 * erikseen.
 */
const IRREGULAR_ALIASES: Record<string, string> = {
  "helsingin": "Helsinki",
  "helsingistä": "Helsinki",
  "helsingissä": "Helsinki",
  "helsinkiin": "Helsinki",
  "turun": "Turku",
  "turussa": "Turku",
  "turkuun": "Turku",
  "tampereen": "Tampere",
  "tampereella": "Tampere",
  "tampereelle": "Tampere",
  "kaarinaan": "Kaarina",
  "kangasalan": "Kangasala",
  "siuntion": "Siuntio",
  "hyvinkäälle": "Hyvinkää",
  "hyvinkäällä": "Hyvinkää",
  "iissä": "Ii",
  "iihin": "Ii",
  "klaukkalaan": "Nurmijärvi",
  "klaukkalan": "Nurmijärvi",
  "nihdin": "Helsinki",
  /*
   * Ivalo on kylä Inarissa, ei kunta, joten kuntaluettelo ei tunne sitä.
   * Fingridin "IV03 - Ivalon sähköaseman uusiminen" jäi ilman kuntaa — ja
   * koska maakunta johdetaan kunnasta, myös ilman maakuntaa (D-292).
   *
   * MIKSI YKSI RIVI EIKÄ KOKO KARTTA. `lib/geo`:n `PLACE_ALIASES` tuntee
   * jo Ivalon ja 40 muuta postitoimipaikkaa, ja sen kytkeminen tähän oli
   * ensimmäinen yritys. Mitattu 6 847 hankkeella: 7 UUTTA VIRHETTÄ ja
   * vain 2 aidosti tyhjän kunnan täyttöä. Kylän nimi osuu vapaassa
   * tekstissä toisen kunnan kaupunginosaan tai rakennuksen nimeen:
   *
   *   "Nahkurin ja Nummelan asemakaavan muutos"  Ulvila -> Vihti
   *   "Päiväkoti Immola, Daghemmet Staffan"      Helsinki -> Imatra
   *   "...2 x (400 kV...)" (Hikiä-johto)         Jämsä -> Hausjärvi
   *
   * Kuratoitu kartta kelpaa KENTTÄÄN (`notice.city`), jossa arvo on jo
   * paikannimi; vapaassa tekstissä se ei kelpaa. Siksi tähän listaan
   * lisätään nimi kerrallaan, kuten "klaukkalan" ja "nihdin" ennen tätä.
   * "Ivalo" on yksikäsitteinen: se ei ole sana eikä osa yhdyssanaa.
   */
  /*
   * Vuolijoki liittyi Kajaaniin 2007 eikä ole kuntaluettelossa. Destian
   * tiedote "BoP-urakoitsijana 125 MW / 250 MWh:n BESS-projektissa
   * Vuolijoella" jäi ilman kuntaa (D-295). Yksikäsitteinen paikannimi,
   * sama yksittäislisäys kuin Ivalo yllä.
   */
  "vuolijoki": "Kajaani",
  "vuolijoen": "Kajaani",
  "vuolijoella": "Kajaani",
  "vuolijoelle": "Kajaani",
  /*
   * Kurikka taipuu astevaihtelulla (kk -> k), joten kanta "kurikk" ei osu
   * muotoon "Kurikassa". Jalasjarvi liittyi Kurikkaan 2016. Oteranin
   * "Vt 3:n ja Vt 19:n liittymajarjestelyiden parantaminen Kurikassa"
   * jai ilman kuntaa, vaikka ingressi sanoo myos "Jalasjarvelle" (D-310).
   */
  "kurikassa": "Kurikka",
  "kurikan": "Kurikka",
  "kurikasta": "Kurikka",
  "kurikkaan": "Kurikka",
  "jalasjärvi": "Kurikka",
  "jalasjärven": "Kurikka",
  "jalasjärvellä": "Kurikka",
  "jalasjärvelle": "Kurikka",
  "ivalo": "Inari",
  "ivalon": "Inari",
  "ivalossa": "Inari",
  "ivaloon": "Inari",
  "lahteen": "Lahti",
  "lahdessa": "Lahti",
  "lahden": "Lahti",
  "liedon": "Lieto",
  "ouluun": "Oulu",
  "oulussa": "Oulu",
  "valkeakoskelle": "Valkeakoski",
  "kirkkonummen": "Kirkkonummi",
  "kirkkonummelle": "Kirkkonummi",
  "ylöjärven": "Ylöjärvi",
  "ylöjärvellä": "Ylöjärvi",
  "raisioon": "Raisio",
  "raisiossa": "Raisio",
  "kempeleessä": "Kempele",
  "kempeleeseen": "Kempele",
  "porvoon": "Porvoo",
  "porvooseen": "Porvoo",
  "mynämäelle": "Mynämäki",
  "mynämäellä": "Mynämäki",
  "mynämäeltä": "Mynämäki",
  /*
   * Sama k:n kato kuin Mynamaella: "Uusia vuokra-asuntoja Riihimaelle"
   * (TA:n tiedote, D-254) ei osunut kantaan "riihimak".
   */
  "riihimäelle": "Riihimäki",
  "riihimäellä": "Riihimäki",
  "riihimäeltä": "Riihimäki",
  "riihimäen": "Riihimäki",
  /*
   * SAMA K:N KATO KAHDESSA ISOSSA KAUPUNGISSA (D-322). Mitattu
   * 19.10.2026 kahdeksallatoista taivutusmuodolla: neljä petti, ja
   * kolme niistä on tätä samaa tyyppiä. Seinäjoki ja Rovaniemi ovat
   * kymmenien hankkeiden kuntia, joten aukko ei koske vain yhtä
   * lähdettä. "rovaniemen" osui jo, loput eivät.
   */
  "seinäjoelle": "Seinäjoki",
  "seinäjoella": "Seinäjoki",
  "seinäjoelta": "Seinäjoki",
  "seinäjoen": "Seinäjoki",
  "rovaniemelle": "Rovaniemi",
  "rovaniemellä": "Rovaniemi",
  "rovaniemeltä": "Rovaniemi",
  /* Nurmes taipuu s -> kse, kuten Parainen nen -> s. */
  "nurmekseen": "Nurmes",
  "nurmeksessa": "Nurmes",
  "nurmeksen": "Nurmes",
  "nurmekselle": "Nurmes",
  /*
   * Pitkaan vokaaliin paattyva nimi saa illatiivin -hun: "Rakennamme
   * Joensuuhun 60-paikkaisen palveluasumisyksikon" (Vexatecin tiedote).
   * Muut Joensuun muodot osuivat jo.
   */
  "joensuuhun": "Joensuu",
  /*
   * Parainen taipuu nen -> s ("Paraisille"), eika kanta "paraine" osu
   * mihinkaan naista. Mitattu 11.10.2026: tiedote "asuntokohde Norra
   * Famnen -kortteliin Paraisille" jai ilman kuntaa, ja tekstista
   * poimittiin saman tiedotteen toinen hanke (Raisio).
   */
  "paraisille": "Parainen",
  "paraisilla": "Parainen",
  "paraisilta": "Parainen",
  "paraisten": "Parainen",
  "paraisiin": "Parainen",
}

/*
 * Rajattu suomen sijapäätelista (ei mielivaltainen \w-jokeri) — pelkkä
 * kanta+mikä-tahansa-pääte tuottaisi vääriä osumia (esim. kunta "Tervo"
 * täsmäisi sanaan "terveiset"). Sisältää sekä etu- että takavokaalimuodot
 * ja kahdentuvan illatiivin yleisimmät variantit.
 */
const SUFFIX_ALTERNATION =
  "ssa|ssä|sta|stä|seen|lla|ella|llä|lta|ltä|lle|aan|ään|oon|öön|uun|yyn|iin|een|an|än|na|nä|n|in|en|on|un|yn|ksi|ta|tä"
const SUFFIX_PATTERN = `(${SUFFIX_ALTERNATION})?`
// Pakollinen pääte lyhyille nimille — muuten esim. kunta "Ii" täsmäisi
// jokaiseen roomalaiseen numeroon "II" (esim. "vaihe II", "kortteli II").
const MANDATORY_SUFFIX_PATTERN = `(${SUFFIX_ALTERNATION})`

// "Kaavi" kannalla ("kaav") törmäisi jatkuvasti tämän sovelluksen omaan
// sanastoon ("kaava", "kaavan", "kaavoitus") — jätetään kantahaku pois
// tälle kunnalle, tarkka nimi + pääte riittää kattamaan oikeat osumat.
// "Loppi" kannalla ("lopp") tuotti osuman sanaan "loppuun" ("vuoden 2028
// loppuun mennessä"), ja mitattuna 19.8.2026 kolme kannan kahdeksasta
// Loppi-hankkeesta oli tällä tavoin väärässä kunnassa - mm. "JYSKin uudet
// liiketilat Järvenpäähän" ja "Ämttön silta Porissa". Poisto ei menetä
// mitään, koska astevaihtelun takia aidot muodot "Lopen" ja "Lopella"
// eivät osu kantaankaan; ne jäävät tunnistumatta joka tapauksessa.
const STEM_MATCH_EXCLUDED = new Set(["Kaavi", "Loppi"])

const sortedMunicipalities = Object.values(MUNICIPALITIES).sort(
  (a, b) => b.name.length - a.name.length
)

/*
 * JS:n \b perustuu \w-luokkaan, joka ei tunne ä/ö/å-kirjaimia sanan osaksi
 * — "Pyöreälahti" näyttäytyisi \b:lle kahtena sanana ("pyöre" + "älahti"),
 * jolloin "Lahti" täsmäisi virheellisesti keskeltä yhdyssanaa. Korvataan
 * omalla rajamäärittelyllä, joka sisällyttää myös suomen erikoiskirjaimet.
 */
const FI_WORD_CHAR = "\\wäöåÄÖÅ"
const LEFT_BOUNDARY = `(?<![${FI_WORD_CHAR}])`
const RIGHT_BOUNDARY = `(?![${FI_WORD_CHAR}])`

/*
 * ENSIMMAINEN TEKSTISSA VOITTAA, EI ENSIMMAINEN TAULUKOSSA (D-267).
 *
 * Funktio palautti ensimmaisen osuman TAULUKON jarjestyksessa, ja
 * "helsingin / helsingissa / helsinkiin" ovat IRREGULAR_ALIASES-listan
 * karjessa. Niinpa mika tahansa maininta Helsingista missa tahansa
 * kohtaa tekstia voitti hankkeen oikean sijainnin — ja yrityksen
 * paakonttori mainitaan tiedotteen lopussa lahes aina.
 *
 * Mitattu 11.10.2026: 283 rivilla kaupunki oli tullut lahteesta, ja
 * 49:lla tekstintunnistus sanoi eri. Niista kahdeksan kymmenesta sanoi
 * "Helsinki" — mm. "Datakeskus Kajaaniin", "47 asuntoa Espooseen",
 * "Sinilahteen palvelutalon Heinolaan".
 *
 * SIJAINTI TEKSTISSA ON OIKEA JARJESTYSPERUSTE. Hankkeen paikka
 * sanotaan ensimmaisessa virkkeessa ("Datakeskus Kajaaniin"),
 * paakonttori lopussa. Tama ei ole kielioppisaanto vaan tiedotteen
 * rakenne, ja se patee jokaiseen mitattuun esimerkkiin.
 */
/*
 * "-jarvi"-kunta jonka perassa on rantasana on JARVI, ei kunta.
 * Lujatalon tiedote sijoittaa Tampereen Hatanpaan pysakointitalon
 * "Pyhajarven rantamaisemaan", ja tunnistin siirsi hankkeen
 * Pyhajarven kuntaan Pohjois-Pohjanmaalle. Vesistonimi on sama kuin
 * kunnan nimi kymmenissa tapauksissa, joten rantasana on luotettavampi
 * merkki kuin itse nimi.
 */
/*
 * Kaupunginnimi yrityksen nimessa ei kerro hankkeen sijaintia.
 * Rakennusalalla nimet ovat täynnä kaupunkeja: "Varte Turku Oy toimii
 * urakoitsijana Saloon rakennettavassa hoivakodissa" luki hankkeen
 * Turkuun, ja "Skanska ja Helsingin Osuuskauppa Elanto" siirsi Espoon
 * Prismakeskuksen Helsinkiin. Kumpikin kenttä oli kannassa oikein ja
 * tunnistin väärässä (mitattu 11.10.2026).
 */
const YHTIOMUOTO = /^\s+(Oy|Oyj|Ab|Abp|Ky|Oy:n|Oyj:n|Osuuskauppa|Osuuskunta|Yhtiot|Yhtiöt)\b/i

const RANTASANA = /^\s+(rannal|rannas|rantaan|rantama|rantoj|rannoi|ranta)/i

function aikaisinOsuma(
  lower: string,
  kuvio: RegExp,
  vesistoEhdokas = false,
  text: string = lower
): number {
  let haku = 0
  for (;;) {
    const m = lower.slice(haku).match(kuvio)
    if (!m) return -1
    const kohta = haku + m.index!
    const jatko = text.slice(kohta + m[0].length, kohta + m[0].length + 14)
    const vesisto = vesistoEhdokas && RANTASANA.test(jatko)
    if (!vesisto && !YHTIOMUOTO.test(jatko)) return kohta
    haku = kohta + m[0].length
  }
}

/*
 * Lainausmerkeissa oleva sana on NIMI, ei paikka. Kilpailuehdotukset,
 * korttelinimet ja hankenimet ovat usein paikannimia: Melkinlaiturin
 * arkkitehtuurikilpailun voitti ehdotus "Luoto", ja tunnistin luki
 * Helsingin hankkeen Luodon kuntaan. Korvataan valilyonneilla, jotta
 * merkkien kohdat eivat siirry.
 */
const LAINAUSMERKIT = /[“”„″"«»]([^“”„″"«»]{1,40})[“”„″"«»]/g

function haivytaLainaukset(text: string): string {
  return text.replace(LAINAUSMERKIT, (koko) => " ".repeat(koko.length))
}

export function detectCityFromText(text: string): string | null {
  const siivottu = haivytaLainaukset(text)
  const lower = siivottu.toLowerCase()

  let paras: { kaupunki: string; kohta: number } | null = null
  const ehdolle = (kaupunki: string, kohta: number) => {
    if (kohta < 0) return
    if (!paras || kohta < paras.kohta) paras = { kaupunki, kohta }
  }

  for (const [alias, city] of Object.entries(IRREGULAR_ALIASES)) {
    /*
     * Sananrajattu — pelkkä .includes() täsmäisi myös yhdyssanan sisään
     * (esim. "lahteen" osana "Espoonlahteen", vaikka kyse on Espoosta).
     */
    const aliasRegex = new RegExp(
      `${LEFT_BOUNDARY}${escapeRegex(alias)}${RIGHT_BOUNDARY}`,
      "i"
    )
    ehdolle(city, aikaisinOsuma(lower, aliasRegex, false, siivottu))
  }

  for (const municipality of sortedMunicipalities) {
    const name = municipality.name.toLowerCase()
    const isShortName = name.length <= 4

    const exactPattern = isShortName ? MANDATORY_SUFFIX_PATTERN : SUFFIX_PATTERN
    const exactRegex = new RegExp(
      `${LEFT_BOUNDARY}${escapeRegex(name)}${exactPattern}${RIGHT_BOUNDARY}`,
      "i"
    )
    const vesisto = /jarvi$|järvi$/i.test(name)
    ehdolle(municipality.name, aikaisinOsuma(lower, exactRegex, vesisto, siivottu))

    if (isShortName || STEM_MATCH_EXCLUDED.has(municipality.name)) continue

    /*
     * Kanta (nimen viimeinen kirjain pudotettu, usein vokaali joka
     * vaihtuu/katoaa sijataivutuksessa, esim. "Vaasa" -> "Vaasan",
     * "Iisalmi" -> "Iisalmen") + sama rajattu päätelista. Ei täydellinen
     * suomen kielioppi, mutta kattaa valtaosan taivutusmuodoista ilman
     * mielivaltaista jokerimerkkiä.
     */
    const stem = name.slice(0, -1)
    /*
     * Kantaosuma vaatii sijapaatteen (MANDATORY), toisin kuin tarkka
     * nimi. Paljas kanta on liian heikko: "Nurme" osui YIT:n Tallinnan
     * hankkeen nimeen "Nurme 2 ja 4" ja vei suomalaisen tiedotteen
     * Nurmekseen. Perusmuoto ei jaa tunnistumatta, koska tarkka nimi
     * + valinnainen paate kattaa sen jo.
     */
    const stemRegex = new RegExp(
      `${LEFT_BOUNDARY}${escapeRegex(stem)}${MANDATORY_SUFFIX_PATTERN}${RIGHT_BOUNDARY}`,
      "i"
    )
    ehdolle(municipality.name, aikaisinOsuma(lower, stemRegex, vesisto, siivottu))
  }

  return paras ? (paras as { kaupunki: string }).kaupunki : null
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
