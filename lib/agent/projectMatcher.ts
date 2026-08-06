import {
  normalizeAddress as norm,
  normalizeIdentifierValue as normalizeIdentifier,
} from "@/lib/projects/identity"
import { getMunicipalityByAnyForm } from "@/lib/geo/municipalityFromName"
import { isSameOrganization } from "@/lib/projects/organizationName"

export type NormalizedProjectCandidate = {
  name?: string | null
  // Lähteen alkuperäinen otsikko ennen mahdollista käsin muokkausta.
  // Vertaillaan nimen ohella, jotta editoitu otsikko ei katkaise
  // duplikaattilöydettävyyttä.
  sourceTitle?: string | null
  city?: string | null
  region?: string | null
  location?: string | null
  permitNumber?: string | null
  propertyId?: string | null
  developer?: string | null
  buildingType?: string | null
  description?: string | null
}

export type MatchableProject = {
  id: string
  name: string | null
  city: string | null
  region: string | null
  location: string | null
  phase: string | null
  completed_at?: string | null
  status?: string | null
  developer?: string | null
  property_type?: string | null
  estimated_completion?: string | null
  additional_info?: string | null

  metadata?: {
    permit_number?: string | null
    property_id?: string | null
    developer?: string | null
    building_type?: string | null
    [key: string]: unknown
  } | null
}

/*
 * Onko sijainti katuosoitteen tarkkuudella vai pelkkä paikkakunta?
 *
 * Katuosoitteessa on lähes aina talonumero, joten numero riittää yksin
 * osoittamaan tarkkuuden. Ilman numeroa kelpuutetaan vain sellainen teksti
 * joka ei ole pelkkä kunnan nimi eikä sama kuin hankkeen oma kaupunki -
 * esimerkiksi kaupunginosa tai kohteen nimi käy, "Kouvola" ei.
 */
export function isSpecificLocation(
  location: string | null | undefined,
  city: string | null | undefined
): boolean {
  const normalized = norm(location)
  if (!normalized) return false

  if (/\d/.test(normalized)) return true

  if (city && normalized === norm(city)) return false

  if (getMunicipalityByAnyForm(location)) return false

  return true
}

export type ProjectMatchReason =
  | "same_permit_number"
  | "same_property_id"
  | "same_location"
  | "same_city"
  | "same_region"
  | "exact_title"
  | "exact_distinctive_title"
  | "similar_title"
  | "similar_description"
  | "name_in_description"
  | "same_developer"
  | "same_building_type"

export type ProjectMatchResult = {
  project: MatchableProject
  confidence: number
  reasons: ProjectMatchReason[]
}

const GENERIC_TITLE_WORDS = new Set([
  "hanke",
  "rakennushanke",
  "rakentaminen",
  "rakennus",
  "rakennustyöt",
  "urakka",
  "kokonaisurakka",
  "kvr",
  "työt",
  "uusi",
  "uusien",
  "peruskorjaus",
  "saneeraus",
  "korjaus",
  "laajennus",
  "kilpailutus",
  "tarjouspyyntö",
  "jälki",
  "ilmoitus",
  "jälkiilmoitus",
])


function titleWords(value: string | null | undefined) {
  return (norm(value) ?? "")
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .filter((word) => !GENERIC_TITLE_WORDS.has(word))
}

function titleSimilarity(
  first: string | null | undefined,
  second: string | null | undefined
) {
  const firstNormalized = norm(first)
  const secondNormalized = norm(second)

  if (!firstNormalized || !secondNormalized) {
    return 0
  }

  if (firstNormalized === secondNormalized) {
    return 1
  }

  const firstWords = new Set(titleWords(first))
  const secondWords = new Set(titleWords(second))

  if (!firstWords.size || !secondWords.size) {
    return 0
  }

  let sharedCount = 0

  for (const word of firstWords) {
    if (secondWords.has(word)) {
      sharedCount += 1
    }
  }

  const unionSize = new Set([
    ...firstWords,
    ...secondWords,
  ]).size

  return unionSize > 0 ? sharedCount / unionSize : 0
}

