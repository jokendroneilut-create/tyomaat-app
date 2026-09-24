import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PALJONKO YKSI TASMAYTYS MAKSAA?
 *
 * `findProjectMatchDetailed` ajetaan jokaiselle tuotavalle ehdokkaalle
 * koko hankelistaa vastaan. Se on puhdasta CPU-tyota, joten mittaus
 * kertoo saman luvun tuotannossa kuin paikallisesti.
 *
 *   npx tsx scripts/measure-tasmayttajan-hinta.ts
 */

const EHDOKKAAT = [
  {
    name: "Kreate voitti Ouluntien tasoristeysten poistourakan Kemissa",
    city: "Kemi", region: "Lappi", developer: "Kreate", buildingType: "Infrahanke",
    description:
      "Kreate on allekirjoittanut Vaylaviraston kanssa sopimuksen Kemissa sijaitsevasta " +
      "Jarppi-Kemi, Ouluntie -tasoristeysten poistourakasta. Yli seitseman miljoonan " +
      "urakassa poistetaan kaksi tasoristeysta ja korvataan ne uudella alikulkusillalla " +
      "seka tiejarjestelyilla. ".repeat(8),
  },
  {
    name: "Hartela toteuttaa hoivakokonaisuuden Tampereen Hervantaan",
    city: "Tampere", region: "Pirkanmaa", developer: "Hartela", buildingType: "Hoivakoti",
    description: "Hartela rakentaa Tampereen Hervantaan hoivakokonaisuuden. ".repeat(20),
  },
  {
    name: "Skanska rakentaa Garminille toimitilat Jyvaskylaan",
    city: "Jyvaskyla", region: "Keski-Suomi", developer: "Skanska", buildingType: "Toimitila",
    description: "Skanska rakentaa Garminille uudet toimitilat Jyvaskylaan. ".repeat(20),
  },
]

async function main() {
  const { loadProjectsForMatching } = await import("../lib/agent/importCandidate")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")

  const projects: any[] = (await loadProjectsForMatching()) as any[]
  console.log(`hankkeita ${projects.length}\n`)

  const pohja = { sourceTitle: null, location: null, permitNumber: null, propertyId: null }

  console.log("kierros  ms    osuma")
  for (let kierros = 1; kierros <= 3; kierros++) {
    for (const e of EHDOKKAAT) {
      const a = Date.now()
      const t = findProjectMatchDetailed(projects as any, { ...pohja, ...e } as any)
      console.log(
        `${String(kierros).padStart(7)}  ${String(Date.now() - a).padStart(5)}  ` +
          `${t ? `${t.confidence} ${String(t.project.name).slice(0, 44)}` : "ei osumaa"}`
      )
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
