import { createClient } from "@supabase/supabase-js"
import { classifyProject } from "@/lib/agent/knowledge/projectClassifier"
import { resolvePotentialProject } from "@/lib/agent/identity/resolvePotentialProject"
import { syncApprovedProject } from "@/lib/projects/syncApprovedProject"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { inferCompletionDateFromText, isPastDate } from "@/lib/projects/inferCompletionDateFromText"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function findFact(facts: any[], type: string) {
  return facts.find((fact) => fact.fact_type === type)
}

const RAJUKIVI_STOPWORDS = new Set([
  "Rajukivi",
  "Rajukiven",
  "Rajukivelle",
  "Rajukiveä",
  "Oy",
  "Kunta",
  "Kaupunki",
  "Kaupungin",
  "Helsinki",
  "Helsingin",
  "Espoo",
  "Espoon",
  "Vantaa",
  "Vantaan",
  "Tampere",
  "Tampereen",
  "Turku",
  "Turun",
  "Alueen",
  "Alueella",
  "Alueelle",
  "Hankkeen",
  "Hanke",
  "Hankkeessa",
  "Urakka",
  "Urakan",
  "Urakassa",
  "Väylävirasto",
  "Väyläviraston",
])

/*
 * Kaksi aiempaa yritystä (mikä tahansa iso alkukirjain -> vain
 * keskellä lausetta olevat) osoittautuivat molemmat vaarallisiksi
 * kantatuotannossa: ensimmäinen täsmäytti "Vaativan" väärään
 * "Vaativa asematunneliurakka" -hankkeeseen pelkän yhteisen
 * adjektiivin perusteella; toinen (keskilause-suodatus) korjasi tuon
 * mutta täsmäytti silti "Säterinkalliossa kiilaustyöt" -artikkelin
 * väärään "Vanhusten palvelutalo ... Leppävaara" -hankkeeseen, koska
 * "Leppävaaran" on täysin pätevä erisnimi joka vain sattuu mainitsemaan
 * KAUPUNGINOSAN jossa artikkelin oma kohde sijaitsee — ei itse kohteen
 * nimeä.
 *
 * Ainoa luotettava tapa erottaa "kohteen nimi" "mainitusta alueesta"
 * ilman täyttä kielioppianalyysiä on rajata haku niihin rakenteellisiin
 * lausefraaseihin, joissa Rajukiven tiedotteet SPESIFISESTI nimeävät
 * kohteensa (esim. "X asemakaava-alue sijaitsee ...", "pääurakoitsijana
 * X-alueella", "vastaa alueen X toteutuksesta") — nämä samat mallit
 * joita apiCollector.ts:n rajukiviExtractWorksiteName käyttää otsikon
 * parantamiseen. Jos mikään malli ei osu, rikastusta ei edes yritetä;
 * turvallisempi vaihtoehto on luoda uusi ehdokas ihmisen katsottavaksi.
 */
const RAJUKIVI_WORKSITE_PATTERNS = [
  /rajukivi\s+toimii\s+pääurakoitsijana\s+(.+?)\s*-?alueella\b/i,
  /rajukivi\s+oy\s+vastaa\s+alueen\s+(.+?)\s+toteutuksesta/i,
  /(\S+(?:\s+\S+){0,4})\s+asemakaava-alue(?:en)?\s+sijaitsee/i,
  /rajukivi\s+vastaa\s+(.+?)\s+\S*(?:töistä|rakenteista)/i,
  /rajukivi\s+(?:on\s+)?valittu\s+toteuttamaan\s+(.+?)(?:\s+kokonaisurakkaa|\.)/i,
  /rajukivi\s+(?:on\s+)?mukana\s+(.+?)(?:-hankkeessa|hankkeessa|-projektissa)\b/i,
  /rajukivi\s+osallistui\s+(.+?)\s+vaiheen\s+rakentamiseen/i,
]

