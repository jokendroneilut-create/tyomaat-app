import { detectCityFromText } from "@/lib/agent/detectCityFromText"
import { getMunicipalityByName, REGIONS } from "@/lib/geo/municipalities"

/*
 * KUNTA HANKKEEN OMASTA TEKSTISTÄ, KUN LÄHDE EI SITÄ ANNA (D-395).
 *
 * Johannes 8.11.2026 satunnaisotannan osumasta (Merven raiteen
 * ratasuunnitelma): kunta oli tyhjä, vaikka kuvauksen ensimmäinen lause
 * sanoo *"Hattulan kunnan alueella sijaitseva Merven raide…"*. Väylän,
 * Hilman ja STT:n lähteissä ei ole kuntakenttää lainkaan — vain
 * maakunta — joten kunta jää tyhjäksi 98 asiakkaalle näkyvällä
 * hankkeella (mitattu 8.11.2026).
 *
 * TYHJÄ KUNTA EI OLE VAIN PUUTTUVA MERKKIJONO: kunta on suodatin ja
 * haku, joten hanke ei löydy sitä kuntaa selaavalle asiakkaalle.
 *
 * KOORDINAATTI EI KELPAA TÄHÄN, vaikka se olisi houkutteleva.
 * Kuivaharjoitus 98 rivillä: koordinaatti antoi kunnan 83 rivillä,
 * mutta ne ovat maakunta- ja kaupunkikeskipisteitä — 597 hanketta
 * jakaa Helsingin pisteen, 113 Seinäjoen. Kanta-Hämeen keskipiste osuu
 * Hattulaan, joten Riihimäen S-marketista olisi tullut "Hattula".
 * Käänteinen haku kelpaa vasta kun `metadata.geocode_source` kertoo
 * osoitetarkkuudesta — näillä 98:lla se ei kerro yhdelläkään.
 *
 * KOLME SÄÄNTÖÄ, jokainen luettu aineistosta riveittäin:
 *
 *   1. Alueellinen paketti ei ole yksi kunta. "Siltatyöt Kainuussa",
 *      "Päällystystyöt 2026 - Satakunta", "LOU maanteiden
 *      kuivatusurakka" — 25 riviä 98:sta on tällaisia, ja niille
 *      kuntaa EI pidä päätellä.
 *   2. Kaksi kuntaa samassa lauseessa = ei kuntaa. "sillat sijaitsevat
 *      Porin ja Ulvilan kaupunkien alueella", "välille Sunnanvik–
 *      Munkinmäki, Siuntio ja Kirkkonummi".
 *   3. Kuvauksesta kelpaa vain SIJAINTILAUSE. Ilman tätä sääntöä
 *      "Rantarata kulkee Helsingin ja Turun välillä" sijoitti
 *      Karjaa–Kauklahti-hankkeen Helsinkiin, ja "laitureihin
 *      Järvenpään, Saunakallion ja Jokelan asemilla" sijoitti Jokelan
 *      aseman (Tuusula) Järvenpäähän.
 *
 * TUNNETTU RAJOITUS: KAHDEN KOHTEEN OTSIKKO. Fingridin rivi
 * "ASPRI1182 Pyhanselan ja ASPRI1183 Vuolijoen 400 kV laajennukset"
 * kattaa kaksi sahkoasemaa, Muhoksella ja Kajaanissa. Otsikosta
 * loytyy vain Vuolijoki (kuratoitu alias -> Kajaani), joten saanto
 * ehdottaa Kajaania -- puolet oikein. `KAKSI_KOHDETTA` ei osu, koska
 * valissa on tunnus "ASPRI1183". Yrityksia tiukentaa tata kokeiltiin
 * ja ne kaatoivat oikeita osumia ("Riihimaen keskustan S-marketin"),
 * joten rajoitus jaa: UUSI rivi menee katselmointijonoon, jossa
 * ihminen nakee ehdotuksen, ja TAKAUTUVA ajo luetaan riveittain.
 *
 * Ks. [[street-name-is-not-city]], [[mismatched-magnitude]],
 * [[never-hide-on-missing-data]] (tämä ei piilota mitään: tyhjä pysyy
 * tyhjänä, kun todiste ei riitä).
 */

export type KuntaPaattely = { kunta: string; peruste: "nimi" | "kuvaus" }

/*
 * Maakunnan nimi otsikossa: "Siltatyöt Varsinais-Suomessa",
 * "Päällystystyöt Lapissa". Kanta on nimi ilman viimeistä kirjainta,
 * koska maakunta taipuu ("Satakunta" -> "Satakunnassa" ei osu kantaan,
 * mutta "Satakunta" ja "Satakunnan" osuvat riittävän usein; loput
 * jäävät kiinni paketti- ja kaksoiskuntasäännöistä).
 */
const MAAKUNTA_OTSIKOSSA = new RegExp(
  `(${REGIONS.map((r) => r.toLowerCase().replace(/[-\s]/g, "[-\\s]?").replace(/.$/, "")).join("|")})\\w*`,
  "i"
)

/*
 * Hankintapaketin tunnusmerkit. ELY-alueiden lyhenteet (UUD, SIS, LOU,
 * ITA, POP, KAS) ja puitesopimussanat kertovat että kohteita on monta.
 */
const PAKETTI =
  /\b(puitesopimu\w*|puitej[aä]rjestely\w*|vuosisopimu\w*|puiteratkaisu\w*|tietopyynt\w*|ennakkoilmoitu\w*|UUD|SIS|LOU|ITA|POP|KAS|OULA|TAPO)\b/i

