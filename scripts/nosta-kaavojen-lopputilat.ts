import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAAVOJEN LOPPUTILAT KATSELMOINTIIN TAKAUTUVASTI (D-396).
 *
 * Sama funktio jonka vuorokausiajo ajaa
 * (`/api/admin/advance-effective-zoning`), mutta koko kannan yli kerran.
 * Vuorokausiajo hoitaa jatkossa uudet tapaukset.
 *
 *   npx tsx scripts/nosta-kaavojen-lopputilat.ts
 *   npx tsx scripts/nosta-kaavojen-lopputilat.ts --apply
 */
const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { nostaLopputilat } = await import("../lib/projects/nostaLopputilat")
  const { PHASE_LABELS } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  /* Vain asiakkaalle näkyvät: piilotettua riviä ei tarvitse katselmoida. */
  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,phase,status,is_public,needs_review,metadata")
      .eq("phase", PHASE_LABELS.zoning)
      .eq("status", "active")
      .eq("is_public", true)
      .range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const tulos = await nostaLopputilat(db, hankkeet, !APPLY)

  console.log(`Kaavoitusvaiheessa ${tulos.kaavoitusvaiheessa} (asiakkaalle näkyviä)`)
  console.log(`  KATSELMOINTIIN      ${tulos.nostettu}`)
  console.log(`  vaihe päivitetään   ${tulos.vaihePaivitetty}`)
  console.log(`  ilman dokumenttia   ${tulos.ilmanDokumenttia}\n`)

  for (const r of tulos.rivit.filter((x) => x.toiminto === "nosta")) {
    console.log(`  NOSTO  ${String(r.tila).padEnd(14)} ${String(r.paiva ?? "-").padEnd(11)} ${r.nimi.slice(0, 52)}`)
    console.log(`         "${String(r.todiste).slice(0, 110)}"`)
  }
  const vaiheet = tulos.rivit.filter((x) => x.toiminto === "paivita_vaihe")
  console.log(`\n  vaihepäivityksiä listassa ${vaiheet.length}:`)
  for (const r of vaiheet.slice(0, 25)) console.log(`    -> ${String(r.vaihe).slice(0, 40).padEnd(40)} ${r.nimi.slice(0, 50)}`)

  if (tulos.virheet.length) {
    console.log("\n  VIRHEET:")
    for (const v of tulos.virheet) console.log(`    ${v.id}: ${v.error}`)
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
