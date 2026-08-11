/*
 * Täydentää puuttuvan kunnan olemassa oleviin riveihin.
 *
 * KAKSI TASOA, JA MOLEMMAT VAATIVAT PERUSTEEN.
 *
 * Taso 1: kunta mainitaan ilmoituksen omassa tekstissä (otsikko tai
 * kuvaus). Tämä on vahvin signaali - teksti kertoo missä työ tehdään.
 *
 * Taso 2: tilaajan osoite, mutta VAIN kun tilaaja on paikallinen -
 * yhden kohteen kiinteistöyhtiö tai kunta itse.
 *
 * TILAAJAN OSOITE EI OLE HANKKEEN SIJAINTI. Mitattu 12.8.2026: kun
 * molemmat signaalit olivat olemassa, ne olivat eri mieltä 16 kertaa
 * 24:stä. Metsähallitus tilaa Helsingin-osoitteesta moottorikelkkaurat
 * Lappiin ja ELY Oulusta tilusjärjestelyt Nivalaan. Siksi osoitetta
 * käytetään vain kun tilaajan luonne takaa paikallisuuden, ja muuten
 * kunta jätetään tyhjäksi - tyhjä on parempi kuin väärä.
 *
 *   npx tsx scripts/backfill-missing-municipality.ts
 *   npx tsx scripts/backfill-missing-municipality.ts --apply
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

const MUNICIPAL_BUYER = /\bkunta\b|\bkunnan\b|kaupunki|kaupungin/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { detectCityFromText } = await import("../lib/agent/detectCityFromText")
  const { getMunicipalityByName } = await import("../lib/geo/municipalities")
  const { isSinglePropertyCompany } = await import(
    "../lib/geo/municipalityFromName"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const cityFromAddress = (addr: unknown): string | null => {
    const m = String(addr ?? "").match(/\b\d{5}\s+([A-Za-zÅÄÖåäö\- ]+?)\s*(?:FIN?|FI)?\s*$/)
    if (!m) return null
    return getMunicipalityByName(m[1].trim())?.name ?? null
  }

  const resolve = (title: string, md: any): { city: string; tier: 1 | 2 } | null => {
    const fromText = detectCityFromText(`${title ?? ""} ${md?.description ?? ""}`)
    if (fromText) return { city: fromText, tier: 1 }

    const buyer = String(md?.developer ?? "")
    const fromAddress = cityFromAddress(md?.buyer_address)
    if (!fromAddress) return null

    const local = isSinglePropertyCompany(buyer) || MUNICIPAL_BUYER.test(buyer)
    return local ? { city: fromAddress, tier: 2 } : null
  }

  for (const [table, titleCol, cityCol] of [
    ["potential_projects", "title", "municipality"],
    ["projects", "name", "city"],
  ] as const) {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select(`id, ${titleCol}, ${cityCol}, metadata`)
        .range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const missing = rows.filter((r) => !r[cityCol])
    const hits = missing
      .map((r) => ({ r, hit: resolve(r[titleCol], r.metadata) }))
      .filter((x) => x.hit) as { r: any; hit: { city: string; tier: 1 | 2 } }[]

    const t1 = hits.filter((x) => x.hit.tier === 1).length
    const t2 = hits.filter((x) => x.hit.tier === 2).length

    console.log(
      `\n${table}: ${rows.length} rivia, ilman kuntaa ${missing.length}` +
        `\n  taso 1 (teksti):            ${t1}` +
        `\n  taso 2 (paikallinen tilaaja): ${t2}` +
        `\n  jatetaan tyhjaksi:          ${missing.length - hits.length}`
    )

    for (const x of hits.filter((h) => h.hit.tier === 2).slice(0, 6)) {
      console.log(
        `    [2] ${x.hit.city.padEnd(13)} ${String(x.r.metadata?.developer ?? "?").slice(0, 30).padEnd(32)} ${String(x.r[titleCol]).slice(0, 38)}`
      )
    }

    if (!APPLY) continue

    let done = 0
    for (const { r, hit } of hits) {
      const { getMunicipalityByName: byName } = await import("../lib/geo/municipalities")
      const region = byName(hit.city)?.region ?? r.metadata?.region ?? null

      const { error } = await supabase
        .from(table)
        .update({
          [cityCol]: hit.city,
          metadata: { ...(r.metadata ?? {}), region },
          ...(table === "projects" ? { region } : {}),
        })
        .eq("id", r.id)
      if (error) console.log(`    VIRHE ${r.id}: ${error.message}`)
      else done++
    }
    console.log(`  paivitetty: ${done}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
