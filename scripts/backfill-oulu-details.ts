/*
 * Hakee kuvaukset Oulun kaavadokumenteille jotka tallennettiin tynkänä
 * (detaljihaun ajokohtainen raja oli 5, mutta yksi ajo näki 18 kohdetta) ja
 * ajaa fakta- ja identiteettityöläisen uudelleen, jotta kuvaus valuu
 * katselmoinnissa oleville ehdokkaille asti.
 *
 * Kertaluontoinen: uudet ajot eivät enää tuota tynkiä (ks. collectOuluSource).
 *
 *   npx tsx scripts/backfill-oulu-details.ts            # kuivaharjoitus
 *   npx tsx scripts/backfill-oulu-details.ts --apply
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import * as cheerio from "cheerio"

const APPLY = process.argv.includes("--apply")
const SOURCE_NAME = "Oulun vireillä olevat kaavat"
const CONCURRENCY = 4

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type Details = {
  ok: boolean
  description: string | null
  phase: string | null
  completed: boolean
  contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[]
}

// Sama poiminta kuin apiCollector.fetchOuluDetails; toistettu tässä jotta
// skripti ei riipu Next.js-aliaksista (@/lib/...).
async function fetchDetails(url: string): Promise<Details> {
  const empty: Details = { ok: false, description: null, phase: null, completed: false, contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const $ = cheerio.load(await response.text())

    const description =
      $("#project-description .field--name-field-description").first().text().trim() || null

    let phase: string | null = null
    let hasOngoing = false
    let hasUpcoming = false

    $(".paragraph--type--project-phase").each((_, el) => {
      const $el = $(el)
      const classes = $el.attr("class") ?? ""
      const title = $el.find(".phase__title .field--name-field-title").first().text().trim()
      if (classes.includes("ongoing")) {
        phase = title
        hasOngoing = true
      }
      if (classes.includes("upcoming")) hasUpcoming = true
    })

    const contacts: Details["contacts"] = []
    $("#project-contacts .contact-card").each((_, el) => {
      const $el = $(el)
      const title = $el.find(".contact-card__title").first().text().trim() || null
      const name = $el.find(".contact-card__name").first().text().trim() || null
      const phone = $el.find("a[href^='tel:']").attr("href")?.replace("tel:", "") ?? null
      const email = $el.find("a[href^='mailto:']").attr("href")?.replace("mailto:", "") ?? null
      if (name) contacts.push({ name, title, phone, email })
    })

    return { ok: true, description, phase, completed: !hasOngoing && !hasUpcoming, contacts }
  } catch {
    return empty
  }
}

async function main() {
  const { data: rows, error } = await supabase
    .from("source_documents")
    .select("id, title, document_url, raw_payload, facts_extracted_at, identity_resolved_at")
    .eq("source_name", SOURCE_NAME)

  if (error) throw error

  const stubs = (rows ?? []).filter((r: any) => {
    const p = r.raw_payload ?? {}
    return !p.details_fetched_at && !p.description && p.completed !== true
  })

  console.log(`${SOURCE_NAME}: ${rows?.length ?? 0} dokumenttia, ${stubs.length} ilman kuvausta`)
  if (stubs.length === 0) return

  /*
   * Osa tyngistä ehti jo tuottaa ehdokkaan - myös hyväksytyn, eli julkisen
   * hankkeen. Niille kuvaus haetaan vaikka kaava olisi jo läpi ("completed"),
   * koska hanke on joka tapauksessa jo kartalla. Vain ne joista ei ole
   * ehdokasta ja joiden kaava on valmis jätetään syntymättä uutena liidinä.
   */
  const { data: candidates } = await supabase
    .from("potential_projects")
    .select("id, title, status, metadata->>documents_url")
    .eq("metadata->>resolver", "ouluKaavaResolver")

  const candidateByUrl = new Map<string, any>()
  for (const c of candidates ?? []) {
    if ((c as any).documents_url) candidateByUrl.set((c as any).documents_url, c)
  }

  const results: { row: any; details: Details }[] = []

  for (let i = 0; i < stubs.length; i += CONCURRENCY) {
    const batch = stubs.slice(i, i + CONCURRENCY)
    const fetched = await Promise.all(
      batch.map(async (row: any) => ({ row, details: await fetchDetails(row.document_url) }))
    )
    results.push(...fetched)
    process.stdout.write(`\rhaettu ${results.length}/${stubs.length}`)
  }
  console.log()

  const withDescription = results.filter((r) => r.details.description)
  const completed = results.filter((r) => r.details.ok && r.details.completed)
  const failed = results.filter((r) => !r.details.ok)
  const empty = results.filter((r) => r.details.ok && !r.details.description && !r.details.completed)

  console.log(
    `\nkuvaus löytyi: ${withDescription.length}  valmistunut: ${completed.length}  ` +
      `tyhjä sivu: ${empty.length}  haku epäonnistui: ${failed.length}`
  )

  for (const { row, details } of results) {
    const state = !details.ok
      ? "EPÄONNISTUI"
      : details.completed
        ? "kaava valmis"
        : details.description
          ? `${details.description.length} merkkiä`
          : "ei kuvausta"
    const cand = candidateByUrl.get(row.document_url)
    console.log(
      `  ${String(row.title).slice(0, 42).padEnd(44)} ${state.padEnd(14)} ` +
        `${cand ? `ehdokas: ${cand.status}` : "ei ehdokasta"}`
    )
  }

  if (!APPLY) {
    console.log("\nkuivaharjoitus - aja --apply kirjoittaaksesi")
    return
  }

  // Työläiset luovat Supabase-clientin moduulitasolla, joten ne tuodaan vasta
  // kun ympäristömuuttujat on ladattu.
  const { runFactWorker } = await import("../lib/agent/workers/factWorker")
  const { runIdentityWorker } = await import("../lib/agent/workers/identityWorker")

  let updated = 0
  let reprocessed = 0

  for (const { row, details } of results) {
    if (!details.ok) continue

    const hasCandidate = candidateByUrl.has(row.document_url)
    // Uutta liidiä ei synnytetä valmiista kaavasta, mutta olemassa oleva
    // ehdokas/hanke rikastetaan kuvauksella.
    const reprocess = Boolean(details.description) && (hasCandidate || !details.completed)

    const payload = {
      ...(row.raw_payload ?? {}),
      description: details.description,
      phase: details.phase,
      contacts: details.contacts,
      completed: details.completed,
      details_fetched_at: new Date().toISOString(),
    }

    const rawText = JSON.stringify({
      item: {
        url: row.document_url,
        title: payload.title ?? row.title,
        kaavaTunnus: payload.kaava_tunnus ?? null,
        region: payload.region ?? null,
      },
      details,
    })

    const { error: updateError } = await supabase
      .from("source_documents")
      .update({
        raw_payload: payload,
        raw_text: rawText,
        updated_at: new Date().toISOString(),
        ...(reprocess
          ? // identityWorker ohittaa dokumentin jos aikaleima on jo asetettu.
            { identity_resolved_at: null }
          : {
              facts_extracted_at: new Date().toISOString(),
              identity_resolved_at: new Date().toISOString(),
            }),
      })
      .eq("id", row.id)

    if (updateError) throw updateError
    updated += 1

    if (!reprocess) continue

    await runFactWorker(row.id)
    await runIdentityWorker(row.id)
    reprocessed += 1
    process.stdout.write(`\rpäivitetty ${updated}, uudelleenajettu ${reprocessed}`)
  }

  console.log(`\nvalmis: ${updated} dokumenttia päivitetty, ${reprocessed} ajettu uudelleen`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