/*
 * Kuvaustekstien deterministinen samankaltaisuus MERKKI-TRIGRAMMEILLA (per sana,
 * ei sanarajan yli). Trigrammit kestävät suomen taivutuksen — esim.
 * "ratasmäkeen" ja "ratasmäen" jakavat suurimman osan trigrammeistaan, kun taas
 * pelkkä sanajoukko-vertailu pitäisi ne eri sanoina. Nappaa saman hankkeen eri
 * signaaleista kun kuvaukset jakavat paikannimiä, rakennuttajan ja kohdetiedot
 * — vaikka nimi/otsikko eroaisi (esim. valmistumisuutinen vs. alkuperäinen
 * kuvaus). Ei semanttinen; täysin eri sanoin kirjoitetut jäävät kiinni
 * ottamatta (siihen tarvittaisiin embeddings).
 */
function textTrigrams(text: string | null | undefined): Set<string> {
  const grams = new Set<string>()
  if (!text) return grams
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-zåäö0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  for (const word of cleaned.split(" ")) {
    if (word.length < 3) continue
    for (let i = 0; i <= word.length - 3; i++) {
      grams.add(word.slice(i, i + 3))
    }
  }
  return grams
}

function descriptionSimilarity(
  first: string | null | undefined,
  second: string | null | undefined
) {
  const a = textTrigrams(first)
  const b = textTrigrams(second)

  // Liian lyhyet kuvaukset eivät anna luotettavaa signaalia.
  if (a.size < 10 || b.size < 10) return 0

  let sharedCount = 0
  for (const gram of a) {
    if (b.has(gram)) sharedCount += 1
  }

  const unionSize = new Set([...a, ...b]).size
  return unionSize > 0 ? sharedCount / unionSize : 0
}

/*
 * Osuuko toisen puolen NIMI toisen puolen KUVAUKSEEN?
 *
 * descriptionSimilarity vertaa kuvausta kuvaukseen, joten se ei auta kun
 * toisella puolella on kuvaus ja toisella vain nimi. Mitattu tapaus: ehdokkaan
 * kuvaus "...rakennetaan tilat lastenpsykiatrialle ja sairaalakoululle" ja
 * hankkeen nimi "L-rakennus lastenpsykiatrialle ja sairaalakoululle Oulun
 * sairaala-alueella" — ihminen näkee osuman heti, mutta hankkeella ei ollut
 * kuvausta lainkaan, joten mikään tekstivertailu ei voinut osua.
 *
 * Mitta on SISÄLTYVYYS eikä Jaccard: pitkä kuvaus laimentaisi Jaccardin
 * lähelle nollaa, vaikka nimi olisi kokonaan sen sisällä. Kysymys on
 * "onko nimi tekstissä", ei "ovatko tekstit samanpituisia".
 *
 * Geneeriset sanat pudotetaan (titleWords), jottei "rakentaminen" tai
 * "peruskorjaus" tuota osumaa mihin tahansa kuvaukseen.
 */
const NAME_IN_TEXT_THRESHOLD = 0.7
const NAME_IN_TEXT_MIN_WORDS = 2

