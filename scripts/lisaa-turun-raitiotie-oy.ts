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
 * TURUN RAITIOTIE OY LIITTYVAKSI YRITYKSEKSI (D-307).
 *
 * Johannes 18.10.2026: *"lisaa turun raitiotie oy hankeeseen
 * liittyvaksi yritykseksi."*
 *
 * Tausta: yhdistamisessa piilotetulla rivilla luki tilaajana "Turun
 * Raitiotie Oy ja Turun kaupunki", kun voittajalla lukee "Turun
 * kaupunki". D-307:n saanto ei korvaa olemassa olevaa arvoa, joten
 * tieto jai nakymatta. `related_companies` on sille oikea koti.
 *
 * Kirjoitetaan samalla kuviolla kuin `companyMentionCollector`:
 * `mergeCompanyNames(before, [nimi])`, joka ei lisaa kaksoiskappaletta
 * jos nimi on jo listalla.
 *
 *   npx tsx scripts/lisaa-turun-raitiotie-oy.ts
 *   npx tsx scripts/lisaa-turun-raitiotie-oy.ts --apply
 */

const HANKE = "85a116f7-2e91-4d1a-b2b7-cfb6794c3ff5"
const YRITYS = "Turun Raitiotie Oy"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: hanke, error } = await db
    .from("projects")
    .select("id, name, developer, builder, is_public, metadata")
    .eq("id", HANKE)
    .maybeSingle()
  if (error || !hanke) {
    console.error(`VIRHE: hanketta ei loytynyt (${error?.message ?? "ei rivia"})`)
    process.exit(1)
  }

  const metadata: any = hanke.metadata ?? {}
  const ennen = Array.isArray(metadata.related_companies) ? metadata.related_companies : []
  const jalkeen = mergeCompanyNames(ennen, [YRITYS])

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`hanke      ${hanke.name}  (julkinen=${hanke.is_public})`)
  console.log(`tilaaja    ${hanke.developer ?? "-"}`)
  console.log(`rakentaja  ${hanke.builder ?? "-"}`)
  console.log(`liittyvat ennen:   ${JSON.stringify(ennen)}`)
  console.log(`liittyvat jalkeen: ${JSON.stringify(jalkeen)}`)

  if (jalkeen.length === ennen.length) {
    console.log("\nYritys on jo listalla. Ei muutosta.")
    return
  }
  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e2 } = await db
    .from("projects")
    .update({ metadata: { ...metadata, related_companies: jalkeen } })
    .eq("id", HANKE)
  if (e2) {
    console.error(`VIRHE: ${e2.message}`)
    process.exit(1)
  }
  console.log(`\nLISATTY: ${YRITYS}`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
