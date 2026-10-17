import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HILMAN HISTORIA TAKAUTUVASTI (D-297).
 *
 * Keruumme alkaa 8.7.2026, ja silmukka pysahtyy cutoffiin, joten sita
 * vanhempia ilmoituksia ei ole koskaan haettu. Mitattu 17.10.2026:
 * huhtikuusta alkaen **1 250 ilmoitusta** joita meilla ei ole
 * (ContractNotices 854, ContractAwardNotices 327).
 *
 * Elo-lokakuussa puuttuvia on 2, 12 ja 3 — eli keraain toimii nyt, ja
 * tama on kertaluonteinen aukon paikkaus eika toistuva ajo.
 *
 * KAYTTAA KERAIMEN OMAA FUNKTIOTA, ei omaa tuontia: sama rivimuoto,
 * sama dedupaus `document_url`:n mukaan, sama jatkokasittely. Vain
 * ikkuna ja sivukatto annetaan ohituksena.
 *
 * HUOM: tuo ehdokkaita katselmointijonoon. Kuivaharjoitus kertoo
 * maaran ennen ajoa.
 *
 *   npx tsx scripts/taydenna-hilma-historia.ts 90
 *   npx tsx scripts/taydenna-hilma-historia.ts 90 --apply
 */

const URL_ = "https://api.hankintailmoitukset.fi/avp/eformnotices/docs/search"

async function sivu(apiKey: string, skip: number) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": apiKey },
    body: JSON.stringify({
      search: "cpvCodes:(45*)",
      top: 100,
      skip,
      count: true,
      searchMode: "any",
      orderby: "datePublished desc",
    }),
    cache: "no-store",
  })
  if (!r.ok) return null
  const j: any = await r.json()
  return (j?.value ?? []) as any[]
}

async function main() {
  const apply = process.argv.includes("--apply")
  const paivat = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 90)
  const apiKey = process.env.HILMA_API_KEY
  if (!apiKey) {
    console.error("HILMA_API_KEY puuttuu")
    process.exit(1)
  }

  const raja = new Date()
  raja.setUTCDate(raja.getUTCDate() - paivat)
  const rajaPvm = raja.toISOString().slice(0, 10)

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`ikkuna: ${paivat} vuorokautta eli ${rajaPvm} alkaen\n`)

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /*
   * Vain noticeId, ei koko raw_payloadia: `original`-olio on noin 4 kB
   * rivia kohden, ja koko kentan lukeminen 1 561 rivilta aikakatkaistiin.
   */
  const docs: any[] = []
  for (let a = 0; ; a += 500) {
    const { data, error } = await db
      .from("source_documents")
      .select("noticeId:raw_payload->noticeId")
      .eq("source_id", "hilma")
      .range(a, a + 499)
    if (error) {
      console.error("VIRHE:", error.message)
      process.exit(1)
    }
    docs.push(...(data ?? []))
    if ((data ?? []).length < 500) break
  }
  const omat = new Set(docs.map((d) => String(d.noticeId ?? "")))
  console.log(`meilla nyt ${omat.size} Hilma-ilmoitusta`)

  /*
   * SKANNAUS VAIN KUIVAHARJOITUKSESSA. Ensimmainen versio skannasi myos
   * --apply-ajossa, jolloin rajapinta palautti 429 heti varsinaisen haun
   * alussa: skannaus oli jo kayttanyt kiintion.
   */
  if (!apply) {
  let uusia = 0
  const kuukaudet = new Map<string, number>()
  const tyypit = new Map<string, number>()
  for (let s = 0; s < 60; s++) {
    const rivit = await sivu(apiKey, s * 100)
    if (!rivit?.length) break
    let ohi = false
    for (const r of rivit) {
      const p = String(r.datePublished ?? "").slice(0, 10)
      if (p && p < rajaPvm) {
        ohi = true
        continue
      }
      if (!/^45/.test(String(r.cpvCodes ?? ""))) continue
      if (omat.has(String(r.noticeId ?? ""))) continue
      uusia++
      kuukaudet.set(p.slice(0, 7), (kuukaudet.get(p.slice(0, 7)) ?? 0) + 1)
      tyypit.set(String(r.mainType ?? "?"), (tyypit.get(String(r.mainType ?? "?")) ?? 0) + 1)
    }
    if (ohi) break
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log(`\nUUSIA ilmoituksia ikkunassa: ${uusia}`)
  console.log(`  tyypeittain: ${[...tyypit].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`)
  console.log(`  kuukausittain:`)
  for (const [k, v] of [...kuukaudet].sort()) console.log(`    ${k}  ${v}`)

    console.log(`\nEi haettu mitaan. Aja --apply kun luvut on luettu.`)
    return
  }

  const { data: lahde, error: le } = await db
    .from("discovery_sources")
    .select("*")
    .eq("parser", "hilmaParser")
    .maybeSingle()
  if (le || !lahde) {
    console.error(`VIRHE: Hilma-lahdetta ei loytynyt (${le?.message ?? "ei rivia"})`)
    process.exit(1)
  }

  console.log(`\nhaetaan keraimen omalla funktiolla...`)
  const { collectHilmaSource } = await import("../lib/agent/discovery/collectors/apiCollector")
  const t0 = Date.now()
  const tulos = await collectHilmaSource(lahde as any, paivat, 60)
  console.log(`valmis ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  console.log(`  loydetty ${(tulos as any)?.documentsFound}, tallennettu ${(tulos as any)?.documentsSaved}`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
