/*
 * Täydentää puuttuvan kohdetyypin asiakkaille näkyviin hankkeisiin.
 *
 * MIKSI TÄMÄ ON SUURIN LAATUAUKKO. Kohdetyyppi on asiakkaan ensisijainen
 * suodatin. Mitattu 13.8.2026: **3 706 hanketta 5 424:stä (68 %) oli
 * ilman kohdetyyppiä**, eli koulukohteita etsivä näki kolmasosan
 * todellisuudesta - ja luuli nähneensä kaiken.
 *
 * Poimija (`inferBuildingType`) on jo olemassa ja käytössä uusilla
 * päätösriveillä. Nämä rivit ovat sitä vanhempia tai lähteistä joissa
 * poiminta ei ollut käytössä; kuvaustekstit ovat nyt kunnossa
 * (STT-tiedotteiden leipäteksti haettiin, kaavakuvaukset laajennettiin),
 * joten poiminnalla on nyt jotain mistä lukea.
 *
 * VAIN OTSIKOSTA. Mitattu ero on jyrkkä: otsikosta tyyppi ratkeaa 193
 * riville ja lähes kaikki ovat oikein, mutta kuvauksesta se ratkeaa
 * 529:lle ja ne ovat pääosin vääriä:
 *
 *   "HAM Helsingin taidemuseon uudeksi sijainniksi..."  -> Logistiikka
 *   "Keskustan katuverkon parannus Oulu"                -> Kulttuurirakennus
 *   "Sähkövarasto Haapajärvelle"                        -> Liikuntapaikka
 *   "Papinsillan asemakaava"                            -> Kirjasto
 *
 * Syy on sama kuin muissakin tämän istunnon ansoissa: kuvaus kertoo
 * ympäristöstä ja vertailukohdista, ei kohteesta itsestään. Kaavarivillä
 * se kuvaa koko aluetta. 193 oikeaa on parempi kuin 722 joista kaksi
 * kolmasosaa on väärin - väärä kohdetyyppi on suodatin joka näyttää
 * asiakkaalle väärän hankkeen ja piilottaa oikean.
 *
 *   npx tsx scripts/backfill-building-type.ts
 *   npx tsx scripts/backfill-building-type.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

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

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferBuildingType } = await import("../lib/agent/buildingType")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string, cols: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`)

  for (const [table, titleKey, typeKey] of [
    ["projects", "name", "property_type"],
    ["potential_projects", "title", null],
  ] as const) {
    const rows = await page(table, "*")
    const live =
      table === "projects"
        ? rows.filter((r: any) => r.status === "active" && r.is_public !== false)
        : rows.filter((r: any) => r.status === "new")

    const missing = live.filter((r: any) =>
      typeKey ? !r[typeKey] : !r.metadata?.building_type
    )

    const hits = missing
      .map((r: any) => ({
        r,
        type: inferBuildingType(String(r[titleKey] ?? ""), null),
      }))
      .filter((x): x is { r: any; type: string } => Boolean(x.type))

    console.log(`${table}: ${live.length} riviä, ilman kohdetyyppiä ${missing.length}`)
    console.log(`  poimija saa arvon: ${hits.length}  (${((hits.length / Math.max(1, missing.length)) * 100).toFixed(0)} %)`)

    const byType: Record<string, number> = {}
    for (const h of hits) byType[h.type] = (byType[h.type] ?? 0) + 1
    for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`    ${String(n).padStart(4)}  ${t}`)
    }

    console.log("\n  näyte:")
    for (const h of hits.slice(0, 6)) {
      console.log(`    ${h.type.padEnd(18)} ${String(h.r[titleKey]).slice(0, 54)}`)
    }

    if (!APPLY) {
      console.log("")
      continue
    }

    let done = 0
    for (const { r, type } of hits) {
      const patch: Record<string, any> =
        table === "projects"
          ? { property_type: type, metadata: { ...r.metadata, building_type: type } }
          : { metadata: { ...r.metadata, building_type: type } }

      const { error } = await supabase.from(table).update(patch).eq("id", r.id)
      if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
      else done++
    }
    console.log(`  kirjoitettu: ${done}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
