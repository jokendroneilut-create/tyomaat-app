/*
 * Täydentää jonossa jo olevat yrityslähteiden ehdokkaat tiedotteen
 * leipätekstillä ja laskee vaiheen, osapuolet ja kohdetyypin uudelleen.
 *
 * Lähteet lukivat aiemmin vain listaussivun otsikon, joten ehdokas syntyi
 * ilman kuvausta ja vaiheeksi tuli aina "Suunnittelussa". Uudet ajot
 * hakevat tiedotesivun jaetulla enrich-koukulla (companyRelease.ts), mutta
 * vanhat rivit eivät täydenny: niiden osoitteet ovat jo "nähtyjen" joukossa,
 * joten kerääjä ohittaa ne.
 *
 * OTSIKKOA EI KOSKETA. Kantaan on tallennettu jo katkaistu otsikko, eikä
 * alkuperäistä saa takaisin ilman sivukohtaista <title>-käsittelyä. Peabin
 * rikkinäiset otsikot korjattiin erikseen (backfill-peab.ts); muilla
 * lähteillä niitä ei mittauksessa ollut.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-company-sources.ts
 *   npx tsx scripts/backfill-company-sources.ts --apply
 *   npx tsx scripts/backfill-company-sources.ts --apply --only=srv,varte
 *   npx tsx scripts/backfill-company-sources.ts --include-rejected --show --limit=50
 *   npx tsx scripts/backfill-company-sources.ts --apply --include-rejected
 *
 * Oletuksena hylättyjä rivejä ei kosketa: ne on jo katselmoitu, eikä
 * täydennys palauta niitä jonoon. --include-rejected korjaa myös ne, jos
 * ne aiotaan käydä uudelleen läpi.
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const INCLUDE_REJECTED = process.argv.includes("--include-rejected")
/* --show tulostaa jokaisen rivin, jotta lopputuloksen voi arvioida silmällä. */
const SHOW = process.argv.includes("--show")
const ONLY = process.argv
  .find((a) => a.startsWith("--only="))
  ?.split("=")[1]
  ?.split(",")
  .map((s) => s.trim())
const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0
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

/* Yksi sivuhaku per rivi; maltillinen rinnakkaisuus riittää. */
const CONCURRENCY = 4

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { sources } = await import("../lib/agent/sources")
  const { getMunicipalityByName } = await import("../lib/geo/municipalities")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Vain ne lähteet joille on rekisteröity enrich-koukku. */
  const enrichers = new Map<string, (c: any) => Promise<any>>()
  for (const s of sources as any[]) {
    if (typeof s.enrich === "function" && (!ONLY || ONLY.includes(s.name))) {
      enrichers.set(s.name, s.enrich)
    }
  }

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, municipality, address, status, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  let targets = rows.filter((r: any) => {
    const md = r.metadata ?? {}
    const source = md.source ?? md.source_name
    if (!enrichers.has(source)) return false
    if (!md.source_url) return false
    if (md.enriched_at) return false
    if (!INCLUDE_REJECTED && r.status === "rejected") return false
    return true
  })

  if (LIMIT > 0) targets = targets.slice(0, LIMIT)

  const bySource: Record<string, number> = {}
  for (const r of targets) {
    const s = r.metadata.source ?? r.metadata.source_name
    bySource[s] = (bySource[s] ?? 0) + 1
  }

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} riviä\n`
  )
  for (const [s, n] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(22)} ${n}`)
  }
  console.log("")
  if (targets.length === 0) return

  const stats = { kuvaus: 0, vaihe: 0, tyyppi: 0, osapuoli: 0, epaonnistui: 0 }

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)

    await Promise.all(
      batch.map(async (row: any) => {
        const md = row.metadata ?? {}
        const source = md.source ?? md.source_name
        const enrich = enrichers.get(source)!

        let enriched: any
        try {
          enriched = await enrich({
            name: row.title,
            description: null,
            city: row.municipality ?? null,
            location: row.address ?? null,
            developer: md.developer ?? null,
            builder: md.builder ?? null,
            source_url: md.source_url,
            source_name: source,
          })
        } catch {
          stats.epaonnistui++
          return
        }

        if (!enriched?.description) {
          stats.epaonnistui++
          return
        }

        if (!md.description) stats.kuvaus++
        if (md.phase_hint !== enriched.phase) stats.vaihe++
        if (!md.building_type && enriched.property_type) stats.tyyppi++
        if ((!md.developer && enriched.developer) || (!md.builder && enriched.builder)) {
          stats.osapuoli++
        }

        if (SHOW) {
          console.log(`\n[${source}${row.status === "rejected" ? " · HYLÄTTY" : ""}] ${row.title}`)
          console.log(
            `  ${md.phase_hint ?? "-"} -> ${enriched.phase}` +
              ` · ${enriched.property_type ?? "tyyppi ?"}` +
              ` · ${enriched.developer ?? "-"} / ${enriched.builder ?? "-"}`
          )
          console.log(`  ${String(enriched.description).slice(0, 160).replace(/\s+/g, " ")}...`)
        }

        if (!APPLY) return

        const city = row.municipality ?? enriched.city ?? null

        const { error } = await supabase
          .from("potential_projects")
          .update({
            municipality: city,
            address: row.address ?? enriched.location ?? null,
            metadata: {
              ...md,
              description: enriched.description,
              developer: enriched.developer ?? md.developer ?? null,
              builder: enriched.builder ?? md.builder ?? null,
              phase_hint: enriched.phase,
              building_type: enriched.property_type ?? md.building_type ?? null,
              region: md.region ?? getMunicipalityByName(city)?.region ?? null,
              estimated_completion:
                enriched.estimated_completion ?? md.estimated_completion ?? null,
              enriched_at: new Date().toISOString(),
            },
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
  console.log(`kuvaus lisätty:      ${stats.kuvaus}`)
  console.log(`vaihe muuttui:       ${stats.vaihe}`)
  console.log(`kohdetyyppi lisätty: ${stats.tyyppi}`)
  console.log(`osapuoli lisätty:    ${stats.osapuoli}`)
  console.log(`epäonnistui:         ${stats.epaonnistui}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
