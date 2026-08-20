import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VAARA RAKENNUTTAJA HELSINGIN PAATOKSISSA.
 *
 * Lahde helsinki_paatokset asettaa rakennuttajaksi aina "Helsingin kaupunki".
 * Mitattu 21.8.2026: kaikilla 519 hankkeella sama arvo. Useimmiten se on
 * oikein - kaupunki paattaa omista kohteistaan - mutta purkamislupa- ja
 * lausuntopaatoksissa hakija on joku muu, ja se lukee paatosotsikossa.
 *
 * Korjataan vain ne joissa hakija on yksiselitteisesti eri organisaatio.
 * Kaupungin omat yhtiot (Heka, Kiinteisto Oy Helsingin Toimitilat) jatetaan
 * ennalleen: ne ovat kaupungin omistamia eika "Helsingin kaupunki" ole vaara.
 *
 * Skripti tarkistaa ennen kirjoitusta etta rivin nimi sisaltaa odotetun
 * organisaation, jottei korjaus osu vaaraan hankkeeseen.
 */

const APPLY = process.argv.includes("--apply")

const FIXES: { expectInName: string; from: string; to: string }[] = [
  {
    expectInName: "Herttoniemen kirkon purkaminen",
    from: "Helsingin kaupunki",
    to: "Helsingin seurakuntayhtymä",
  },
  {
    expectInName: "As Oy Oulunkyläntori 2",
    from: "Helsingin kaupunki",
    to: "Asunto Oy Oulunkyläntori 2",
  },
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, developer, city, is_public, metadata")
      .range(from, from + 999)
    if (error) throw error
    projects.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(APPLY ? "=== AJETTU ===\n" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===\n")

  let fixed = 0

  for (const fix of FIXES) {
    const hits = projects.filter(
      (p) =>
        String(p.name ?? "").includes(fix.expectInName) &&
        String(p.developer ?? "") === fix.from
    )

    if (!hits.length) {
      console.log(`  EI OSUMAA  "${fix.expectInName}" - jo korjattu tai nimi muuttunut\n`)
      continue
    }

    for (const p of hits) {
      console.log(`  ${p.id}`)
      console.log(`     nimi:         ${String(p.name).slice(0, 88)}`)
      console.log(`     rakennuttaja: ${fix.from}  ->  ${fix.to}`)
      console.log(`     nakyvyys:     ${p.is_public ? "asiakkaille nakyva" : "piilotettu"}`)
      console.log("")

      fixed++
      if (!APPLY) continue

      await supabase
        .from("projects")
        .update({
          developer: fix.to,
          metadata: {
            ...(p.metadata ?? {}),
            /* Alkuperainen lahdearvo talteen, jottei korjaus katoa jaljettomiin. */
            developer_corrected_from: fix.from,
            developer_corrected_at: new Date().toISOString(),
          },
        })
        .eq("id", p.id)
    }
  }

  console.log(`korjattavia riveja: ${fixed}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
