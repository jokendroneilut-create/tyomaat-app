/*
 * Voittajien poiminta kunnan hankintapäätöksestä.
 *
 * ANKKURINA ON PÄÄTÖSLAUSE, EI Y-TUNNUS.
 *
 * Ensimmäinen versio poimi jokaisen yrityksen jonka perässä oli y-tunnus
 * suluissa. Se osui, koska voittajat todella luetellaan niin - mutta niin
 * luetellaan myös HÄVIÄJÄT. Päätösteksti sisältää lähes aina
 * tarjousvertailutaulukon:
 *
 *   "Hyväksytyt tarjoajat (Y-tunnus) ja heidän urakkahintansa olivat:
 *    Oteran Oy (2245597-0) 833 500 euroa, Silta Laksio Oy (22548122) ..."
 *
 * Mitattu 11 rivin otoksella: 3 oikein, 8 väärin. Kuusankosken
 * yhtenäiskoulusta tuli kolme "voittajaa" vaikka teksti sanoo
 * "KVR-urakoitsijaksi valitaan Varte Lahti Oy" - Lujatalo ja Lapti eivät
 * tulleet hylätyiksi, ne vain hävisivät vertailun, joten hylkäyssuodatinkaan
 * ei niitä poistanut.
 *
 * Oikea erotin on se lause jossa päätös tehdään. Aineistossa niitä on neljä
 * muotoa, ja kaikki neljä on nähty oikeissa päätöksissä:
 *
 *   1. MONIKKOROOLI + luettelo (puitesopimus, monta voittajaa)
 *      "hyväksyä puitesopimuskumppaneiksi seuraavat tarjoajat: A Oy (...) ..."
 *   2. YKSIKKÖROOLI (yksi urakoitsija)
 *      "Stadionin A-osan urakoitsijaksi valitaan MVR-Yhtymä Oy"
 *   3. VIRANHALTIJAN VALINTA
 *      "Päätös Valitsen Saltex Infra Oy:n hinnaltaan halvimpana."
 *   4. ABLATIIVI (hankinta yritykseltä)
 *      "Kouvolan kaupunki hankkii Asfalttiurakka 2026 urakan Peab Industri Oy:ltä."
 *
 * Ratkaiseva on roolisanan SIJA JA LUKU: "-kumppaneiksi" ja "-urakoitsijoiksi"
 * ovat voittajarooleja, mutta "tarjoajiksi" ja "ehdokkaiksi" eivät -
 * "Tarjoajiksi valittiin seuraavat kolme (3) ehdokasta" on tarjoajalista,
 * ei päätös.
 *
 * Jos päätöslausetta ei löydy, tulos on tyhjä. Väärä urakoitsija ohjaa
 * asiakassuodatusta väärin, tyhjä ei ohjaa mihinkään.
 */

/*
 * Ääkköset on lueteltava erikseen: \w ei kata niitä, ja ilman niitä nimi
 * katkeaa väärästä kohdasta. Mitattu: "Karri Räikkä Oy" ja
 * "J&S Kymäläinen Oy" jäivät poimimatta, koska poiminta pysähtyi ä:hän.
 */
const NAME_CHAR = "[\\wåäöÅÄÖ&.\\-]"
const COMPANY_FORMS = "Oy|Oyj|Ay|Ky|Ab|Abp|Tmi"

/*
 * Suomen kirjaimet on lueteltava joka paikassa erikseen. \w ei kata ä:tä
 * eikä ö:tä, ja \b ei tunnista sananrajaa niiden jälkeen - ":ltä." ei ole
 * \b:n mielestä sanan loppu, koska ä ei ole sanamerkki. Sama vika on
 * kaatanut tämän tiedoston poiminnan kolmesti: "hyväksyä" ei osunut
 * kuvioon "hyväks\w+", ja ablatiivi jäi löytymättä päätteen \b:hen.
 */
const FI_WORD = "[\\wåäöÅÄÖ]"
const FI_BOUNDARY = `(?!${FI_WORD})`

