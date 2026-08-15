import { createClient } from "@supabase/supabase-js"
import { sources as legacySources } from "@/lib/agent/sources"
import { resolveProjectCost } from "@/lib/projects/resolveProjectCost"
import { phaseAdvances } from "@/lib/projects/phases"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * Runkotyöntekijä (D-075, vaihe 2).
 *
 * `legacyFetchCollector` tallentaa haussa vain OSOITTEEN
 * (`status: "listed"`). Tämä työntekijä hakee tiedotteen rungon jälkikäteen,
 * tallentaa sen dokumentille ja vie rikastuksen jo tallennetuille riveille.
 *
 * MIKSI ERILLINEN AJO. Sivuhaku ajon sisällä on juuri se kustannus jota
 * `ENRICH_PER_RUN = 40` rajoittaa, ja se sitoo rikastuksen siihen ikkunaan
 * jolloin tiedote on vielä lähteen listaussivulla. Täältä käsin ikkunaa ei
 * ole: rivi odottaa niin kauan kuin on tarpeen.
 *
 * RUNKO TALLENNETAAN DOKUMENTILLE. Se on tämän koko työn pysyvin hyöty:
 * kun teksti on kerran tallessa, poimintaa voi parantaa TAKAUTUVASTI ilman
 * uutta verkkohakua. Mitattu vastaesimerkki 15.8.2026: `extractCostFromText`in
 * laajennus vaati kolme erillistä backfill-ajoa, koska alkuperäistä tekstiä
 * ei ollut mihinkään tallennettu.
 *
 * EI SYÖTETÄ FAKTAPUTKEEN. Legacy-reitti on jo tuonut nämä kandidaatit
 * `importCandidate`illa, joten dokumentin ajaminen `factWorker`in läpi loisi
 * saman hankkeen toiseen kertaan. Siksi rivi merkitään käsitellyksi
 * (`facts_extracted_at`), mikä pitää sen pois myös factWorkerin jonosta.
 */

/* Sivuhakuja per ajo. Yksi tiedotesivu on ~50 kB ja vastaa nopeasti. */
const DEFAULT_LIMIT = 25

/* Lyhyempi kuin tämä ei ole tiedotteen runko vaan listauksen tiivistelmä. */
const MIN_BODY_LENGTH = 400

/*
 * Kuvaus on poikkeus muihin kenttiin: pisin voittaa, ei ensimmäinen.
 * Tallennettu arvo on tyypillisesti listauksen 150-250 merkin tiivistelmä ja
 * uusi on tiedotteen koko teksti. Muissa kentissä olemassa oleva säilyy.
 */
const longerText = (existing: any, next: string) =>
  next.length > String(existing ?? "").length ? next : existing

const firstFilled = (...values: any[]) =>
  values.find((v) => v !== null && v !== undefined && String(v).trim() !== "") ??
  null

function findLegacySource(name: string | null | undefined) {
  if (!name) return null
  return (legacySources as any[]).find((source) => source.name === name) ?? null
}

/*
 * Vie rikastus jonoriville ja hyväksytylle hankkeelle, jotka tunnistetaan
 * SAMASTA lähdeosoitteesta. Osoite on tarkin käytettävissä oleva avain:
 * otsikko voi muuttua ja sama tiedote voi koskea useaa kuntaa.
 */
