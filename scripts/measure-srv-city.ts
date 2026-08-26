import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: mista SRV:n ehdokkaiden kaupunki tulee?
 *
 * Kaksi yhdistymista paljasti vaaran kaupungin: "Luolavuoren koulu"
 * (Turku) ja "Marjoniemen yhtenaiskoulu" (Kouvola) oli molemmat merkitty
 * Helsinkiin. SRV merkitsee 56 % ehdokkaistaan Helsinkiin.
 *
 * Keraaja lukee kaupungin ensin OTSIKOSTA ja vasta sitten koko
 * tiedotteen RUNGOSTA. Runko sisaltaa yhtion yleiskuvauksen, jossa
 * lukee Helsinki.
 *
 * Ei kirjoita mitaan.
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { detectCityFromText } = await import("../lib/agent/detectCityFromText")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id,title,municipality,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const srv = rivit.filter((p) => /^srv$/i.test(String(p.metadata?.source_name ?? "")))
  console.log(`SRV-ehdokkaita: ${srv.length}\n`)

  let otsikosta = 0, rungosta = 0, eiKumpikaan = 0
  const rungostaHki: string[] = []
  const rungostaMuu: string[] = []

  for (const p of srv) {
    const otsikko = detectCityFromText(String(p.title ?? ""))
    if (otsikko) { otsikosta++; continue }

    const runko = detectCityFromText(String(p.metadata?.description ?? ""))
    if (!runko) { eiKumpikaan++; continue }

    rungosta++
    const rivi = `    ${String(p.title).slice(0, 52).padEnd(54)} -> ${runko}`
    if (runko.toLowerCase() === "helsinki") rungostaHki.push(rivi)
    else rungostaMuu.push(rivi)
  }

  console.log(`  kaupunki OTSIKOSTA:   ${otsikosta}  (luotettava)`)
  console.log(`  kaupunki RUNGOSTA:    ${rungosta}`)
  console.log(`    niista Helsinki:    ${rungostaHki.length}`)
  console.log(`    niista muu:         ${rungostaMuu.length}`)
  console.log(`  ei kumpaakaan:        ${eiKumpikaan}\n`)

  console.log("  RUNGOSTA -> Helsinki (naita epaillaan):")
  for (const r of rungostaHki.slice(0, 14)) console.log(r)
  console.log("\n  RUNGOSTA -> muu kaupunki:")
  for (const r of rungostaMuu.slice(0, 8)) console.log(r)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