/*
 * Yrityksen nimi ilman y-tunnusta: isolla alkavia sanoja, viimeisenä
 * yhtiömuoto. Sanan on alettava isolla, jotta poiminta ei syö edeltävää
 * tekstiä - "hankkii ... urakan Peab Industri Oy" pysähtyy oikein
 * "Peab":iin, koska "urakan" on pienellä.
 *
 * POIKKEUKSENA "ja", joka on yleinen yhdistelmänimissä: "Oulun Maa- ja
 * Vesirakennus Oy". Ilman sitä ketju katkesi, eikä nimi osunut lainkaan.
 */
const NAME_WORD = `(?:[A-ZÅÄÖ0-9&]${NAME_CHAR}*|ja)`

/*
 * TOISTO ON LAISKA. Ahne toisto yhdistäisi kaksi eri yritystä yhdeksi,
 * koska "ja" kelpaa nyt väliin: "Rakennus Oy ja Kone Oy" tuottaisi yhden
 * nimen kahden sijaan. Laiska pysähtyy ensimmäiseen yhtiömuotoon, jolloin
 * "Oulun Maa- ja Vesirakennus Oy" tulee silti kokonaan - sitä ennen ei ole
 * yhtiömuotoa johon pysähtyä.
 *
 * Sivutuotteena myös etuliitteinen muoto toimii: "Oy Sähkö-Vendelin Ab"
 * pysähtyy vasta Ab:hen, koska ensimmäinen "Oy" on nimen alkusana eikä
 * toiston sisällä.
 */
const NAME = `[A-ZÅÄÖ]${NAME_CHAR}*(?:\\s+${NAME_WORD}){0,5}?\\s+(?:${COMPANY_FORMS})`

/* Nimi + y-tunnus suluissa. Käytetään VAIN luettelon sisällä. */
const NAME_WITH_ID = new RegExp(
  `(${NAME})(?::n)?\\s*\\(\\s*(?:y-tunnus\\s*)?(?:FI\\d{8,9}|\\d{7,8}-?\\d?)\\s*\\)`,
  "g"
)

/*
 * Monikkoroolit = puitesopimus, kaikki luettelon yritykset voittavat.
 * "tarjoajiksi" ja "ehdokkaiksi" EIVÄT ole tässä: ne nimeävät kilpailuun
 * päässeet, eivät valittuja.
 */
const LIST_ROLES =
  "puitesopimuskumppaneiksi|sopimuskumppaneiksi|urakoitsijoiksi|toimittajiksi|palveluntuottajiksi|palveluntarjoajiksi"

const LIST_ANCHOR = new RegExp(`(?:valit|hyväks)${FI_WORD}+\\s+(?:${LIST_ROLES})`, "gi")

/*
 * Luettelo katkeaa kun proosa jatkuu. Väliotsikot ("Rakennustekniset työt
 * (rakennusurakat)") ovat lyhyitä ja jäävät luettelon sisään; seuraava
 * kappale ("Kuhunkin tämän puitesopimusjärjestelyn nojalla...") on selvästi
 * pidempi. Mitattu Kouvolan 44 yrityksen luettelolla.
 */
const LIST_GAP = 260

/*
 * Hylätyt luetellaan samassa muodossa heti hyväksyttyjen perään:
 * "Virra Talotekniikka Oy (FI29940581) AS-Corp Oy (3494831-8) – hylätään."
 * Luettelo ei siis katkea hylkäyksiin, joten ne on suodatettava erikseen.
 * Ilman tätä hylätty tarjoaja päätyisi voittajaksi aina kun se ei satu
 * olemaan myös hyväksyttyjen joukossa jossain toisessa osa-alueessa.
 */
const REJECTION = /hylät|hylkä|suljetaan|ei\s+täytä|poissuljet/i
const REJECTION_WINDOW = 60

/*
 * Yksikköroolit. Etuliite on sallittu, koska rooli esiintyy yhdyssanana:
 * "KVR-urakoitsijaksi", "pääurakoitsijaksi".
 *
 * MYÖS MONIKKOROOLIT kelpaavat tähän. Roolin luku ei kerro voittajien
 * määrää: pienhankinnassa lukee "sopimustoimittajiksi valitaan ... Lapin
 * Timanttisahaus Oy" vaikka voittajia on yksi. Monikko ratkaisee vain sen,
 * kumpaa reittiä yritetään ensin - luettelo ajetaan aina ennen tätä, ja
 * tänne päädytään vain jos luetteloa ei ollut.
 */
