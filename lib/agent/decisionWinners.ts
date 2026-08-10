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
 * LUETTELO ILMAN Y-TUNNUKSIA, rooli ennen verbiä.
 *
 *   "…puitejärjestelysopimuskumppaneiksi valitaan: Koneurakointi
 *    M. Niiranen Oy, Oteran Oy, Maansiirto Eero Huttunen Oy,
 *    Koneurakointi Jarkko Kosunen ja KoneNeliö Oy."
 *
 * Kolme syytä miksi aiemmat kuviot eivät osuneet: rooli on ennen verbiä,
 * verbin perässä on kaksoispiste, eikä yhdelläkään yrityksellä ole
 * y-tunnusta - eikä yhdellä ole edes yhtiömuotoa ("Koneurakointi Jarkko
 * Kosunen").
 *
 * "Tarjoajiksi" ja "ehdokkaiksi" EIVÄT ole tässä roolistossa: ne nimeävät
 * kilpailuun päässeet, eivät valittuja.
 */
const INLINE_LIST_ANCHOR = new RegExp(
  `${NAME_CHAR}*(?:kumppaneiksi|urakoitsijoiksi|toimittajiksi|palveluntuottajiksi)` +
    `\\s+(?:valit|hyväks)${FI_WORD}+\\s*:?\\s*`,
  "gi"
)

/*
 * Virkkeen loppu. Piste EI kelpaa lopuksi jos sitä edeltää yksi iso
 * kirjain: se on nimen alkukirjain ("Koneurakointi M. Niiranen Oy"), ja
 * siihen katkaistuna luettelo jäisi kesken.
 */
const SENTENCE_END = /(?<![A-ZÅÄÖ])\.(?=\s|$)/

/*
 * Luettelon erotin: pilkku tai "ja". Molemmat esiintyvät samassa
 * luettelossa, viimeinen jäsen on tyypillisesti ja-sanan takana.
 */
const LIST_SEPARATOR = /\s*,\s*|\s+ja\s+/

/*
 * Kelpaako pala yrityksen nimeksi? Jokaisen sanan on alettava isolla tai
 * oltava numero - näin perustelulause ("hinnaltaan halvimman tarjouksen
 * jättänyt…") ei kelpaa, vaikka se sattuisi olemaan pilkkujen välissä.
 */
const NAME_LIKE = new RegExp(
  `^[A-ZÅÄÖ]${NAME_CHAR}*(?:\\s+(?:[A-ZÅÄÖ0-9&]${NAME_CHAR}*|ja))*$`
)
const MAX_NAME_WORDS = 5

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
  /*
   * "…valitsee urakan toteuttajaksi VM-Suomalainen Oy:n". Sama rooli kuin
   * urakoitsija, eri sana. Mitattu: yksi rivi jäi kokonaan ilman voittajaa.
   *
   * Roolistoon EI oteta "valvojaksi": valvoja on rakennuttajan konsultti,
   * ei urakoitsija, ja yhden voittajan sääntö veisi sen builder-kenttään
   * hankkeen rakentajaksi.
   */
  `${NAME_CHAR}*[Tt]oteuttajaksi`,
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
/*
 * Raja nostettiin viidestä kahdeksaan mitatun rivin perusteella:
 *
 *   "urakoitsijaksi kelpoisuusehdot täyttävien tarjousten joukosta
 *    suurimmat kokonaispisteet saaneen Louhintahiekka Oy:n"
 *
 * Välissä on seitsemän sanaa, eli viiden raja katkaisi juuri ennen nimeä.
 * Väärentymisriski pysyy pienenä, koska välisanat saavat alkaa vain
 * pienellä: kuvio ei voi ohittaa yritysnimeä matkalla.
 */
/*
 * Välisanaksi kelpaa myös LUKU ja SULKULAUSE. Pelkkä pienellä alkava sana
 * ei riitä: LLM-kartoitus paljasti kaksi riviä joilla tuttu muoto katkesi
 * keskeytykseen.
 *
 *   "…suurimmat kokonaispisteet saaneen (95,25 pistettä) Recset Oy"
 *   "…toimittajaksi tammikuussa 2023 järjestetyn kilpailutuksen voittajan"
 *
 * Isolla alkava sana ei edelleenkään kelpaa väliin, joten kuvio ei voi
 * ohittaa yritysnimeä matkalla - se on koko rajauksen ydin.
 */
const FILLER_TOKEN = `(?:[a-zåäö]${FI_WORD}*|\\d[\\d.,]*|\\([^)]{0,40}\\))`
const FILLER = `(?:${FILLER_TOKEN}\\s+){0,8}`

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
/*
 * NIMI ENNEN ROOLIA. Kymmenes muoto, sanajärjestys käännettynä:
 *
 *   "…päättää hyväksyä Louhintahiekka Oy:n urakoitsijaksi hankkeeseen"
 *   "SRV Rakennus Oy on valittu päätoteuttajaksi teknisen johtajan
 *    päätöksellä"
 *
 * Kaikki aiemmat muodot olettivat roolin tulevan ensin. Väli on lyhyt
 * (enintään kolme pientä sanaa), koska pidempi väli sallisi kuvion
 * poimia tarjoajaluettelosta nimen, jota seuraa roolisana vasta
 * seuraavassa virkkeessä.
 */
const NAME_BEFORE_ROLE = new RegExp(
  `(${NAME})(?::n)?\\s+((?:${FILLER_TOKEN}\\s+){0,3})(?:${SINGLE_ROLES})${FI_BOUNDARY}`,
  "g"
)

/*
 * PARTISIIPPI + GENETIIVIOBJEKTI. Kahdeksas lausemuoto, eikä siinä ole
 * roolisanaa lainkaan:
 *
 *   "valita tarjouskilpailussa kokonaistaloudellisesti edullisimman
 *    tarjouksen TEHNEEN Lakeuden Maanrakennus Oy:N"
 *
 * Valinnan kohde on genetiivissä ja sitä edeltää partisiippi, joka viittaa
 * tarjouksen jättämiseen. Ankkurina on partisiippi, koska pelkkä
 * genetiivimuotoinen yritysnimi esiintyy tekstissä jatkuvasti muissakin
 * yhteyksissä ("X Oy:n tarjous hylätään").
 *
 * Vaaditaan lisäksi valintaverbi edeltä: ilman sitä myös hylkäyslause
 * "hylätään tarjouksen tehneen X Oy:n tarjous" kelpaisi.
 */
const OFFER_PARTICIPLE = /tehneen|antaneen|jättäneen|saaneen/
const PARTICIPLE_OBJECT = new RegExp(
  `(?:${OFFER_PARTICIPLE.source})\\s+(${NAME})\\s*:n${FI_BOUNDARY}`,
  "g"
)

/*
 * ALLATIIVI: työ annetaan yritykselle. Ablatiivin peilikuva.
 *
 *   "…suunnittelu annetaan tarjouskilpailun mukaisesti
 *    kokonaistaloudellisesti edullisimman tarjouksen jättäneelle
 *    Insinööritoimisto Lepistö Oy:lle hintaan 164 900,00 euroa"
 *
 * SÄÄNTÖ ON TARKOITUKSELLA KAPEA. "Oy:lle" esiintyy aineistossa 50 kertaa,
 * mutta lähes aina muussa kuin voittajan roolissa: tiloja vuokrataan,
 * kustannuksia korvataan, tontteja varataan. Ainoa aito luovutusverbi on
 * "annetaan" (2 osumaa, molemmat samalta riviltä).
 *
 * Kilpailutuskonteksti vaaditaan lisäksi, jottei "annetaan lausunto
 * X Oy:lle" kelpaa.
 */
const ALLATIVE = new RegExp(`(${NAME})\\s*:lle${FI_BOUNDARY}`, "g")
const AWARD_GIVE_VERB = /\bannet[at]\w*/i
const AWARD_CONTEXT = /tarjous|tarjouskilpailu|urak|hankinta|kilpailut/i
const GIVE_WINDOW = 260

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

/*
 * PURETTU URAKKASOPIMUS KUMOAA VOITTAJAN.
 *
 * Osa päätöksistä kertaa hankkeen historian, ja siihen sisältyy
 * kielellisesti moitteeton valintalause yrityksestä joka EI enää ole
 * urakoitsija:
 *
 *   "Tärkeät Tekijät Oy valittiin kokonaisurakoitsijaksi …
 *    Helsingin kaupunki purki 18.11.2022 urakkasopimuksen …
 *    tilaaja valitsi Stara Rakennustekniikan uudeksi …"
 *
 * Poiminta on tällöin oikein mutta tieto vanhentunut, ja väärä urakoitsija
 * on huonompi kuin tyhjä kenttä. Uusi urakoitsija jää poimimatta, koska
 * sitä ei nimetä päätöslauseessa vaan selostuksessa.
 *
 * Välissä saa olla pisteitä: purkupäivä on tyypillisesti juuri siinä
 * ("purki 18.11.2022 urakkasopimuksen"), ja pisteettömäksi rajattu kuvio
 * osui vain toiseen kahdesta rivistä.
 */
const CONTRACT_TERMINATED =
  /purki\s+.{0,40}?urakkasopimu|urakkasopimu\w*\s+purettiin|sopimus\s+purettiin|purkanut\s+urakkasopimu/i

export function extractDecisionWinners(description: string | null | undefined): string[] {
  if (!description) return []
  if (CONTRACT_TERMINATED.test(description)) return []

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
   * Y-tunnukseton luettelo. Vaaditaan VÄHINTÄÄN KAKSI kelvollista nimeä:
   * yhden nimen tapauksessa yksittäisvoittajan kuvio on tarkempi, koska se
   * osaa ohittaa perustelusanat ("valitaan hinnaltaan halvimman tarjouksen
   * jättänyt X Oy"), joita pilkkujako ei erota.
   */
  if (found.length === 0) {
    for (const anchor of text.matchAll(INLINE_LIST_ANCHOR)) {
      const names = collectInlineList(text, (anchor.index ?? 0) + anchor[0].length)
      if (names.length >= 2) found.push(...names)
    }
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

    for (const match of text.matchAll(NAME_BEFORE_ROLE)) {
      const start = Math.max(0, (match.index ?? 0) - SELECT_WINDOW)
      /*
       * Valintaverbi saa olla joko nimen EDELLÄ ("hyväksyä X Oy:n
       * urakoitsijaksi") tai nimen ja roolin VÄLISSÄ ("X Oy on valittu
       * päätoteuttajaksi"), joten molemmat katsotaan.
       */
      const before = text.slice(start, match.index) + match[2]
      if (SELECT_VERB.test(before)) found.push(match[1])
    }

    for (const match of text.matchAll(PARTICIPLE_OBJECT)) {
      const start = Math.max(0, (match.index ?? 0) - SELECT_WINDOW)
      const before = text.slice(start, match.index)
      /*
       * Valintaverbi vaaditaan: partisiippi yksin esiintyy myös
       * hylkäyslauseessa ("hylätään tarjouksen tehneen X Oy:n tarjous").
       */
      if (SELECT_VERB.test(before)) found.push(match[1])
    }

    for (const match of text.matchAll(ALLATIVE)) {
      const start = Math.max(0, (match.index ?? 0) - GIVE_WINDOW)
      const before = text.slice(start, match.index)
      /*
       * Molemmat vaaditaan: luovutusverbi yksin osuisi myös lausunnon
       * antamiseen, ja kilpailutussana yksin vuokraukseen samassa
       * päätöksessä.
       */
      if (AWARD_GIVE_VERB.test(before) && AWARD_CONTEXT.test(before)) {
        found.push(match[1])
      }
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
/*
 * Luettelon poiminta ankkurin jälkeen kun y-tunnuksia ei ole. Rajataan
 * virkkeeseen ja pilkotaan erottimista; jokainen pala tarkistetaan
 * erikseen, jottei perustelulause pääse mukaan.
 */
function collectInlineList(text: string, from: number): string[] {
  const rest = text.slice(from)
  const end = rest.search(SENTENCE_END)
  const segment = (end >= 0 ? rest.slice(0, end) : rest).trim()

  /* Ilman rajaa kuvio söisi koko loppudokumentin jos pistettä ei löydy. */
  if (!segment || segment.length > 400) return []

  const names: string[] = []

  for (const raw of segment.split(LIST_SEPARATOR)) {
    const part = raw.trim().replace(/[.,;:]+$/, "")
    if (!part) continue
    if (part.split(/\s+/).length > MAX_NAME_WORDS) return names
    if (!NAME_LIKE.test(part)) return names
    if (REJECTION.test(part)) continue
    names.push(part)
  }

  return names
}

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
