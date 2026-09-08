import { readFileSync } from "node:fs"

/*
 * KARKEAT PISTEET TARKEMMIKSI, TAKAUTUVASTI.
 *
 * Geokoodaus haki ennen osoitteen Nominatimilta, joka ei löydä
 * suomalaisia katuosoitteita luotettavasti ja putosi kaupunkihakuun.
 * Kaupunkihaku palauttaa aina saman pisteen, joten epäonnistuneet
 * osuivat keskustaan: mitattu 8.9.2026, 536 hanketta täsmälleen
 * Helsingin keskustan pisteellä.
 *
 * Osoitehaku tehdään nyt Photonilla (`lib/geo/photon`). Mitattu 18
 * hankkeen otoksella: 8 tarkentui talotasolle, 10 pysyi ennallaan,
 * yksikään ei mennyt rikki.
 *
 * VAIN KARKEAT JOILLA ON KATUOSOITE. Kaava- ja aluenimistä
 * ("Äijänsuon urheilukeskuksen alue") ei saa osoitetta millään
 * geokoodarilla, joten niitä ei kannata kysellä turhaan.
 *
 * EI HUONONNA: piste kirjoitetaan vain jos uusi tulos on
 * osoitetarkka. Kaupunki- tai maakuntatason vastaus jätetään
 * käyttämättä, koska se on jo se mikä kannassa on.
 *
 *   npx tsx scripts/fix-karkeat-sijainnit.ts
 *   npx tsx scripts/fix-karkeat-sijainnit.ts --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")
const RAJA = Number(process.argv.find((x) => x.startsWith("--raja="))?.split("=")[1] ?? "400")

/* Photonin kaytto on ilmaista mutta ei rajatonta: pidetaan 1/s. */
const VIIVE_MS = 1100

const KATUOSOITE =
  /[A-ZÄÖÅ][\wÄÖÅäöå-]*(katu|tie|kuja|polku|ranta|kaari|väylä|vayla|mäki|maki|aukio|rinne|raitti|silta)\s+\d+/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { photonHaku } = await import("../lib/geo/photon")
  const { karkeatPisteet, pisteAvain } = await import("../lib/projects/sijaintitarkkuus")

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
  const karkeat = karkeatPisteet(live)

  const kohteet = live.filter((r) => {
    if (r.metadata?.geocode_source === "osoite") return false
    const avain = pisteAvain(r)
    if (!avain || !karkeat.has(avain)) return false
    return KATUOSOITE.test(String(r.location ?? ""))
  })

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: ${live.length} nakyvaa`)
  console.log(`  karkealla pisteella: ${live.filter((r) => { const a = pisteAvain(r); return a && karkeat.has(a) }).length}`)
  console.log(`  naista katuosoitteellisia: ${kohteet.length}  (kasitellaan enintaan ${RAJA})\n`)

  let tarkentui = 0
  let ennallaan = 0

  for (const r of kohteet.slice(0, RAJA)) {
    const kysely = [r.location, r.city].map((v: any) => v?.trim()).filter(Boolean).join(", ")
    const osuma = await photonHaku(kysely)
    await new Promise((x) => setTimeout(x, VIIVE_MS))

    /* Vain osoitetarkka kelpaa: kaupunkitaso on jo se mika kannassa on. */
    if (!osuma || osuma.tarkkuus !== "osoite") {
      ennallaan++
      continue
    }

    const uusi = `${osuma.lat.toFixed(5)},${osuma.lon.toFixed(5)}`
    if (uusi === pisteAvain(r)) {
      ennallaan++
      continue
    }

    tarkentui++
    console.log(
      `  ${String(r.city ?? "-").padEnd(13)} ${uusi.padEnd(19)} ${String(r.location).slice(0, 34).padEnd(35)} -> ${osuma.nimi}`
    )

    if (!APPLY) continue

    const { error } = await admin
      .from("projects")
      .update({
        latitude: osuma.lat,
        longitude: osuma.lon,
        lat: osuma.lat,
        lng: osuma.lon,
        metadata: {
          ...(r.metadata ?? {}),
          geocode_source: "osoite",
          geocode_provider: "photon",
          geocoded_at: new Date().toISOString(),
        },
      })
      .eq("id", r.id)
    if (error) console.log(`     VIRHE: ${error.message}`)
  }

  console.log(`\ntarkentui ${tarkentui}, pysyi ennallaan ${ennallaan}`)
  if (!APPLY) console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
}

main().catch((e) => {
  console.error("VIRHE:", e?.message ?? e)
  process.exit(1)
})
export {}