/*
 * KUVIO ON KIRJAINKOKOHERKKÄ, ja siksi roolit ja verbi kirjoitetaan
 * molemmilla alkukirjaimilla. Kuvio ei voi käyttää i-lippua: se tekisi myös
 * nimen kuviosta [A-ZÅÄÖ] kirjainkoosta riippumattoman, jolloin isolla
 * alkava sana lakkaisi olemasta vaatimus - ja juuri se erottaa yritysnimen
 * sitä edeltävistä perustelusanoista. Mitattu: kannassa oli voittajina
 * "kokonaistaloudellisesti edullisimman tarjouksen jättänyt Oteran Oy" ja
 * "halvimman tarjoushinnan tehnyt Lappset Group Oy".
 */
const SINGLE_ROLES = [
  `${NAME_CHAR}*[Uu]rakoitsijaksi`,
  "[Tt]oimittajaksi",
  "[Pp]alveluntuottajaksi",
  "[Ss]opimuskumppaniksi",
  "[Pp]uitesopimuskumppaneiksi",
  "[Ss]opimuskumppaneiksi",
  `${NAME_CHAR}*[Uu]rakoitsijoiksi`,
  `${NAME_CHAR}*[Tt]oimittajiksi`,
  "[Pp]alveluntuottajiksi",
  "[Pp]alveluntarjoajiksi",
].join("|")

/*
 * Verbin ja nimen väliin mahtuu perustelu: "valitaan hinnaltaan halvimman
 * kokonaistarjouksen jättänyt Lapin Timanttisahaus Oy". Välisanat saavat
 * alkaa vain pienellä, joten kuvio ei voi ohittaa yritysnimeä ja tarttua
 * seuraavaan. Määrä on rajattu, koska rajaamaton väli yhdistäisi roolin ja
 * nimen eri virkkeistä.
 */
const FILLER = `(?:[a-zåäö]${FI_WORD}*\\s+){0,5}`

/*
 * Nimi voi olla roolisanan kummalla puolen tahansa:
 *   "urakoitsijaksi valitaan MVR-Yhtymä Oy"
 *   "KVR-urakoitsijaksi Varte Lahti Oy:n, käyttäen ..."
 *
 * VALINTAVERBI VOI OLLA MYÖS ROOLIN EDELLÄ, jolloin roolin ja nimen välissä
 * on pelkkä perustelu: "Päätän valita ... urakan pääurakoitsijaksi
 * kokonaishinnaltaan edullisimman tarjouksen jättäneen Oulun Maa- ja
 * Vesirakennus Oy:n". Verbi kaapataan siksi omaan ryhmäänsä, ja jos sitä ei
 * ole roolin jälkeen, se etsitään roolia edeltävästä ikkunasta. Ilman
 * valintaverbiä osuma hylätään kokonaan: rooli on silloin pelkkä maininta
 * ("urakoitsijaksi soveltuvan yrityksen tulee..."), ei päätös.
 */
const SINGLE_ANCHOR = new RegExp(
  `(?:${SINGLE_ROLES})${FI_BOUNDARY}\\s+(?:([Vv]alit${FI_WORD}+)\\s+)?${FILLER}(${NAME})`,
  "g"
)

const SELECT_VERB = /valit|päät|hyväks/i
const SELECT_WINDOW = 200

/*
 * Viranhaltijapäätöksen vakiolause. Iso alkukirjain on tarkoituksellinen:
 * "valitsen" pienellä keskellä perustelutekstiä ei ole päätöslause.
 */
const OFFICEHOLDER = new RegExp(`\\bValitsen\\s+(${NAME})`, "g")

/*
 * Ablatiivi: hankinnan kohde ostetaan yritykseltä. Vaaditaan ostoverbi
 * samasta virkkeestä, muuten "Oy:ltä" osuisi myös lausunnon pyytämiseen
 * ("pyydettiin lausunto X Oy:ltä").
 */