function nameWithinText(
  name: string | null | undefined,
  text: string | null | undefined
): boolean {
  const distinctiveWords = titleWords(name)
  if (distinctiveWords.length < NAME_IN_TEXT_MIN_WORDS) return false

  const textWords = new Set(
    (norm(text) ?? "").split(" ").filter((word) => word.length >= 4)
  )
  if (textWords.size < 5) return false

  /*
   * Vertailu KOKONAISINA SANOINA eikä trigrammeina. Trigrammeilla mitattuna
   * suomen yhdyssanat vuotavat toisiinsa: "tuulivoimahanke" sisältyy lähes
   * kokonaan tekstiin jossa lukee "tuulivoimapuisto", jolloin eri hankkeet
   * osuivat toisiinsa. Mitattuna 37 osumasta selvästi yli puolet oli vääriä
   * (esim. "Kotaselän tuulivoimahanke" -> "Asemakeskus").
   *
   * Taivutus sallitaan vain vartalon alusta: sana kelpaa jos jokin tekstin
   * sana alkaa sillä tai se alkaa tekstin sanalla, vähintään 6 merkin
   * yhteisellä alulla.
   */
  let foundCount = 0
  for (const word of distinctiveWords) {
    const found = [...textWords].some(
      (textWord) =>
        textWord === word ||
        (word.length >= 6 && textWord.startsWith(word.slice(0, 6)) && word.startsWith(textWord.slice(0, 6)))
    )
    if (found) foundCount += 1
  }

  return foundCount / distinctiveWords.length >= NAME_IN_TEXT_THRESHOLD
}

function getProjectDescription(project: MatchableProject) {
  return (
    project.additional_info ??
    (project.metadata?.description as string | null | undefined) ??
    null
  )
}

function getProjectPermitNumber(project: MatchableProject) {
  return (
    project.metadata?.permit_number ??
    null
  )
}

function getProjectPropertyId(project: MatchableProject) {
  return (
    project.metadata?.property_id ??
    null
  )
}

function getProjectDeveloper(project: MatchableProject) {
  return (
    project.developer ??
    project.metadata?.developer ??
    null
  )
}

function getProjectBuildingType(project: MatchableProject) {
  return (
    project.property_type ??
    project.metadata?.building_type ??
    null
  )
}

/*
 * Hankkeen kaikki tunnetut otsikkomuunnelmat, joita vasten ehdokkaan
 * otsikko(t) vertaillaan: näkyvä nimi, lähteen alkuperäinen otsikko
 * (metadata.source_title, säilytetään kun otsikkoa muokataan käsin) ja
 * aiemmista yhdistetyistä lähteistä kertyneet aliakset (also_known_as).
 * Näin käsin muokattu otsikko ei estä saman hankkeen tunnistamista.
 */
function getProjectTitles(
  project: MatchableProject
): (string | null | undefined)[] {
  const aka = project.metadata?.also_known_as
  return [
    project.name,
    project.metadata?.source_title as string | null | undefined,
    ...(Array.isArray(aka) ? (aka as string[]) : []),
  ]
}

