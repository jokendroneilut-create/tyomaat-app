/*
 * Ajaa yrityslähteiden rikastuskoukun JO TALLENNETTUJEN rivien yli.
 *
 * MIKSI TÄTÄ TARVITAAN. `createCompanyEnricher` (lib/agent/companyRelease.ts)
 * hakee tiedotesivun leipätekstin ja päättelee siitä kuvauksen, osapuolet,
 * vaiheen ja kohdetyypin. Se toimii — mitattu 15.8.2026: kuvaus 100 %
 * kahdeksalla testatulla lähteellä. Mutta tuonnissa koukkua kutsutaan vain
 * VIELÄ NÄKEMÄTTÖMILLE osoitteille (legacyFetchCollector: `seenUrls`), ja
 * budjetti on 40 kandidaattia per ajo. Jo kertaalleen tuotu kuvaukseton rivi
 * ei siis koskaan täydenny itsestään.
 *
 * Kuvaukseton ehdokas hylätään katselmoinnissa lähes aina (D-027), eikä
 * tyhjästä tekstistä voi poimia euromäärää (D-072). Tämä skripti purkaa sen
 * kertyneen jäämän.
 *
 * VARMUUS ENNEN KATTAVUUTTA: ei ylikirjoita olemassa olevaa tietoa muuten
 * kuin kuvauksen osalta (tiedotteen teksti on aina parempi kuin listauksen
 * tiivistelmä), eikä koskaan peruuta hankkeen vaihetta taaksepäin.
 *
 *   npx tsx scripts/backfill-company-enrichment.ts
 *   npx tsx scripts/backfill-company-enrichment.ts --apply
 *   npx tsx scripts/backfill-company-enrichment.ts --only=fira,marvea --limit=20
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const ONLY = process.argv
  .find((a) => a.startsWith("--only="))
  ?.split("=")[1]
  ?.split(",")
  .map((s) => s.trim())
const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 40
)

/* Lyhyempi kuvaus kuin tämä = listauksen tiivistelmä, ei tiedotteen teksti. */
const SHORT_DESCRIPTION = 400

/*
 * TYHJÄ MERKKIJONO ON YHTÄ TYHJÄ KUIN NULL.
 *
 * Ensimmäinen versio käytti `??`, joka korvaa vain null/undefined. Kannassa
 * kuvaus ja osapuolet ovat kuitenkin usein `""`, jolloin `r.additional_info ??
 * description` palautti tyhjän merkkijonon ja rikastus meni hukkaan juuri
 * siinä kentässä jonka asiakas näkee. Mitattu 15.8.2026: 124 rikastetusta
 * hankkeesta vain 7:llä kuvaus päätyi perille.
 */
