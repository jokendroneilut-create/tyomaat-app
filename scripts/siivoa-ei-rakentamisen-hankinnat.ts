import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * EI-RAKENTAMISEN HANKINNAT POIS JONOSTA (D-346).
 *
 * Johannes 25.10.2026: *"jonossa on paljon avoterapiahankintoja? Miksi?
 * korjataan ja siivoa jono"*. Tuonnin suodatin estaa uudet
 * (`lib/agent/hilmaRakentamisenIlmoitus.ts`); tama siivoaa jo jonossa
 * olevat SAMALLA SAANNOLLA, jottei siivous ole eri mielta kuin suodatin.
 *
 * TILA ON `rejected`, EI `ignored`. Nama ovat katselmoinnin tulos -- ne
 * eivat ole hankkeita lainkaan -- ja Johannes on hylannyt samaa luokkaa
 * olevat 26 rivia kasin. `ignored` on jonosta poistamista varten, ei
 * katselmointipaatokselle ([[queue-removal-ignored]]).
 *
 * Rivi ei katoa: teksti, lahde ja syy jaavat talteen
 * ([[reject-is-not-final]] -- naista ei tule hankkeita myohemminkaan,
 * koska kyse ei ole rakentamisesta).
 *
 *   npx tsx scripts/siivoa-ei-rakentamisen-hankinnat.ts
 *   npx tsx scripts/siivoa-ei-rakentamisen-hankinnat.ts --apply
 */

import { cpvKoodit, estettyPerhe } from "../lib/agent/hilmaRakentamisenIlmoitus"

const SYY = "Ei rakentamisen hankinta (CPV-perhe ilman yhtään hyväksyttyä hanketta), D-346"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,status,metadata")
      .eq("status", "new")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`Jonossa (status=new): ${rivit.length}`)

  const osumat = rivit
    .map((r) => ({ rivi: r, perhe: estettyPerhe(r.metadata?.cpv_codes ?? r.metadata?.cpv_code) }))
    .filter((o) => o.perhe)

  console.log(`Estettyyn perheeseen osuu: ${osumat.length}\n`)
  for (const { rivi, perhe } of osumat) {
    const koodit = cpvKoodit(rivi.metadata?.cpv_codes ?? rivi.metadata?.cpv_code).join(" ")
    console.log(`  CPV ${String(perhe).padEnd(6)} [${koodit.padEnd(22)}] ${String(rivi.title).slice(0, 70)}`)
    console.log(`     tilaaja: ${rivi.metadata?.developer ?? "-"}`)
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  let tehty = 0
  for (const { rivi, perhe } of osumat) {
    const { error } = await db
      .from("potential_projects")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
        metadata: {
          ...(rivi.metadata ?? {}),
          rejected_at: new Date().toISOString(),
          rejected_reason: `${SYY} (CPV ${perhe})`,
        },
      })
      .eq("id", rivi.id)
    if (error) console.error(`   VIRHE ${rivi.id}: ${error.message}`)
    else tehty += 1
  }
  console.log(`\nHylätty ${tehty} / ${osumat.length}`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