export function calculateMatch(
  project: MatchableProject,
  candidate: NormalizedProjectCandidate
): ProjectMatchResult | null {
  const reasons: ProjectMatchReason[] = []
  let confidence = 0

  const candidatePermitNumber = normalizeIdentifier(
    candidate.permitNumber
  )

  const projectPermitNumber = normalizeIdentifier(
    getProjectPermitNumber(project)
  )

  if (
    candidatePermitNumber &&
    projectPermitNumber &&
    candidatePermitNumber === projectPermitNumber
  ) {
    confidence += 100
    reasons.push("same_permit_number")
  }

  const candidatePropertyId = normalizeIdentifier(
    candidate.propertyId
  )

  const projectPropertyId = normalizeIdentifier(
    getProjectPropertyId(project)
  )

  if (
    candidatePropertyId &&
    projectPropertyId &&
    candidatePropertyId === projectPropertyId
  ) {
    confidence += 100
    reasons.push("same_property_id")
  }

  // Vertaillaan ehdokkaan otsikkomuunnelmia (näkyvä nimi + lähteen
  // alkuperäinen otsikko) hankkeen kaikkia otsikkomuunnelmia vasten ja
  // otetaan paras osuma. Näin käsin muokattu otsikko ei katkaise
  // duplikaattilöydettävyyttä.
  const candidateTitles = [candidate.name, candidate.sourceTitle]
  const projectTitles = getProjectTitles(project)

  /*
   * Osuneen otsikon pituus talteen, koska pisteytys riippuu siitä onko
   * otsikko erottuva (ks. alla).
   */
  let exactTitleLength = 0

  const hasExactTitle = candidateTitles.some((candidateTitle) => {
    const normalizedCandidate = norm(candidateTitle)
    if (!normalizedCandidate) return false

    const hit = projectTitles.some(
      (projectTitle) => normalizedCandidate === norm(projectTitle)
    )

    if (hit) exactTitleLength = Math.max(exactTitleLength, normalizedCandidate.length)

    return hit
  })

  if (hasExactTitle) {
    /*
     * Merkki merkiltä sama pitkä otsikko riittää yksin tunnistamaan hankkeen.
     * Aiemmin exact_title antoi 55 pistettä, mikä jäi alle 70:n kynnyksen -
     * eli kandidaatti jolla on VAIN otsikko ei voinut koskaan täsmätä, vaikka
     * nimi olisi identtinen. Se on tavallista yritysten lehdistötiedotteissa,
     * joissa kaupunkia tai rakennuttajaa ei ole eritelty, ja johti siihen että
     * jo tunnetusta hankkeesta kertova uutinen päätyi uutena ehdokkaana jonoon.
     *
     * Pituusehto on tarpeen, koska aineistossa on geneerisiä otsikoita
     * ("Mastojen rakentaminen", "Puitesopimushankinta sopimuskaudella
     * 5/2026-5/2027") joissa identtinen nimi EI todista samaa hanketta.
     * Lyhyet otsikot pitävät siis vanhan 55 pisteen painon ja tarvitsevat
     * edelleen tuekseen kaupungin, osoitteen tai rakennuttajan.
     */
    const distinctive = exactTitleLength >= 25

    confidence += distinctive ? 75 : 55
    reasons.push(distinctive ? "exact_distinctive_title" : "exact_title")
  } else {
    let similarity = 0
    for (const candidateTitle of candidateTitles) {
      for (const projectTitle of projectTitles) {
        const score = titleSimilarity(candidateTitle, projectTitle)
        if (score > similarity) similarity = score
      }
    }

    if (similarity >= 0.75) {
      confidence += 40
      reasons.push("similar_title")
    } else if (similarity >= 0.5) {
      confidence += 25
      reasons.push("similar_title")
    } else if (similarity >= 0.3) {
      confidence += 12
      reasons.push("similar_title")
    }
  }

  const candidateLocation = norm(candidate.location)
  const projectLocation = norm(project.location)

  /*
   * same_location on tarkoitettu todisteeksi SAMASTA KATUOSOITTEESTA, ja
   * +45 pistettä riittää lähes yksin osumaan. Osoitekenttään päätyy kuitenkin
   * usein pelkkä kunnan nimi - joko lähteestä tai käsin täydennettäessä - ja
   * silloin kaksi saman kaupungin täysin eri hanketta näyttivät osuvan
   * toisiinsa.
   *
   * Mitattu tapaus: datakeskusuutinen jonka osoitteeksi oli merkitty
   * "Kouvola" sai 73 pistettä asuinkerrostalohankkeesta samassa kaupungissa
   * (same_location + same_city + same_region), eli olisi yhdistynyt siihen.
   * Käsin lisätty OIKEA tieto siis huononsi tulosta - juuri päinvastoin kuin
   * pitäisi.
   *
   * Kaupunkitason sijainti ei siksi kelpaa vahvaksi todisteeksi. same_city
   * kattaa sen jo omalla painollaan, joten pisteitä ei anneta kahdesti.
   */
  const bothLocationsSpecific =
    isSpecificLocation(candidate.location, candidate.city) &&
    isSpecificLocation(project.location, project.city)

  if (
    candidateLocation &&
    projectLocation &&
    candidateLocation === projectLocation &&
    bothLocationsSpecific
  ) {
    confidence += 45
    reasons.push("same_location")
  }

  const candidateCity = norm(candidate.city)
  const projectCity = norm(project.city)

  if (
    candidateCity &&
    projectCity &&
    candidateCity === projectCity
  ) {
    confidence += 20
    reasons.push("same_city")
  }

  const candidateRegion = norm(candidate.region)
  const projectRegion = norm(project.region)

  if (
    candidateRegion &&
    projectRegion &&
    candidateRegion === projectRegion
  ) {
    confidence += 8
    reasons.push("same_region")
  }

  /*
   * Rakennuttajaa verrataan organisaationimenä eikä merkkijonona: sama
   * toimija kirjoitetaan lähteissä eri tavoin (genetiivi, sulkeissa oleva
   * lyhenne, yhtiömuoto, y-tunnus). Mitattu tapaus: "Pohjois-Pohjanmaan
   * hyvinvointialue Pohde" ja "Pohjois-Pohjanmaan hyvinvointialueen (Pohde)"
   * jäivät eri toimijoiksi, jolloin rakennuttaja+kaupunki -todiste ei
   * täyttynyt eikä koko täsmäytys palauttanut mitään.
   */
  if (
    isSameOrganization(
      candidate.developer,
      getProjectDeveloper(project)
    )
  ) {
    confidence += 20
    reasons.push("same_developer")
  }

  const candidateBuildingType = norm(
    candidate.buildingType
  )

  const projectBuildingType = norm(
    getProjectBuildingType(project)
  )

  if (
    candidateBuildingType &&
    projectBuildingType &&
    candidateBuildingType === projectBuildingType
  ) {
    confidence += 8
    reasons.push("same_building_type")
  }

  const descriptionSim = descriptionSimilarity(
    candidate.description,
    getProjectDescription(project)
  )

  if (descriptionSim >= 0.5) {
    confidence += 30
    reasons.push("similar_description")
  } else if (descriptionSim >= 0.3) {
    confidence += 18
    reasons.push("similar_description")
  }

  /*
   * Nimi toisen puolen kuvauksessa. Tarkistetaan molempiin suuntiin, koska
   * kumman tahansa puolen kuvaus voi puuttua: uutislähteellä on usein kuvaus
   * mutta geneerinen otsikko, kilpailutuslähteellä täsmällinen nimi mutta ei
   * kuvausta.
   *
   * Ei anneta pisteitä kahdesti, jos kuvausvertailu osui jo.
   */
  if (
    !reasons.includes("similar_description") &&
    (nameWithinText(project.name, candidate.description) ||
      nameWithinText(candidate.name, getProjectDescription(project)))
  ) {
    confidence += 30
    reasons.push("name_in_description")
  }

  /*
   * Pelkkä sama maakunta ei riitä osumaksi.
   * Myöskään pelkkä sama kaupunki ei saa yhdistää hankkeita.
   */
  const hasStrongIdentifier =
    reasons.includes("same_permit_number") ||
    reasons.includes("same_property_id")

  const hasStrongLocation =
    reasons.includes("same_location")

  const hasTextEvidence =
    reasons.includes("exact_title") ||
    reasons.includes("exact_distinctive_title") ||
    reasons.includes("similar_title") ||
    reasons.includes("similar_description") ||
    reasons.includes("name_in_description")

  /*
   * Sama rakennuttaja samassa kaupungissa on todiste vaikka nimet eivät
   * muistuttaisi toisiaan: uutisotsikko ("Bravida nappasi 200 miljoonan
   * datakeskusurakan") ei koskaan muistuta hankkeen nimeä ("FIN04A
   * Datakeskus"), mutta AtNorth + Kouvola kertoo silti että kyse voi olla
   * samasta kohteesta.
   *
   * Pisteitä tämä ei lisää - yhdistelmä jää 48:aan eli selvästi alle 70:n
   * kynnyksen, joten automaattista yhdistämistä ei tapahdu. Se riittää
   * kuitenkin nostamaan osuman esiin mahdollisena duplikaattina (>= 40),
   * jolloin ihminen näkee sen hyväksynnän yhteydessä. Ilman tätä käsin
   * täydennetty oikea tieto ei tuottanut mitään.
   *
   * Pelkkä sama rakennuttaja ei riitä: iso urakoitsija rakentaa ympäri maata.
   */
  const hasDeveloperAndCity =
    reasons.includes("same_developer") && reasons.includes("same_city")

  if (
    !hasStrongIdentifier &&
    !hasStrongLocation &&
    !hasTextEvidence &&
    !hasDeveloperAndCity
  ) {
    return null
  }

  /*
   * Jos todiste on vain heikosti samankaltainen nimi/kuvaus, tarvitaan
   * lisäksi sama sijainti, kaupunki tai rakennuttaja — muuten pelkkä
   * geneerinen tekstiosuma yhdistäisi eri hankkeita.
   */
  const onlyWeakText =
    (reasons.includes("similar_title") ||
      reasons.includes("similar_description") ||
      reasons.includes("name_in_description")) &&
    !reasons.includes("exact_title") &&
    !reasons.includes("exact_distinctive_title")

  if (
    onlyWeakText &&
    confidence < 45 &&
    !reasons.includes("same_city") &&
    !reasons.includes("same_location") &&
    !reasons.includes("same_developer")
  ) {
    return null
  }

  return {
    project,
    confidence: Math.min(confidence, 100),
    reasons,
  }
}

