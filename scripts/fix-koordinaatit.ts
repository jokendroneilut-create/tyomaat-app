import { readFileSync } from "node:fs"

/*
 * PUUTTUVAT KOORDINAATIT TAKAUTUVASTI.
 *
 * Geokoodaus ajetaan hyväksynnässä kerran, ja jos se epäonnistuu
 * (Nominatim ei vastaa, aikakatkaisu), mikään ei yritä uudestaan.
 * Hanke jää ilman koordinaatteja pysyvästi.
 *
 * Mitattu 8.9.2026: näkyvistä 5 954 hankkeesta 47:llä ei ollut
 * koordinaatteja, ja niistä 12/12 geokoodautui testissä onnistuneesti —
 * eli vika oli hetkellinen eikä sijaintitiedossa.
 *
 * Seuraus näkyi kartalla: `/projects`-sivun "rajaa listaa kartan
 * mukaan" ei voi rajata koordinaatitonta hanketta, joten ne näkyivät
 * listassa vaikka kartta oli toisessa päässä Suomea.
 *
 * EI KEKSI SIJAINTIA: `geocodeProjectLocation` vaatii nyt vähintään
 * kaupungin, maakunnan tai osoitteen (D-178). Ilman niitä hanke jää
 * tarkoituksella ilman koordinaatteja.
 *
 * Nominatimin käyttöehdot: enintään 1 kysely sekunnissa.
 *
 *   npx tsx scripts/fix-koordinaatit.ts
 *   npx tsx scripts/fix-koordinaatit.ts --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")

/* Nominatim: 1 kysely/s. Geokoodari tekee pahimmillaan kolme. */
const VIIVE_MS = 1200

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { geocodeProjectLocation, onSijaintitietoa } = await import("../lib/geo/geocode")

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,city,region,location,latitude,longitude,lat,lng,status,is_public,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const live = rivit.filter((r) => r.status === "active" && r.is_public !== false)
  const ilman = live.filter(
    (r) => (r.latitude ?? r.lat) == null && (r.longitude ?? r.lng) == null
  )

  const geokoodattavat = ilman.filter((r) => onSijaintitietoa(r))
  const eiSijaintia = ilman.filter((r) => !onSijaintitietoa(r))

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: ${live.length} nakyvaa, ilman koordinaatteja ${ilman.length}`)
  console.log(`  geokoodattavia:      ${geokoodattavat.length}`)
  console.log(`  ei sijaintitietoa:   ${eiSijaintia.length}  (jaavat tarkoituksella tyhjiksi)\n`)

  let ok = 0
  let ei = 0

  for (const r of geokoodattavat) {
    const c = await geocodeProjectLocation({ location: r.location, city: r.city, region: r.region })
    await new Promise((x) => setTimeout(x, VIIVE_MS))

    if (c.lat == null || c.lon == null) {
      ei++
      console.log(`  EI   ${String(r.region ?? "-").padEnd(17)} ${String(r.city ?? "-").padEnd(12)} ${String(r.name).slice(0, 46)}`)
      continue
    }

    ok++
    /* Tarkkuuden kertoo geokoodari: mika kysely osui, ei mita kenttia on. */
    const tarkkuus = c.tarkkuus ?? "tuntematon"
    console.log(
      `  OK   ${String(r.region ?? "-").padEnd(17)} ${String(r.city ?? "-").padEnd(12)} ${c.lat.toFixed(3)},${c.lon.toFixed(3)} ${tarkkuus.padEnd(9)} ${String(r.name).slice(0, 40)}`
    )

    if (!APPLY) continue

    const { error } = await admin
      .from("projects")
      .update({
        latitude: c.lat,
        longitude: c.lon,
        lat: c.lat,
        lng: c.lon,
        metadata: { ...(r.metadata ?? {}), geocode_source: tarkkuus, geocoded_at: new Date().toISOString() },
      })
      .eq("id", r.id)
    if (error) console.log(`       VIRHE: ${error.message}`)
  }

  console.log(`\nonnistui ${ok}, ei onnistunut ${ei}, ohitettu sijainnittomana ${eiSijaintia.length}`)

  if (eiSijaintia.length) {
    console.log("\nEI SIJAINTITIETOA (ei geokoodata):")
    for (const r of eiSijaintia) console.log(`  ${String(r.name).slice(0, 70)}`)
  }

  if (!APPLY) console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
}

main().catch((e) => {
  console.error("VIRHE:", e?.message ?? e)
  process.exit(1)
})
export {}