const firstFilled = (...values: any[]) =>
  values.find((v) => v !== null && v !== undefined && String(v).trim() !== "") ?? null

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
  const { sources } = await import("../lib/agent/sources")
  const { resolveProjectCost } = await import("../lib/projects/resolveProjectCost")
  const { phaseAdvances } = await import("../lib/projects/phases")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const enrichable = (sources as any[]).filter(
    (s) => typeof s.enrich === "function" && (!ONLY || ONLY.includes(s.name))
  )

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}` +
      `  |  lähteitä ${enrichable.length}, katto ${LIMIT}/lähde\n`
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

  const queue = await page("potential_projects", "id, title, metadata")
  const live = await page(
    "projects",
    "id, name, phase, city, location, developer, builder, property_type, estimated_cost, additional_info, metadata"
  )

  const sourceNamesOf = (md: any) => {
    const hist = Array.isArray(md?.source_history) ? md.source_history : []
    return [md?.source_name, md?.source, md?.firstSourceName, md?.lastSourceName, ...hist.map((h: any) => h?.source_name)]
      .filter(Boolean)
      .map((x: any) => String(x).toLowerCase())
  }

  const urlOf = (md: any) => {
    const hist = Array.isArray(md?.source_history) ? md.source_history : []
    return md?.source_url ?? hist.find((h: any) => h?.source_url)?.source_url ?? null
  }

  let totalQueue = 0
  let totalLive = 0

  for (const source of enrichable) {
    const name = String(source.name).toLowerCase()
    const belongs = (md: any) => sourceNamesOf(md).some((n: string) => n.includes(name))

    const qRows = queue
      .filter((r: any) => belongs(r.metadata))
      .filter((r: any) => String(r.metadata?.description ?? "").length < SHORT_DESCRIPTION)
      .filter((r: any) => urlOf(r.metadata))
      .slice(0, LIMIT)

    const lRows = live
      .filter((r: any) => belongs(r.metadata))
      .filter(
        (r: any) =>
          String(r.additional_info ?? r.metadata?.description ?? "").length < SHORT_DESCRIPTION
      )
      .filter((r: any) => urlOf(r.metadata))
      .slice(0, LIMIT)

    if (!qRows.length && !lRows.length) continue

    console.log(`${source.name}: jonossa ${qRows.length}, hankkeissa ${lRows.length}`)

    for (const r of qRows) {
      const enriched = await source.enrich({
        name: r.title,
        source_url: urlOf(r.metadata),
        city: r.metadata?.city ?? null,
        location: r.metadata?.location ?? null,
        developer: r.metadata?.developer ?? null,
        builder: r.metadata?.builder ?? null,
      })

      const description = String(enriched?.description ?? "")
      if (description.length < SHORT_DESCRIPTION) continue

      const cost = resolveProjectCost({
        contractValue: r.metadata?.contract_value,
        text: `${r.title} ${description}`,
        existingCost: r.metadata?.estimated_cost,
        existingSource: r.metadata?.cost_source,
      })

      totalQueue++
      console.log(
        `   [jono] ${String(r.title).slice(0, 44).padEnd(46)} kuvaus ${description.length} mrk` +
          `${enriched.builder ? ` | urakoitsija ${enriched.builder}` : ""}` +
          `${cost ? ` | ${(cost.estimated_cost / 1_000_000).toFixed(1)} M€` : ""}`
      )

      if (!APPLY) continue

      const { error } = await supabase
        .from("potential_projects")
        .update({
          metadata: {
            ...r.metadata,
            description,
            city: firstFilled(r.metadata?.city, enriched.city),
            location: firstFilled(r.metadata?.location, enriched.location),
            developer: firstFilled(r.metadata?.developer, enriched.developer),
            builder: firstFilled(r.metadata?.builder, enriched.builder),
            building_type: firstFilled(r.metadata?.building_type, enriched.building_type),
            phase_hint: firstFilled(enriched.phase, r.metadata?.phase_hint),
            ...(cost
              ? { estimated_cost: cost.estimated_cost, cost_source: cost.cost_source }
              : {}),
            enriched_at: new Date().toISOString(),
          },
        })
        .eq("id", r.id)

      if (error) console.log(`      VIRHE: ${error.message}`)
    }

    for (const r of lRows) {
      const enriched = await source.enrich({
        name: r.name,
        source_url: urlOf(r.metadata),
        city: r.city,
        location: r.location,
        developer: r.developer,
        builder: r.builder,
      })

      const description = String(enriched?.description ?? "")
      if (description.length < SHORT_DESCRIPTION) continue

      const cost = resolveProjectCost({
        contractValue: r.metadata?.contract_value,
        text: `${r.name} ${description}`,
        existingCost: r.estimated_cost,
        existingSource: r.metadata?.cost_source,
      })

      /* Vaihe saa edetä muttei peruuttaa - sama sääntö kuin tuonnissa. */
      const nextPhase = phaseAdvances(r.phase, enriched.phase) ? enriched.phase : r.phase
      const costChanged =
        cost !== null && Number(cost.estimated_cost) !== Number(r.estimated_cost ?? 0)

      totalLive++
      console.log(
        `   [hanke] ${String(r.name).slice(0, 44).padEnd(46)} kuvaus ${description.length} mrk` +
          `${!r.builder && enriched.builder ? ` | urakoitsija ${enriched.builder}` : ""}` +
          `${nextPhase !== r.phase ? ` | vaihe ${r.phase} -> ${nextPhase}` : ""}` +
          `${costChanged ? ` | ${(cost!.estimated_cost / 1_000_000).toFixed(1)} M€` : ""}`
      )

      if (!APPLY) continue

      const { error } = await supabase
        .from("projects")
        .update({
          additional_info: firstFilled(r.additional_info, description),
          city: firstFilled(r.city, enriched.city),
          location: firstFilled(r.location, enriched.location),
          developer: firstFilled(r.developer, enriched.developer),
          builder: firstFilled(r.builder, enriched.builder),
          property_type: firstFilled(r.property_type, enriched.building_type),
          phase: nextPhase,
          ...(costChanged ? { estimated_cost: cost!.estimated_cost } : {}),
          metadata: {
            ...r.metadata,
            description,
            ...(cost
              ? { estimated_cost: cost.estimated_cost, cost_source: cost.cost_source }
              : {}),
            enriched_at: new Date().toISOString(),
          },
        })
        .eq("id", r.id)

      if (error) console.log(`      VIRHE: ${error.message}`)
    }
  }

  console.log(`\nyhteensä: jonorivejä ${totalQueue}, hankkeita ${totalLive}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
