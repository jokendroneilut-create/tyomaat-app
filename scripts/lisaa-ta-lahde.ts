import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TA-YHTIOIDEN TIEDOTTEET KANTAAN (D-254).
 *
 * Keraaja on `lib/agent/sources.ts`:ssa; tama lisaa rivin
 * `discovery_sources`-tauluun. Perustaso (priority 10, kerran
 * vuorokaudessa), EI taattua paikkaa: TA julkaisee noin kaksi
 * hanketiedotetta kuukaudessa (D-210).
 *
 *   npx tsx scripts/lisaa-ta-lahde.ts            (kuivaharjoitus)
 *   npx tsx scripts/lisaa-ta-lahde.ts --apply
 */
const APPLY = process.argv.includes("--apply")

/*
 * company_project kuten Kastelli, Heka ja Espoon Asunnot: legacy-keraaja,
 * julkaisija on hankkeen osapuoli. developer_release on saatioiden
 * tiedotevirta (`foundationReleaseParser`), ja kuivaharjoituksessa se
 * tunnisti TA:n 26 tiedotteesta vain 7: 18 putosi 180 vrk:n
 * arkistorajaan, jota tiedotelahteiden 12 kk:n ikkuna (D-226) ei tunne.
 */
const RIVI = {
  id: "legacy-ta-yhtiot",
  name: "TA-Yhtiöt tiedotteet",
  type: "html",
  category: "company_project",
  url: "https://ta.fi/tiedotteet/",
  priority: 10,
  enabled: true,
  refresh_minutes: 1440,
  collector: "legacyFetchCollector",
  parser: "ta_yhtiot",
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: jo } = await db.from("discovery_sources").select("id, name, parser").eq("id", RIVI.id).maybeSingle()
  if (jo) { console.log("Lahde on jo olemassa:", JSON.stringify(jo)); return }

  const { sources } = await import("../lib/agent/sources")
  const lahde = (sources as any[]).find((s) => s.name === RIVI.parser)
  if (!lahde) { console.log(`EI LISATA - parseria "${RIVI.parser}" ei ole rekisterissa`); return }

  const alkoi = Date.now()
  const kandidaatit = await lahde.fetch()
  console.log(`haku ${((Date.now() - alkoi) / 1000).toFixed(1)} s, kandidaatteja ${kandidaatit.length}`)
  console.log(`  kaupunki         ${kandidaatit.filter((k: any) => k.city).length}`)
  console.log(`  osoite           ${kandidaatit.filter((k: any) => k.location).length}`)
  console.log(`  paaurakoitsija   ${kandidaatit.filter((k: any) => k.builder).length}`)
  console.log(`  valmistumispaiva ${kandidaatit.filter((k: any) => k.estimated_completion).length}`)
  console.log(`  asuntomaara      ${kandidaatit.filter((k: any) => k.metadata?.apartments).length}`)
  console.log(`  valmiiksi merkittyja ${kandidaatit.filter((k: any) => k.completed).length}`)

  /*
   * PAALLEKKAISYYS OLEMASSA OLEVAAN. Lahde-URL on `metadata`-kentassa,
   * ei omana sarakkeenaan (D-250); virhe heitetaan eika nielaista.
   */
  const urlit = kandidaatit.map((k: any) => k.source_url).filter(Boolean)
  let jo_kannassa = 0
  for (let i = 0; i < urlit.length; i += 100) {
    const { count, error } = await db
      .from("potential_projects")
      .select("id", { count: "exact", head: true })
      .in("metadata->>source_url", urlit.slice(i, i + 100))
    if (error) throw error
    jo_kannassa += count ?? 0
  }
  console.log(`  jo potential_projects-taulussa (sama source_url): ${jo_kannassa}`)

  /*
   * Uusi lahde, joten URL-osumia ei odoteta. Katuosoitehaku (ilman
   * porraskirjainta, jotta "Kangastie 13 B" loytaa myos "Kangastie 13")
   * projects- ja potential_projects-tauluihin kertoo mitka kohteet ovat
   * jo kannassa muista lahteista ja tulevat siis kaksoiskappaleina jonoon.
   * Osoitteettomille haetaan nimen avainsanalla.
   */
  console.log("\nkandidaatit (KANNASSA = projects / JONOSSA = potential_projects, osoite tai nimi):")
  for (const k of kandidaatit) {
    const avain = k.location ? k.location.replace(/^(\S+\s+\d+).*$/, "$1") : null
    const haku = avain ?? k.name.match(/Herttuankulma|Kartanonran|Hatanpä/u)?.[0] ?? null
    let projektit: string[] = []
    let jonossa: string[] = []
    if (haku) {
      const p = await db.from("projects").select("name, developer, builder")
        .or(`location.ilike.%${haku}%,name.ilike.%${haku}%`).limit(5)
      if (p.error) throw p.error
      projektit = (p.data ?? []).map((r: any) => `${r.name} [${r.developer ?? "-"} / ${r.builder ?? "-"}]`)
      const q = await db.from("potential_projects").select("title, status")
        .or(`address.ilike.%${haku}%,title.ilike.%${haku}%`).limit(5)
      if (q.error) throw q.error
      jonossa = (q.data ?? []).map((r: any) => `${r.title} (${r.status})`)
    }
    console.log(`  - [${k.phase}] ${k.city ?? "-"} | ${k.name}`)
    console.log(`      haku="${haku ?? "-"}"  ${projektit.length ? `KANNASSA: ${projektit.join(" / ")}` : "ei projects-taulussa"}`)
    if (jonossa.length) console.log(`      JONOSSA: ${jonossa.join(" / ")}`)
  }

  console.log("\nlisattava rivi:")
  console.log(JSON.stringify(RIVI, null, 1))

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error } = await db.from("discovery_sources").insert(RIVI)
  if (error) throw error
  console.log("\n=== LISATTY ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
