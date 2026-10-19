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
 * VEXATEC LAHTEEKSI (D-322).
 *
 * Pelkka keraajan committaaminen ei riita: lahde tarvitsee rivin
 * `discovery_sources`-tauluun (D-001).
 *
 * Tulostaa ensin mita ajo toisi ja kuinka moni on jo kannassa -- sama
 * tapa kuin Oteranilla: paallekkaisyys mitataan seka lahde-URL:lla
 * etta nimen tunnistesanalla, koska osa kohteista on tullut kantaan
 * muuta kautta eri osoitteella.
 *
 *   npx tsx scripts/lisaa-vexatec-lahde.ts
 *   npx tsx scripts/lisaa-vexatec-lahde.ts --apply
 */

const APPLY = process.argv.includes("--apply")

const RIVI = {
  id: "legacy-vexatec",
  name: "Vexatec ajankohtaista",
  type: "html",
  category: "company_project",
  url: "https://vexatec.fi/ajankohtaista/",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "vexatec",
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: jo, error } = await db
    .from("discovery_sources")
    .select("id, name, parser, enabled")
    .or(`id.eq.${RIVI.id},parser.eq.${RIVI.parser}`)
  if (error) throw error
  if (jo?.length) {
    console.log(`Lähde on jo olemassa: ${JSON.stringify(jo)}`)
    return
  }

  const { sources } = await import("../lib/agent/sources")
  const lahde = (sources as any[]).find((s) => s.name === RIVI.parser)
  if (!lahde) {
    console.log(`EI LISÄTÄ – parseria "${RIVI.parser}" ei ole rekisterissä`)
    return
  }

  const alkoi = Date.now()
  const kandidaatit = await lahde.fetch()
  console.log(`haku ${((Date.now() - alkoi) / 1000).toFixed(1)} s, kandidaatteja ${kandidaatit.length}`)
  console.log(`   kaupunki       ${kandidaatit.filter((k: any) => k.city).length}`)
  console.log(`   kuvaus         ${kandidaatit.filter((k: any) => k.description).length}`)
  console.log(`   pääurakoitsija ${kandidaatit.filter((k: any) => k.builder).length}`)
  console.log(`   rakennuttaja   ${kandidaatit.filter((k: any) => k.developer).length}`)

  /* Paallekkaisyys: sama lahde-URL tai sama tunnistesana nimessa. */
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data } = await db.from("projects").select("name, metadata").range(a, a + 999)
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`\n(verrattu ${hankkeet.length} hankkeeseen)\n`)

  for (const k of kandidaatit as any[]) {
    const url = String(k.source_url ?? "")
    const urlOsuma = hankkeet.find((p) => String(p.metadata?.source_url ?? "") === url)
    /* Tunnistesana: pisin yli 6 merkin sana, taivutus pois. */
    const sana =
      String(k.name)
        .split(/[\s,–-]+/)
        .filter((s) => s.length > 6)
        .sort((a, b) => b.length - a.length)[0] ?? ""
    const kanta = sana.slice(0, Math.max(5, sana.length - 3)).toLowerCase()
    const nimiOsuma = kanta
      ? hankkeet.find((p) => String(p.name ?? "").toLowerCase().includes(kanta))
      : undefined

    console.log(`   ${String(k.name).slice(0, 56).padEnd(58)} ${k.city ?? "-"}`)
    if (urlOsuma) console.log(`      JO KANNASSA samalla osoitteella: ${String(urlOsuma.name).slice(0, 50)}`)
    else if (nimiOsuma) console.log(`      ehkä sama: "${String(nimiOsuma.name).slice(0, 50)}" (tunnistesana "${kanta}")`)
    else console.log(`      uusi`)
  }

  if (!APPLY) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e1 } = await db.from("discovery_sources").insert(RIVI)
  if (e1) {
    console.error(`VIRHE: ${e1.message}`)
    process.exit(1)
  }
  console.log(`\nLähde lisätty: ${RIVI.name}`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
