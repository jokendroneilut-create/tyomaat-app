import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ONKO RAKENNUSLEHDEN HANKE JO MEILLA TOISESTA LAHTEESTA?
 *
 * Rakennuslehti on mitattuna heikoin lahde per hanke (yhteyshenkilo
 * 16 %:lla, kasin muokattu 46 %:lla). Epailys: se kertoo samat hankkeet
 * jotka saamme muualta, mutta ohuempana.
 *
 * Kaytetaan TUOTANNON omaa tasmayttajaa (`findProjectMatchDetailed`) eika
 * omatekoista nimivertailua: ensimmainen yritys antoi 28 osumaa 57:sta,
 * joista luettuna suuri osa oli vaaria ("Tampereen taidemuseo" <->
 * "Tampereen Aqua"). Hyvaksynta kayttaa samoja rajoja: >= 70 yhdistaa,
 * 40-69 merkitaan `possible_duplicate_of`.
 *
 *   npx tsx scripts/measure-rakennuslehti-laukaisin.ts
 */

const LAHDE = "rakennuslehti"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select(cols).range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return out
  }

  const projektit: any[] = await kaikki(
    "projects",
    "id, name, city, region, location, is_public, status, developer, builder, contractor, metadata, created_at"
  )
  const rl = projektit.filter((p) => p.metadata?.source_name === LAHDE)
  const muut = projektit.filter((p) => p.metadata?.source_name !== LAHDE)

  console.log(`Rakennuslehti-hankkeita ${rl.length}, vertailujoukko ${muut.length}\n`)

  /* Mika osa on JO merkitty mahdolliseksi duplikaatiksi hyvaksynnassa? */
  const merkitty = rl.filter((p) => p.metadata?.possible_duplicate_of)
  console.log(`hyvaksynnassa merkitty possible_duplicate_of: ${merkitty.length}`)

  /* Parit duplikaattijonossa. */
  const parit: any[] = await kaikki("project_duplicate_candidates", "project_id_a, project_id_b, status, confidence")
  const rlIds = new Set(rl.map((p) => p.id))
  const rlParit = parit.filter((x) => rlIds.has(x.project_id_a) || rlIds.has(x.project_id_b))
  const tila = new Map<string, number>()
  for (const x of rlParit) tila.set(String(x.status), (tila.get(String(x.status)) ?? 0) + 1)
  console.log(`duplikaattipareja joissa Rakennuslehti: ${rlParit.length}`, [...tila].map(([k, v]) => `${k} ${v}`).join(", "))

  console.log("\n=== tuotannon tasmayttaja nyt ===")
  const luokat = { yli70: 0, v40_69: 0, alle40: 0, eiOsumaa: 0 }
  const osumat: any[] = []

  for (const p of rl) {
    const tulos = findProjectMatchDetailed(muut as any, {
      name: p.name,
      sourceTitle: p.metadata?.source_title ?? null,
      city: p.city,
      region: p.region,
      location: p.location,
      permitNumber: p.metadata?.permit_number ?? null,
      propertyId: p.metadata?.property_id ?? null,
      developer: p.developer ?? p.metadata?.developer ?? null,
      buildingType: p.metadata?.building_type ?? null,
    } as any)

    if (!tulos) { luokat.eiOsumaa++; continue }
    if (tulos.confidence >= 70) luokat.yli70++
    else if (tulos.confidence >= 40) luokat.v40_69++
    else { luokat.alle40++; continue }

    osumat.push({ p, tulos })
  }

  console.log(`  >= 70 (yhdistaisi):        ${luokat.yli70}`)
  console.log(`  40-69 (mahd. duplikaatti): ${luokat.v40_69}`)
  console.log(`  < 40:                      ${luokat.alle40}`)
  console.log(`  ei osumaa:                 ${luokat.eiOsumaa}`)

  console.log("\nosumat luettavaksi:")
  for (const { p, tulos } of osumat.sort((a, b) => b.tulos.confidence - a.tulos.confidence)) {
    console.log(`${String(tulos.confidence).padStart(3)}  ${String(p.city ?? "-").padEnd(11)} ${String(p.name).slice(0, 54)}`)
    console.log(`     ${String(tulos.project.metadata?.source_name ?? "-").padEnd(22)} ${String(tulos.project.name).slice(0, 58)}`)
    console.log(`     syyt: ${(tulos.reasons ?? []).join(", ").slice(0, 80)}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
