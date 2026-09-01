/*
 * Luokittelee kohdetyypin LLM:llä riveille joilta se puuttuu tai on
 * kanonisen sanaston ulkopuolella.
 *
 * MIKSI. Kohdetyyppi on asiakkaan ensisijainen suodatin, ja se oli
 * kahdella tavalla rikki: 3 688 riviltä puuttui kokonaan, ja
 * asetetuissa oli **198 eri arvoa** 1 907 rivillä - "Koulu" ja "koulu"
 * erikseen, "Tuulivoima" ja "Tuulivoimalahankkeet" erikseen, ja häntänä
 * vapaata tekstiä kuten "Prisma" ja "Asiantuntijapalvelut".
 *
 * MITATTU ENNEN KIRJOITUSTA. Kontrolliajo 100 rivillä, joiden tyyppi
 * tiedetään otsikosta: 94 samaa mieltä, 4 tyhjää, 2 eri mieltä.
 * Tarkkuus vastatuissa 98 %. Molemmat erimielisyydet ovat
 * puolustettavia ("Koulun ja päiväkodin peruskorjaus" on aidosti
 * molempia).
 *
 * SÄÄNTÖ VOITTAA LLM:N kun sääntö saa tyypin OTSIKOSTA. Se on mitattu
 * lähes virheettömäksi eikä maksa mitään, joten LLM:ää kysytään vain
 * silloin kun sääntö ei osaa.
 *
 *   npx tsx scripts/backfill-llm-building-type.ts
 *   npx tsx scripts/backfill-llm-building-type.ts --apply --limit=300
 *   npx tsx scripts/backfill-llm-building-type.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "100000"
)

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

const CONCURRENCY = 6

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferBuildingType } = await import("../lib/agent/buildingType")
  const { isBuildingTypeScorerEnabled, BUILDING_TYPES } = await import(
    "../lib/agent/quality/scorers/llmBuildingTypeScorer"
  )
  const { resolveBuildingType } = await import("../lib/agent/quality/resolveBuildingType")

  if (!isBuildingTypeScorerEnabled()) {
    console.log("ANTHROPIC_API_KEY puuttuu")
    return
  }

  const canonical = new Set<string>(BUILDING_TYPES)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("projects").select("*").range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const live = rows.filter((r: any) => r.status === "active" && r.is_public !== false)

  const needsWork = live.filter(
    (r: any) => !r.property_type || !canonical.has(r.property_type)
  )

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n` +
      `  nakyvia hankkeita:        ${live.length}\n` +
      `  kanoninen tyyppi jo:      ${live.length - needsWork.length}\n` +
      `  luokiteltavia:            ${needsWork.length}\n` +
      `  kasitellaan nyt:          ${Math.min(LIMIT, needsWork.length)}\n`
  )

  const work = needsWork.slice(0, LIMIT)

  let cursor = 0
  let fromRule = 0
  let fromLlm = 0
  let blank = 0
  const counts: Record<string, number> = {}
  const samples: string[] = []

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < work.length) {
        const r = work[cursor++]
        const title = String(r.name ?? "")

        /* Sääntö ensin: otsikosta luettu tyyppi on mitattu tarkaksi. */
        let type = inferBuildingType(title, null)
        let source = "saanto"

        if (!type) {
          /*
           * Sama portti kuin putkessa: kaksi kutsua joiden on oltava
           * samaa mieltä. Yksi kutsu antaa noin 10 % vääriä (mitattu
           * 1.9.2026), ja erimielisyys on niiden luotettavin merkki.
           */
          const tulos = await resolveBuildingType({
            title,
            description: String(r.additional_info ?? r.metadata?.description ?? ""),
            ruleBuildingType: null,
          })
          type = (tulos.metadata.building_type as string | undefined) ?? null
          source = "llm"
        }

        if (!type) {
          blank++
          continue
        }

        if (source === "saanto") fromRule++
        else fromLlm++
        counts[type] = (counts[type] ?? 0) + 1

        if (samples.length < 25) {
          samples.push(
            `    ${source.padEnd(7)} ${type.padEnd(18)} ${title.slice(0, 50)}` +
              (r.property_type ? `   (oli: ${r.property_type})` : "")
          )
        }

        if (!APPLY) continue

        await supabase
          .from("projects")
          .update({
            property_type: type,
            metadata: { ...r.metadata, building_type: type },
          })
          .eq("id", r.id)
      }
    })
  )

  console.log(`  saannosta: ${fromRule}`)
  console.log(`  LLM:lta:   ${fromLlm}`)
  console.log(`  tyhjaksi:  ${blank}\n`)

  console.log("jakauma:")
  for (const [t, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${t}`)
  }

  console.log("\nnayte:")
  for (const s of samples) console.log(s)

  /*
   * JONO KORJATAAN SAMALLA AJOLLA.
   *
   * Ehdokas kantaa kohdetyypin metadata.building_type-kentassa, ja
   * hyvaksynta kopioi sen hankkeen property_type-kenttaan. Jonossa
   * odottava ehdokas ilman tyyppia syntyy hyvaksyttaessa ilman tyyppia,
   * eli sama aukko uudestaan. Uudet ehdokkaat saavat tyypin putkessa
   * (resolveBuildingType), mutta jo jonossa olevat eivat.
   */
  const { data: jono, error: jonoErr } = await supabase
    .from("potential_projects")
    .select("id,title,metadata")
    .eq("status", "new")
  if (jonoErr) throw jonoErr

  const jonossa = (jono ?? []).filter(
    (r: any) => !String(r.metadata?.building_type ?? "").trim()
  )

  console.log(`
JONO: ${jono?.length ?? 0} ehdokasta, ilman kohdetyyppia ${jonossa.length}`)

  for (const r of jonossa) {
    const title = String((r as any).title ?? "")
    const md: any = (r as any).metadata ?? {}
    let type = inferBuildingType(title, null)
    let source = "saanto"
    if (!type) {
      const tulos = await resolveBuildingType({
        title,
        description: String(md.description ?? md.operation ?? ""),
        ruleBuildingType: null,
      })
      type = (tulos.metadata.building_type as string | undefined) ?? null
      source = "llm"
    }

    console.log(`  ${source.padEnd(7)} ${String(type ?? "-").padEnd(18)} ${title.slice(0, 52)}`)

    if (!APPLY || !type) continue

    await supabase
      .from("potential_projects")
      .update({
        metadata: { ...md, building_type: type, building_type_source: source },
      })
      .eq("id", (r as any).id)
  }

}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
