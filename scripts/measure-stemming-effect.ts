import { readFileSync, writeFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: mita otsikoiden VARTALOINTI tekisi tasmaytykselle?
 *
 * Sanavertailu on tarkka, joten "asuntoa", "asunnoille" ja "asunnot" ovat
 * kolme eri sanaa. Espoonlahden pari jai siksi 50 pisteeseen (kynnys 70)
 * vaikka kyse oli samasta hankkeesta.
 *
 * Tiedostossa on kaksi kirjattua aiempaa yritysta laajentaa
 * otsikkovertailua. Molemmat kasvattivat vaaria osumia ja peruttiin -
 * joten tama mitataan ennen kuin sita ehdotetaan.
 *
 * Aja KAHDESTI ja vertaa:
 *   npx tsx scripts/measure-stemming-effect.ts                (nykytila)
 *   MATCH_STEM=1 npx tsx scripts/measure-stemming-effect.ts   (vartalointi)
 *
 * Kirjoittaa parit tiedostoon, jotta erotus saadaan riveittain luettavaksi.
 * Ei koske kantaan.
 */

const OUT = `scripts/out/pairs-${process.env.MATCH_STEM ?? "base"}.json`

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { calculateMatch } = await import("../lib/agent/projectMatcher")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,city,region,location,phase,status,developer,builder,is_public,metadata")
      .range(from, from + 999)
    if (error) throw error
    projects.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const nakyvat = projects.filter((p) => p.is_public)
  console.log(`vartalointi: ${process.env.MATCH_STEM === "1" ? "PAALLA" : "pois"}`)
  console.log(`nakyvia hankkeita: ${nakyvat.length}`)

  /* Vertailu vain saman kaupungin sisalla, kuten tuotannossakin. */
  const kaupungeittain = new Map<string, any[]>()
  for (const p of nakyvat) {
    const k = String(p.city ?? "").trim().toLowerCase()
    if (!k) continue
    if (!kaupungeittain.has(k)) kaupungeittain.set(k, [])
    kaupungeittain.get(k)!.push(p)
  }

  const asProject = (p: any) => ({
    id: p.id, name: p.name, city: p.city, region: p.region,
    location: p.location ?? null, phase: p.phase, status: p.status,
    developer: p.developer, builder: p.builder,
  })
  const asCandidate = (p: any) => ({
    name: p.name, sourceTitle: p.metadata?.operation ?? p.name,
    city: p.city, region: p.region, location: p.location ?? null,
    propertyId: p.metadata?.property_id ?? null, developer: p.developer,
    buildingType: p.metadata?.building_type ?? null,
    description: p.metadata?.description ?? null,
  })

  const parit: Record<string, { a: string; b: string; nimiA: string; nimiB: string; kaupunki: string; luottamus: number }> = {}
  const kynnykset = [30, 50, 70]
  const laskurit = new Map<number, number>(kynnykset.map((k) => [k, 0]))

  for (const [kaupunki, lista] of kaupungeittain) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const r = calculateMatch(asProject(lista[i]), asCandidate(lista[j]))
        if (!r) continue
        const c = r.confidence ?? 0
        if (c < 30) continue

        for (const k of kynnykset) if (c >= k) laskurit.set(k, (laskurit.get(k) ?? 0) + 1)

        const avain = [lista[i].id, lista[j].id].sort().join("|")
        parit[avain] = {
          a: lista[i].id, b: lista[j].id,
          nimiA: String(lista[i].name), nimiB: String(lista[j].name),
          kaupunki, luottamus: c,
        }
      }
    }
  }

  console.log(`\npareja luottamuksen mukaan:`)
  for (const k of kynnykset) console.log(`  >= ${k}:  ${laskurit.get(k)}`)

  writeFileSync(OUT, JSON.stringify(parit, null, 1), "utf8")
  console.log(`\nkirjoitettu: ${OUT}  (${Object.keys(parit).length} paria)`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