const ABLATIVE = new RegExp(`(${NAME})\\s*:lt[äa]${FI_BOUNDARY}`, "g")
/*
 * Ostoverbin muodot on luettu aineistosta, ei arvattu. PASSIIVI ON
 * YLEISEMPI KUIN AKTIIVI: "hankitaan" esiintyy 9 rivillä, "hankkii" 14 -
 * ja ensimmäinen versio tunsi vain jälkimmäisen, koska kuvio vaati
 * kaksois-k:n. Mitattu: "Järviojan reunapatojen peruskorjaus ... hankitaan
 * Konetyö Koskimäki Oy:ltä" jäi ilman voittajaa.
 *
 * Lista pidetään verbeissä. Substantiivi "hankinta" esiintyy näissä
 * teksteissä joka kappaleessa, joten se tekisi koko vartijasta hyödyttömän.
 */
const PURCHASE_VERB =
  /\bhank(?:ki[iva]|kia|itaan|ittiin)|\bost(?:aa|etaan|ettiin)|\btilat(?:aan|tiin|a)\b|\btilaa\b/i
const PURCHASE_WINDOW = 220

export function extractDecisionWinners(description: string | null | undefined): string[] {
  if (!description) return []

  /*
   * Rivinvaihdot ja tuplavälit pois: päätöslause katkeaa aineistossa usein
   * kesken ("urakoitsijaksi\n   valitaan"), ja \s+ riittää vain jos teksti
   * on ensin normalisoitu.
   */
  const text = description.replace(/\s+/g, " ")

  const found: string[] = []

  for (const anchor of text.matchAll(LIST_ANCHOR)) {
    found.push(...collectList(text, (anchor.index ?? 0) + anchor[0].length))
  }

  /*
   * Yksittäisvoittajat luetaan vain jos puitesopimusluetteloa ei ollut.
   * Muuten sama teksti tuottaisi molemmat: puitesopimuspäätöksessä lukee
   * myös "toimeksiantoon urakoitsija valitaan ... keskuudesta".
   */
  if (found.length === 0) {
    for (const match of text.matchAll(SINGLE_ANCHOR)) {
      const [, inlineVerb, name] = match

      /*
       * Välisanat on jo sallittu kuviossa, joten valintaverbin olemassaolo
       * tarkistetaan tässä: joko heti roolin jälkeen tai sitä edeltävästä
       * ikkunasta. Ilman verbiä rooli on pelkkä maininta, ei päätös.
       */
      if (!inlineVerb) {
        const start = Math.max(0, (match.index ?? 0) - SELECT_WINDOW)
        if (!SELECT_VERB.test(text.slice(start, match.index))) continue
      }

      found.push(name)
    }

    for (const match of text.matchAll(OFFICEHOLDER)) found.push(match[1])

    for (const match of text.matchAll(ABLATIVE)) {
      const start = Math.max(0, (match.index ?? 0) - PURCHASE_WINDOW)
      if (PURCHASE_VERB.test(text.slice(start, match.index))) found.push(match[1])
    }
  }

  /*
   * Sama yritys esiintyy tyypillisesti kahdesti: esittelijän ehdotuksessa ja
   * päätöksessä. Avaimena pienaakkostettu nimi, jotta kirjoitusasun vaihtelu
   * ei tuota kahta riviä.
   */
  const seen = new Map<string, string>()
  for (const raw of found) {
    const name = raw.trim().replace(/\s+/g, " ")
    const key = name.toLowerCase()
    if (!seen.has(key)) seen.set(key, name)
  }
  return [...seen.values()]
}

/*
 * Luettelon poiminta ankkurin jälkeen. Y-tunnus vaaditaan, koska luettelossa
 * se on aina mukana ja ilman sitä poiminta jatkuisi luettelon ohi seuraavaan
 * kappaleeseen.
 */
function collectList(text: string, from: number): string[] {
  const names: string[] = []
  let cursor = from

  NAME_WITH_ID.lastIndex = from
  for (let m = NAME_WITH_ID.exec(text); m; m = NAME_WITH_ID.exec(text)) {
    if ((m.index ?? 0) - cursor > LIST_GAP) break
    cursor = (m.index ?? 0) + m[0].length
    if (REJECTION.test(text.slice(cursor, cursor + REJECTION_WINDOW))) continue
    names.push(m[1])
  }

  return names
}