function rajukiviWorksitePhrase(text: string): string | null {
  for (const pattern of RAJUKIVI_WORKSITE_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const cleaned = match[1].trim().replace(/^(uuden|uutta|uusi)\s+/i, "")
      if (cleaned.length >= 6) return cleaned
    }
  }
  return null
}

/*
 * Astevaihtelu (kk:k, pp:p, tt:t jne.) ja sijapäätteet muuttavat sanan
 * loppuosaa arvaamattomasti ("Härkälenkki" -> "Härkälenkin"), joten
 * täydellinen perusmuotoon palauttaminen ei ole luotettavaa. Sanan
 * alkuosa pysyy sen sijaan lähes aina muuttumattomana, joten haku
 * tehdään 9 merkin etuliitteellä täsmällisen taivutusmuodon sijaan.
 */
function rajukiviCandidateStems(text: string): string[] {
  const phrase = rajukiviWorksitePhrase(text)
  if (!phrase) return []

  const words = phrase.match(/[A-ZÄÖÅ][a-zäöåA-ZÄÖÅ]{4,}\b/g) ?? []
  const stems = new Set<string>()
  for (const word of words) {
    if (RAJUKIVI_STOPWORDS.has(word)) continue
    const prefix = word.slice(0, Math.min(word.length, 9))
    if (prefix.length >= 6) stems.add(prefix)
  }
  return Array.from(stems)
}

/*
 * Toisin kuin rajukiviCandidateStems (joka rajaa hakusanat rakenteelliseen
 * kohdefraasiin väärien osumien estämiseksi), tämä skannaa koko tekstin
 * löyhemmin — käytetään VAIN moniselitteisen ensisijaisen osuman
 * kaventamiseen, ei koskaan itsenäisenä hakuna. Esim. Vehkalan artikkeli
 * mainitsee sekä "Vehkalan länsipuoli 2":n että "Vehkalan Härkälenkin"
 * kaltaisia lähes samannimisiä hankkeita — vasta myöhemmin tekstissä
 * mainittu "Härkälenkin" erottaa ne toisistaan.
 */
function rajukiviSecondaryStems(text: string): string[] {
  const midSentenceCapitalized = /(?<=[a-zäöå]\s)[A-ZÄÖÅ][a-zäöåA-ZÄÖÅ]{5,}\b/g
  const words = text.match(midSentenceCapitalized) ?? []
  const stems = new Set<string>()
  for (const word of words) {
    if (RAJUKIVI_STOPWORDS.has(word)) continue
    const prefix = word.slice(0, Math.min(word.length, 9))
    if (prefix.length >= 6) stems.add(prefix)
  }
  return Array.from(stems)
}

/*
 * Kun kunta on tunnistettu artikkelista, sen täytyy täsmätä myös
 * yksittäiseen osumaan — muuten se hylätään ja kokeillaan seuraavaa
 * sanaa. Tämä esti kantatuotannossa löytyneen bugin, jossa yhteinen
 * sana täsmäytti väärään hankkeeseen samassa (isossa) kaupungissa.
 * Kun kuntaa ei tunnistettu (esim. artikkeli ei mainitse mitään
 * kaupunkia nimeltä, vain kaupunginosan), yksittäinen yksiselitteinen
 * sanaosuma hyväksytään silti — muuten mm. Vehkalan tapaus (kunta ei
 * ollut pääteltävissä tekstistä) ei olisi koskaan täsmännyt.
 */
async function findMatchingProject(
  stems: string[],
  municipality: string | null,
  secondaryStems: string[]
) {
  for (const stem of stems) {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("id, name, city, phase, builder, metadata")
      .ilike("name", `%${stem}%`)

    if (error) throw error
    if (!data || data.length === 0) continue

    if (data.length === 1) {
      const candidate = data[0]
      if (municipality && candidate.city !== municipality) continue
      return candidate
    }

    if (municipality) {
      const narrowed = data.filter((project) => project.city === municipality)
      if (narrowed.length === 1) return narrowed[0]
    }

    for (const secondary of secondaryStems) {
      const narrowed = data.filter((project) =>
        project.name.toLowerCase().includes(secondary.toLowerCase())
      )
      if (narrowed.length === 1) return narrowed[0]
    }
    // Yhäkin moniselitteinen — kokeillaan seuraavaa ensisijaista sanaa
    // arvaamisen sijaan.
  }
  return null
}

