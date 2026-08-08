/*
 * Korjaa kuntien päätöslähteiden rivit: sekoittuneet ääkköset ja puuttuva
 * kohdetyyppi.
 *
 * KAKSI ERI VIKAA, joilla eri korjaus:
 *
 * 1. Dynasty-rivit (espoo, tuusula, kirkkonummi, kuopio, savonlinna,
 *    tornio, joensuu, kouvola, porvoo) purettiin latin1:nä vaikka asiasivu
 *    on UTF-8, joten ääkköset hajosivat: "Liitteenä" -> "LiitteenÃ¤".
 *    Kuvaus haetaan uudelleen korjatulla purkajalla. Koski kaikkia 73
 *    Dynasty-ehdokasta.
 *
 * 2. Kohdetyyppi puuttui KAIKILTA päätösriveiltä (922 kpl), myös
 *    Helsingiltä ja Tampereelta joiden teksti oli kunnossa. Se lasketaan
 *    otsikosta ja kuvauksesta ilman verkkohakua.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-decision-sources.ts
 *   npx tsx scripts/backfill-decision-sources.ts --apply
 *   npx tsx scripts/backfill-decision-sources.ts --apply --only=espoo_paatokset
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const ONLY = process.argv
  .find((a) => a.startsWith("--only="))
  ?.split("=")[1]
  ?.split(",")
  .map((s) => s.trim())

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

/*
 * Sekoittuneen tekstin tunnusmerkit: UTF-8 luettuna latin1:nä tuottaa
 * "Ã¤"-alkuisia pareja, ja purkamattomat numeeriset entiteetit jäävät
 * näkyviin sellaisenaan.
 */
const MOJIBAKE = /Ã[¤¶Â¥„”]|Ã„|Ã–|&#x[0-9a-f]{2,4};|&#\d+;/i

const CONCURRENCY = 4

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferBuildingType } = await import("../lib/agent/buildingType")
  const { fetchDecoded, extractItemText } = await import("../lib/agent/fetchDynastySource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, municipality, status, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows.filter((r: any) => {
    const source = r.metadata?.source ?? ""
    if (!/_paatokset$/.test(source)) return false
    if (ONLY && !ONLY.includes(source)) return false
    const broken = MOJIBAKE.test(r.metadata?.description ?? "")
    const missingType = !r.metadata?.building_type
    return broken || missingType
  })

  const broken = targets.filter((r) => MOJIBAKE.test(r.metadata?.description ?? ""))

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} riviä`
  )
  console.log(`  joista sekoittunut teksti: ${broken.length} (haetaan uudelleen)\n`)
  if (targets.length === 0) return

  const stats = { teksti: 0, tyyppi: 0, epaonnistui: 0 }
  const types: Record<string, number> = {}

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(
      targets.slice(i, i + CONCURRENCY).map(async (row: any) => {
        const md = row.metadata ?? {}
        let description: string = md.description ?? ""

        /* Vain rikkinäiset haetaan uudelleen; muille riittää laskenta. */
        if (MOJIBAKE.test(description) && md.source_url) {
          const html = await fetchDecoded(md.source_url)
          const fresh = html ? extractItemText(html) : null
          if (fresh && !MOJIBAKE.test(fresh)) {
            description = fresh
            stats.teksti++
          } else {
            stats.epaonnistui++
            return
          }
        }

        const buildingType = md.building_type ?? inferBuildingType(row.title, description)
        if (!md.building_type && buildingType) {
          stats.tyyppi++
          types[buildingType] = (types[buildingType] ?? 0) + 1
        }

        if (!APPLY) return

        const { error } = await supabase
          .from("potential_projects")
          .update({
            metadata: { ...md, description, building_type: buildingType ?? null },
          })
          .eq("id", row.id)

        if (error) stats.epaonnistui++
      })
    )
    process.stdout.write(
      `\r  käsitelty ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length}`
    )
  }

  console.log("\n")
  console.log(`teksti korjattu:     ${stats.teksti}`)
  console.log(`kohdetyyppi lisätty: ${stats.tyyppi}`)
  console.log(`epäonnistui:         ${stats.epaonnistui}`)
  console.log("\nKohdetyypit:")
  for (const [t, n] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(20)} ${n}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