async function applyToStoredRows(
  documentUrl: string,
  enriched: any,
  description: string
): Promise<{ queue: number; projects: number }> {
  let queue = 0
  let projects = 0

  const { data: queueRows } = await supabaseAdmin
    .from("potential_projects")
    .select("id, title, metadata")
    .eq("metadata->>source_url", documentUrl)

  for (const row of queueRows ?? []) {
    const cost = resolveProjectCost({
      contractValue: (row as any).metadata?.contract_value,
      text: `${(row as any).title ?? ""} ${description}`,
      existingCost: (row as any).metadata?.estimated_cost,
      existingSource: (row as any).metadata?.cost_source,
    })

    const { error } = await supabaseAdmin
      .from("potential_projects")
      .update({
        metadata: {
          ...((row as any).metadata ?? {}),
          description: longerText((row as any).metadata?.description, description),
          city: firstFilled((row as any).metadata?.city, enriched.city),
          location: firstFilled((row as any).metadata?.location, enriched.location),
          developer: firstFilled((row as any).metadata?.developer, enriched.developer),
          builder: firstFilled((row as any).metadata?.builder, enriched.builder),
          building_type: firstFilled(
            (row as any).metadata?.building_type,
            enriched.building_type
          ),
          phase_hint: firstFilled(enriched.phase, (row as any).metadata?.phase_hint),
          ...(cost
            ? { estimated_cost: cost.estimated_cost, cost_source: cost.cost_source }
            : {}),
          enriched_at: new Date().toISOString(),
        },
      })
      .eq("id", (row as any).id)

    if (!error) queue++
  }

  const { data: projectRows } = await supabaseAdmin
    .from("projects")
    .select(
      "id, name, phase, city, location, developer, builder, property_type, estimated_cost, additional_info, metadata"
    )
    .eq("metadata->>source_url", documentUrl)

  for (const row of projectRows ?? []) {
    const r = row as any

    const cost = resolveProjectCost({
      contractValue: r.metadata?.contract_value,
      text: `${r.name ?? ""} ${description}`,
      existingCost: r.estimated_cost,
      existingSource: r.metadata?.cost_source,
    })

    /* Vaihe saa edetä muttei peruuttaa - sama sääntö kuin tuonnissa. */
    const nextPhase = phaseAdvances(r.phase, enriched.phase) ? enriched.phase : r.phase
    const costChanged =
      cost !== null && Number(cost.estimated_cost) !== Number(r.estimated_cost ?? 0)

    const { error } = await supabaseAdmin
      .from("projects")
      .update({
        additional_info: longerText(r.additional_info, description),
        city: firstFilled(r.city, enriched.city),
        location: firstFilled(r.location, enriched.location),
        developer: firstFilled(r.developer, enriched.developer),
        builder: firstFilled(r.builder, enriched.builder),
        property_type: firstFilled(r.property_type, enriched.building_type),
        phase: nextPhase,
        ...(costChanged ? { estimated_cost: cost!.estimated_cost } : {}),
        metadata: {
          ...(r.metadata ?? {}),
          description: longerText(r.metadata?.description, description),
          ...(cost
            ? { estimated_cost: cost.estimated_cost, cost_source: cost.cost_source }
            : {}),
          enriched_at: new Date().toISOString(),
        },
      })
      .eq("id", r.id)

    if (!error) projects++
  }

  return { queue, projects }
}

export async function runReleaseBodyWorker(limit = DEFAULT_LIMIT) {
  const startedAt = Date.now()

  const { data: documents, error } = await supabaseAdmin
    .from("source_documents")
    .select("id, source_name, title, document_url, raw_payload")
    .eq("status", "listed")
    /*
     * Järjestys on `updated_at` eikä `created_at`, koska ohimenevään virheeseen
     * kaatunut rivi JÄÄ "listed"-tilaan uutta yritystä varten. Luontijärjestys
     * nostaisi saman rikkinäisen osoitteen jonon kärkeen joka ajolla ja estäisi
     * kaikki muut; virheen yhteydessä päivitetty `updated_at` siirtää sen
     * takaisin jonon hännille itsestään.
     */
    .order("updated_at", { ascending: true })
    .limit(limit)

  if (error) throw error

  if (!documents?.length) {
    return { ok: true, message: "Ei runkoa odottavia dokumentteja", processed: 0 }
  }

  let fetched = 0
  let skipped = 0
  let failed = 0
  let queueUpdated = 0
  let projectsUpdated = 0

  for (const document of documents) {
    const legacyName = (document as any).raw_payload?.legacy_source
    const legacy = findLegacySource(legacyName)

    /*
     * Lähteellä ei ole rikastuskoukkua (esim. kuntapäätökset, joiden koko
     * sisältö tulee jo hausta). Rivi merkitään käsitellyksi, jottei se jää
     * ikuisesti jonon kärkeen estämään muita.
     */
    if (typeof legacy?.enrich !== "function") {
      await supabaseAdmin
        .from("source_documents")
        .update({
          status: "no_enricher",
          facts_extracted_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", (document as any).id)

      skipped++
      continue
    }

    try {
      const enriched = await legacy.enrich({
        name: (document as any).title,
        source_url: (document as any).document_url,
        city: null,
        location: null,
        developer: null,
        builder: null,
      })

      const description = String(enriched?.description ?? "")

      if (description.length < MIN_BODY_LENGTH) {
        await supabaseAdmin
          .from("source_documents")
          .update({
            status: "body_unavailable",
            facts_extracted_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error_message: `runko liian lyhyt (${description.length} merkkiä)`,
          })
          .eq("id", (document as any).id)

        failed++
        continue
      }

      const applied = await applyToStoredRows(
        (document as any).document_url,
        enriched,
        description
      )

      queueUpdated += applied.queue
      projectsUpdated += applied.projects

      await supabaseAdmin
        .from("source_documents")
        .update({
          raw_text: description,
          status: "enriched",
          /*
           * Merkitään faktat poimituiksi: ne poimittiin legacy-reitin
           * rikastajalla, ei factWorkerilla. Ilman tätä rivi jäisi
           * factWorkerin jonoon ja loisi saman hankkeen toiseen kertaan.
           */
          facts_extracted_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", (document as any).id)

      fetched++
    } catch (err: any) {
      await supabaseAdmin
        .from("source_documents")
        .update({
          error_message: String(err?.message ?? err).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", (document as any).id)

      failed++
    }
  }

  return {
    ok: true,
    processed: documents.length,
    fetched,
    skipped,
    failed,
    queueUpdated,
    projectsUpdated,
    durationMs: Date.now() - startedAt,
  }
}