export async function resolveRajukiviProject({
  document,
  facts,
}: {
  document: any
  facts: any[]
}) {
  const title = findFact(facts, "operation")?.fact_value ?? document.title
  const phaseKey = findFact(facts, "decision_status")?.fact_value ?? "construction"

  const metadata = facts[0]?.metadata ?? {}
  const description = metadata.description ?? null
  const municipality = metadata.municipality ?? null
  const slug = document.raw_payload?.slug ?? null

  const combinedText = `${title}. ${description ?? ""}`

  /*
   * Rajukiven tiedote saattaa itse pysyä "käynnissä"-muodossa vaikka
   * tekstissä mainittu valmistumispäivä on jo mennyt (ks.
   * inferCompletionDateFromText.ts) - tarkistetaan tämä ennen phaseLabelin
   * päättämistä, jotta hanke ei jää virheellisesti "Rakenteilla"-vaiheeseen
   * kuukausiksi/vuosiksi sen jälkeen kun se on tosiasiassa valmistunut.
   */
  const inferredCompletionDate = inferCompletionDateFromText(combinedText)
  const isAlreadyCompleted = phaseKey === "completed" || isPastDate(inferredCompletionDate)
  const phaseLabel = isAlreadyCompleted ? PHASE_LABELS.completed : PHASE_LABELS.construction

  const stems = rajukiviCandidateStems(combinedText)
  const secondaryStems = rajukiviSecondaryStems(combinedText)
  const matchedProject = stems.length
    ? await findMatchingProject(stems, municipality, secondaryStems)
    : null

  if (matchedProject) {
    await syncApprovedProject({
      supabase: supabaseAdmin,
      projectId: matchedProject.id,
      newMetadata: {
        phase_hint: phaseLabel,
        estimated_completion: inferredCompletionDate,
        completed: isAlreadyCompleted,
        rajukivi_note: description,
        rajukivi_source_url: document.document_url,
        rajukivi_updated_at: new Date().toISOString(),
      },
      sourceName: document.source_name,
    })

    if (!matchedProject.builder) {
      const { error: builderError } = await supabaseAdmin
        .from("projects")
        .update({ builder: "Rajukivi Oy" })
        .eq("id", matchedProject.id)

      if (builderError) throw builderError
    }

    return {
      action: "enriched_existing_project",
      projectId: matchedProject.id,
      title: matchedProject.name,
      municipality: matchedProject.city,
      phase: phaseLabel,
    }
  }

  const classification = classifyProject({
    operation: title,
    title,
  })

  const result = await resolvePotentialProject({
    title,
    municipality,
    address: null,
    propertyId: null,
    permitNumber: null,

    sourceName: document.source_name,

    metadata: {
      source: "Rajukivi Oy",
      source_name: document.source_name,
      source_document_id: document.id,
      resolver: "rajukiviResolver",

      operation: title,
      slug,

      decision_status: phaseKey,
      documents_url: document.document_url,
      source_url: document.document_url,

      description,
      contact_persons: [],

      phase_hint: phaseLabel,
      completed: isAlreadyCompleted,
      estimated_completion: inferredCompletionDate,
      builder: "Rajukivi Oy",

      construction_type: classification.construction_type,
      building_type: classification.building_type,
      size_class: classification.size_class,
      business_value: classification.business_value,
      recommended_action: classification.recommended_action,
      classification_confidence: classification.confidence,
      classification_reasons: classification.reasons,
    },
  })

  return {
    action: result.action,
    potentialProjectId: result.potentialProject.id,
    title: result.potentialProject.title,
    municipality,
    phase: phaseLabel,
    classification,
  }
}
