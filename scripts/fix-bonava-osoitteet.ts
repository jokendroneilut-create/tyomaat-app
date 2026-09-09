import { readFileSync } from "node:fs"

/*
 * BONAVAN KOHTEIDEN OSOITTEET TAKAUTUVASTI.
 *
 * Kerääjä luki osoitteen asuntoesittelyn laatikosta, joka on väärä
 * kenttä: se puuttuu kokonaan `Planned`-vaiheen sivuilta ja on
 * myyntitoimiston osoite silloin kun esittely ei ole työmaalla.
 * Yläpalkin osoite oli mitattuna oikein 13/13 (D-183).
 *
 * UUSI SIVUHAKU ON PAKKO TEHDÄ: lähdedokumentit ovat tälle lähteelle
 * pelkkiä tynkiä (`awaiting_body`), joten HTML ei ole tallessa.
 * Sivuja on 13 ja niiden välissä pidetään tauko.
 *
 * VAIN LISÄYS JA KORJAUS, EI TYHJENNYSTÄ: osoitetta ei koskaan
 * korvata tyhjällä.
 *
 *   npx tsx scripts/fix-bonava-osoitteet.ts
 *   npx tsx scripts/fix-bonava-osoitteet.ts --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const VIIVE_MS = 1500

const nuku = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { bonavaOsoite } = await import("../lib/agent/fetchBonavaKohteetSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Vain ne sivut joista kannassa oikeasti on rivi - ei koko sitemappia. */
  const urlit = new Set<string>()
  const rivit: any[] = []

  for (const table of ["potential_projects", "projects"] as const) {
    const columns =
      table === "potential_projects"
        ? "id, title, address, metadata"
        : "id, name, location, metadata"

    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      for (const row of data ?? []) {
        if ((row as any).metadata?.source_name !== "bonava_kohteet") continue
        const url = String((row as any).metadata?.source_url ?? "")
        if (!url) continue
        urlit.add(url)
        rivit.push({ ...(row as any), _taulu: table })
      }
      if (!data || data.length < 1000) break
    }
  }

  console.log(`bonava_kohteet-rivejä ${rivit.length}, sivuja haettavana ${urlit.size}`)

  const osoitteet = new Map<string, string>()
  for (const url of urlit) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } })
      if (!res.ok) {
        console.log(`  HAKU EPÄONNISTUI ${res.status}: ${url}`)
        continue
      }
      const osoite = bonavaOsoite(await res.text())
      if (osoite) osoitteet.set(url, osoite)
      else console.log(`  EI OSOITETTA SIVULLA: ${url}`)
    } catch (e) {
      console.log(`  VIRHE: ${url}`)
    }
    await nuku(VIIVE_MS)
  }

  let muuttuu = 0
  let ennallaan = 0

  for (const row of rivit) {
    const uusi = osoitteet.get(String(row.metadata?.source_url ?? ""))
    if (!uusi) continue

    const isQueue = row._taulu === "potential_projects"
    const vanha = isQueue ? row.address : row.location

    if (String(vanha ?? "").trim() === uusi) {
      ennallaan++
      continue
    }

    muuttuu++
    console.log(
      `\n### ${row._taulu} ${row.title ?? row.name}\n` +
        `  ${JSON.stringify(vanha)} → ${JSON.stringify(uusi)}`
    )

    if (!APPLY) continue

    const metadata = {
      ...(row.metadata ?? {}),
      field_sources: { ...(row.metadata?.field_sources ?? {}), location: "yläpalkki" },
      address_fixed_at: new Date().toISOString(),
    }

    await supabase
      .from(row._taulu)
      .update(isQueue ? { address: uusi, metadata } : { location: uusi, metadata })
      .eq("id", row.id)
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`osoite muuttuu:   ${muuttuu}`)
  console.log(`jo oikein:        ${ennallaan}`)
  console.log(
    "\nMuista ajaa tämän jälkeen: npx tsx scripts/fix-karkeat-sijainnit.ts --apply\n" +
      "(uusi katuosoite tarkentaa kaupunkitason pisteen talotasolle)"
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