export function findProjectMatchDetailed(
  existingProjects: MatchableProject[],
  candidate: NormalizedProjectCandidate
): ProjectMatchResult | null {
  if (!norm(candidate.name) &&
      !candidate.permitNumber &&
      !candidate.propertyId) {
    return null
  }

  const matches = existingProjects
    .map((project) =>
      calculateMatch(project, candidate)
    )
    .filter(
      (
        match
      ): match is ProjectMatchResult =>
        match !== null
    )
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence
      }

      return b.reasons.length - a.reasons.length
    })

  const best = matches[0]
  if (!best) return null

  /*
   * Pitkä identtinen otsikko riittää yksin osumaksi (exact_distinctive_title),
   * mutta vain jos se osoittaa YHTEEN hankkeeseen. Aineistossa on eri
   * hankkeita samalla nimellä - esimerkiksi useita rivejä nimellä
   * "Rakentamista valmisteleva puiden kaato tontilta, ..." - ja niiden
   * välillä otsikko ei kerro kummasta on kyse. Silloin on parempi jättää
   * ehdokas ihmisen arvioitavaksi kuin päivittää umpimähkään toista.
   *
   * Koskee vain tätä yhtä perustetta: jos osumalla on muutakin todistetta
   * (lupanumero, osoite, kaupunki), sitä ei tarvitse hylätä.
   */
  if (
    best.reasons.length === 1 &&
    best.reasons[0] === "exact_distinctive_title"
  ) {
    const equallyGood = matches.filter(
      (match) =>
        match.confidence === best.confidence &&
        match.reasons.length === 1 &&
        match.reasons[0] === "exact_distinctive_title"
    )

    if (equallyGood.length > 1) return null
  }

  return best
}

/*
 * Säilytetään vanha rajapinta, jotta nykyinen
 * app/api/agent/import/route.ts toimii edelleen.
 */
export function findProjectMatch(
  existingProjects: MatchableProject[],
  candidate: NormalizedProjectCandidate
): MatchableProject | null {
  const match = findProjectMatchDetailed(
    existingProjects,
    candidate
  )

  /*
   * Vanha import-polku saa automaattisen osuman vain,
   * jos luottamus on vähintään 70.
   */
  return match && match.confidence >= 70
    ? match.project
    : null
}