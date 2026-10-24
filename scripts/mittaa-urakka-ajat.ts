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
 * URAKKA-AIKA KUVAUKSESSA: MONTAKO RIVIA, JA MITA NIISTA PUUTTUU?
 *
 * Johannes 24.10.2026 Abackan sahkoasemasta: *"tasta ei ole poimittu
 * Arvioitu urakka-aika on huhtikuu 2026 - joulukuu 2026."*
 *
 * `parseEstimatedCompletionDate` vaatii valmistumissanan ("valmistuu",
 * "luovutetaan"). Ajanjaksolause ei sisalla sellaista, joten se jaa
 * lukematta. Tama mittaa montako rivia kuvio koskee ENNEN kuin
 * kirjoitan saannon -- ja monellako niista valmistuminen jo on
 * ([[name-the-denominator]]).
 *
 *   npx tsx scripts/mittaa-urakka-ajat.ts
 *   npx tsx scripts/mittaa-urakka-ajat.ts --rivit
 */

import { parseEstimatedCompletionDate } from "../lib/agent/parseFinnishCompletionDate"

/* Ajanjaksolause ilman valmistumissanaa. Kuviot luetaan aineistosta. */
const JAKSOSANAT = [
  ["urakka-aika", /urakka-?aika/i],
  ["rakennusaika", /rakennus-?aika/i],
  ["toteutusaika", /toteutus-?aika/i],
  ["sopimusaika", /sopimus-?aika/i],
  ["työt ajalla", /ty[öo]t\s+(?:tehd[äa][äa]n\s+)?ajalla/i],
  ["ajanjaksolla", /ajanjaksolla/i],
  ["urakka-aikataulu", /urakka-?aikataulu/i],
] as const

async function main() {
  const naytaRivit = process.argv.includes("--rivit")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const luvut = { rivit: 0, jaksolause: 0, ilmanValmistumista: 0, jasenninLoytaa: 0 }
  const sanaLaskut = new Map<string, number>()
  const osumat: { id: string; taulu: string; nimi: string; lause: string; nyt: string | null }[] = []

  for (const taulu of ["potential_projects", "projects"] as const) {
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, estimated_completion, additional_info, metadata"
            : "id, title, status, metadata"
        )
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      for (const p of (data ?? []) as any[]) {
        if (taulu === "potential_projects" && p.status === "ignored") continue
        luvut.rivit += 1

        const kuvaus = (
          taulu === "projects"
            ? String(p.additional_info ?? p.metadata?.description ?? "")
            : String(p.metadata?.description ?? "")
        ).replace(/\s+/g, " ")
        if (!kuvaus) continue

        const osuneet = JAKSOSANAT.filter(([, re]) => re.test(kuvaus))
        if (!osuneet.length) continue
        luvut.jaksolause += 1
        for (const [nimi] of osuneet) sanaLaskut.set(nimi, (sanaLaskut.get(nimi) ?? 0) + 1)

        const nyt =
          (taulu === "projects" ? p.estimated_completion : null) ??
          p.metadata?.estimated_completion ??
          null
        if (nyt) continue
        luvut.ilmanValmistumista += 1

        /* Loytaisiko nykyinen jasennin sen jostain muusta lauseesta? */
        if (parseEstimatedCompletionDate(kuvaus, null)) {
          luvut.jasenninLoytaa += 1
          continue
        }

        /* Lause talteen luettavaksi: 90 merkkia osuman ymparilta. */
        const re = osuneet[0][1]
        const i = kuvaus.search(re)
        osumat.push({
          id: p.id,
          taulu,
          nimi: String(p.name ?? p.title ?? "").slice(0, 46),
          lause: kuvaus.slice(Math.max(0, i - 10), i + 110),
          nyt,
        })
      }
      if ((data ?? []).length < 500) break
    }
  }

  console.log("=== KAIKKI RIVIT ===")
  console.log(`Rivejä ${luvut.rivit}`)
  console.log(`Jaksolause kuvauksessa: ${luvut.jaksolause}`)
  console.log(`   niistä valmistuminen jo tiedossa: ${luvut.jaksolause - luvut.ilmanValmistumista}`)
  console.log(`   ilman valmistumista: ${luvut.ilmanValmistumista}`)
  console.log(`   niistä nykyinen jäsennin löytää muualta: ${luvut.jasenninLoytaa}`)
  console.log(`   => jää poimimatta: ${osumat.length}`)

  console.log("\n=== SANAT ===")
  for (const [sana, n] of [...sanaLaskut.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${String(n).padStart(4)}  ${sana}`)
  }

  if (naytaRivit) {
    console.log(`\n=== LAUSEET (${osumat.length}) ===`)
    for (const o of osumat) {
      console.log(`\n${o.taulu === "projects" ? "HANKE" : "JONO "} ${o.nimi}`)
      console.log(`   ...${o.lause}...`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