/*
 * SUURALUE EI OLE MAAKUNTA. "Putkisiltaurakka 2026 - Itä-Suomi" on
 * alueellinen urakka, mutta Itä-Suomi ei ole maakuntaluettelossa, joten
 * `MAAKUNTA_OTSIKOSSA` ei tunnistanut sitä.
 */
/* Pääte on "Suomi" tai "Suomessa", joten vokaali on [ei] eikä pelkkä e. */
const SUURALUE = /(it[aä]|l[aä]nsi|pohjois|etel[aä]|kaakkois|lounais)[-\s]?suom[ei]\w*/i

/*
 * SIJAINTILAUSE. Nämä verbit ja ilmaukset kertovat että kunta on
 * hankkeen sijainti eikä mainittu muussa roolissa (rata kulkee,
 * asemalista, yrityksen nimi).
 */
const SIJAINTILAUSE =
  /(sijaitse\w*|sijoittu\w*|paranne\w*|paransi|parannet\w*|rakennet\w*|rakennetaan|laadi\w*|laati\w*|kunnan\s+alueella|kaupungin\s+alueella|kunnan\s+kanssa|kaupungin\s+kanssa|kohdalla)/i

/*
 * Kaksi isolla alkavaa genetiiviä "ja"-sanan ympärillä on KOHDELISTA,
 * ei kunta: "Pyhänselän ja Vuolijoen 400 kV laajennukset" (Muhos JA
 * Kajaani), "Koiviston ja Pikkuhaaran sillat". Jos molemmat osoittavat
 * samaan kuntaan, nimiosuma kelpaa yhä.
 */
const KAKSI_KOHDETTA =
  /(?:^|\s)([A-ZÄÖÅ][\wäöåÄÖÅ-]+n)\s+ja\s+([A-ZÄÖÅ][\wäöåÄÖÅ-]+n)\b/

export function onAlueellinenPaketti(otsikko: string | null | undefined): boolean {
  const t = String(otsikko ?? "")
  if (!t.trim()) return false
  return MAAKUNTA_OTSIKOSSA.test(t) || PAKETTI.test(t) || SUURALUE.test(t)
}

/*
 * Kaikki eri kunnat tekstistä. `detectCityFromText` palauttaa vain
 * ensimmäisen osuman, joten löydetty nimi häivytetään ja haku
 * toistetaan. Kolme kierrosta riittää: sääntö hylkää jo kahdella.
 */
export function kunnatTekstista(teksti: string | null | undefined): string[] {
  let jaljella = String(teksti ?? "")
  const kunnat: string[] = []
  for (let kierros = 0; kierros < 3 && jaljella.trim(); kierros += 1) {
    const osuma = detectCityFromText(jaljella)
    if (!osuma) break
    if (!kunnat.includes(osuma)) kunnat.push(osuma)
    /*
     * Häivytys kannan perusteella (nimi ilman viimeistä kirjainta),
     * jotta myös taivutetut muodot katoavat: "Porin" ja "Poriin".
     */
    const kanta = osuma.slice(0, -1)
    const ennen = jaljella
    jaljella = jaljella.replace(new RegExp(kanta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ")
    if (jaljella === ennen) break
  }
  return kunnat
}

export function kuntaHankkeesta(hanke: {
  name?: string | null
  description?: string | null
  region?: string | null
}): KuntaPaattely | null {
  const nimi = String(hanke.name ?? "")
  const kuvaus = String(hanke.description ?? "")
  if (onAlueellinenPaketti(nimi)) return null

  const tasmaaMaakuntaan = (kunta: string) => {
    if (!hanke.region) return true
    const mk = getMunicipalityByName(kunta)?.region
    return !mk || mk === hanke.region
  }

  /* 1. Nimi. Vahvin todiste: hankkeen oma otsikko. */
  const nimenKunnat = kunnatTekstista(nimi)
  const kohdelista = KAKSI_KOHDETTA.exec(nimi)
  const kohdelistaEriKuntia = Boolean(
    kohdelista && kunnatTekstista(`${kohdelista[1]} ${kohdelista[2]}`).length !== 1
  )
  if (nimenKunnat.length === 1 && !kohdelistaEriKuntia && tasmaaMaakuntaan(nimenKunnat[0])) {
    return { kunta: nimenKunnat[0], peruste: "nimi" }
  }

  /*
   * 2. Kuvauksen alku VIRKE KERRALLAAN, ei yhtenä ikkunana.
   *
   * Ikkuna oli ensin kaksi ensimmäistä virkettä yhdessä, ja se hävitti
   * juuri sen rivin josta työ alkoi: Merven raiteen ensimmäinen virke
   * sanoo *"Hattulan kunnan alueella sijaitseva Merven raide…"*, mutta
   * toinen virke jatkaa *"Raide erkanee Helsinki Tampere pääradalla…"* —
   * kolme kuntaa samassa ikkunassa, eli sääntö hylkäsi oman
   * esimerkkinsä. Yhden virkkeen ikkuna taas hävitti Jyväskylän, jonka
   * sijaintilause on vasta toisessa virkkeessä.
   *
   * Siksi: käydään kolme ensimmäistä virkettä läpi ja otetaan
   * ENSIMMÄINEN, joka on sijaintilause ja jossa on tasan yksi kunta.
   */
  const virkkeet = kuvaus.split(/(?<=[.!?])\s+/).slice(0, 3)
  for (const virke of virkkeet) {
    if (!SIJAINTILAUSE.test(virke)) continue
    const kunnat = kunnatTekstista(virke)
    if (kunnat.length !== 1) continue
    if (!tasmaaMaakuntaan(kunnat[0])) continue
    return { kunta: kunnat[0], peruste: "kuvaus" }
  }
  return null
}
