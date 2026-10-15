import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

import { resolveProjectCost } from "../lib/projects/resolveProjectCost"

/*
 * HILMAN ENNAKOITU ARVO TAKAUTUVASTI (D-291).
 *
 * `extractHilmaFacts` luki vain RATKAISUN summia, joten tilaajan oma
 * arvio (`original.estimatedValue`, TED BT-27) jäi lukematta — vaikka se
 * on jo tallennetussa hyötykuormassa eikä vaadi yhtäkään verkkohakua.
 * Korjaus koskee poimintaa, joten jo tuodut rivit täydennetään tällä.
 *
 * Mitattu 15.10.2026: kenttä on 459 Hilma-dokumentissa 1 544:stä,
 * mediaani 400 000 €, suurin 1 000 000 000 €, ja 244 ehdokkaalta
 * kustannusarvio puuttui kokonaan.
 *
 * ALKUPERÄ RATKAISEE, EI SUURUUS. `resolveProjectCost` päättää
 * kirjoitetaanko: käsin syötetty ja sopimusarvo voittavat ilmoituksen
 * arvion, joka voittaa tekstistä poimitun. Tämä skripti ei siis voi
 * ylikirjoittaa parempaa tietoa — se vain antaa resolverille sen
 * kentän jota se ei ennen saanut.
 *
 *   npx tsx scripts/taydenna-hilma-kustannusarvio.ts
 *   npx tsx scripts/taydenna-hilma-kustannusarvio.ts --apply
 */

const fmt = (n: unknown) =>
  typeof n === "number" ? new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 }).format(n) : String(n)

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* Dokumenttien ennakoidut arvot tunnisteen mukaan. */
  const docs: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("id, raw_payload")
      .eq("source_id", "hilma")
      .range(alku, alku + 999)
    if (error) {
      console.error("VIRHE dokumentit:", error.message)
      process.exit(1)
    }
    docs.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const arvoDokumentilta = new Map<string, number>()
  for (const d of docs) {
    const v = (d.raw_payload as any)?.original?.estimatedValue
    if (typeof v === "number" && Number.isFinite(v) && v > 0) arvoDokumentilta.set(d.id, v)
  }
  console.log(`Hilma-dokumentteja ${docs.length}, joissa estimatedValue: ${arvoDokumentilta.size}\n`)

  /* 1. JONO */
  const ehdokkaat: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db.from("potential_projects").select("id, title, status, metadata").range(alku, alku + 999)
    if (error) {
      console.error("VIRHE ehdokkaat:", error.message)
      process.exit(1)
    }
    ehdokkaat.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  let jonoKirjoitettu = 0
  let jonoEnnallaan = 0
  const naytteet: string[] = []

  for (const e of ehdokkaat) {
    const md = (e.metadata as any) ?? {}
    const arvo = arvoDokumentilta.get(String(md.source_document_id ?? ""))
    if (arvo == null) continue

    const ratkaistu = resolveProjectCost({
      contractValue: md.contract_value,
      noticeValue: arvo,
      text: [md.description, md.operation].filter(Boolean).join(" "),
      existingCost: md.estimated_cost,
      existingSource: md.cost_source,
    })
    if (!ratkaistu) continue
    if (
      Number(ratkaistu.estimated_cost) === Number(md.estimated_cost ?? 0) &&
      ratkaistu.cost_source === md.cost_source
    ) {
      jonoEnnallaan++
      continue
    }

    if (naytteet.length < 12) {
      naytteet.push(
        `  ${String(md.estimated_cost ?? "–").padStart(12)} (${md.cost_source ?? "–"})` +
          ` -> ${fmt(ratkaistu.estimated_cost).padStart(13)} € (${ratkaistu.cost_source})  [${e.status}]  ${String(e.title).slice(0, 44)}`
      )
    }

    if (!apply) {
      jonoKirjoitettu++
      continue
    }
    const { error: uv } = await db
      .from("potential_projects")
      .update({
        metadata: { ...md, estimated_cost: ratkaistu.estimated_cost, cost_source: ratkaistu.cost_source },
      })
      .eq("id", e.id)
    if (uv) console.log(`  VIRHE ${e.id}: ${uv.message}`)
    else jonoKirjoitettu++
  }

  console.log(`JONO: muuttuisi ${jonoKirjoitettu}, ennallaan ${jonoEnnallaan}`)
  for (const n of naytteet) console.log(n)

  /* 2. KANTA — nakyva sarake on projects.estimated_cost. */
  const hankkeet: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db.from("projects").select("id, name, estimated_cost, metadata").range(alku, alku + 999)
    if (error) {
      console.error("VIRHE hankkeet:", error.message)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  let kantaKirjoitettu = 0
  let kantaEnnallaan = 0
  const naytteet2: string[] = []

  for (const p of hankkeet) {
    const md = (p.metadata as any) ?? {}
    const arvo = arvoDokumentilta.get(String(md.source_document_id ?? ""))
    if (arvo == null) continue

    const ratkaistu = resolveProjectCost({
      contractValue: md.contract_value,
      noticeValue: arvo,
      text: [md.description, md.operation].filter(Boolean).join(" "),
      existingCost: p.estimated_cost,
      existingSource: md.cost_source,
    })
    if (!ratkaistu) continue
    if (Number(ratkaistu.estimated_cost) === Number(p.estimated_cost ?? 0)) {
      kantaEnnallaan++
      continue
    }

    if (naytteet2.length < 12) {
      naytteet2.push(
        `  ${String(p.estimated_cost ?? "–").padStart(12)} (${md.cost_source ?? "–"})` +
          ` -> ${fmt(ratkaistu.estimated_cost).padStart(13)} € (${ratkaistu.cost_source})  ${String(p.name).slice(0, 48)}`
      )
    }

    if (!apply) {
      kantaKirjoitettu++
      continue
    }
    const { error: uv } = await db
      .from("projects")
      .update({
        estimated_cost: ratkaistu.estimated_cost,
        metadata: { ...md, estimated_cost: ratkaistu.estimated_cost, cost_source: ratkaistu.cost_source },
      })
      .eq("id", p.id)
    if (uv) console.log(`  VIRHE ${p.id}: ${uv.message}`)
    else kantaKirjoitettu++
  }

  console.log(`\nKANTA: muuttuisi ${kantaKirjoitettu}, ennallaan ${kantaEnnallaan}`)
  for (const n of naytteet2) console.log(n)

  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
