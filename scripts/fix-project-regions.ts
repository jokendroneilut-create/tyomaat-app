import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KORJAA HANKKEIDEN MAAKUNNAT KUNNAN MUKAAN.
 *
 * Viisi kuntaa siirtyi maakunnasta toiseen 1.1.2021, eikä siirto näkynyt
 * meillä: maakunta oli päätelty kuntanumeroista, mikä koodaa vanhan
 * jaon. Hankkeet olivat siis väärän maakunnan alla — ja maakunta on
 * asiakkaan suodatin, joten hanke ei löydy sieltä mistä sitä haetaan.
 *
 * Korjaa vain ne rivit joilla kunta tunnetaan ja tallennettu maakunta
 * eroaa kunnan omasta. Ei kirjoita tyhjää: jos kuntaa ei tunneta, rivi
 * jätetään rauhaan.
 *
 * Kuivaharjoitus oletuksena; kirjoittaa vasta --apply.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { getMunicipalityByName } = await import("../lib/geo/municipalities")

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,city,region,is_public,status,developer,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /*
   * LÄHTEEN OMAA MAAKUNTAA EI YLIKIRJOITETA.
   *
   * Ristiriita kunnan ja maakunnan välillä ei aina tarkoita väärää
   * maakuntaa. Luettuna riveittäin 1.9.2026: 28 ristiriidasta suurin osa
   * oli väylähankkeita jotka ulottuvat usean maakunnan alueelle —
   * "Valtatien 3 parantaminen Tampere–Vaasa" on kunta Tampere ja
   * maakunta Pohjanmaa, ja molemmat ovat oikein omalla tavallaan.
   * Niissä KUNTA on reittipiste, ei sijainti.
   *
   * Korjataan siis vain rivit joilla lähde EI ole kertonut maakuntaa:
   * silloin arvo on peräisin meidän omasta päättelystämme, ja se on
   * juuri se joka oli vanhentunut.
   */
  /*
   * SIIRTYNEET KUNNAT KORJATAAN VAIKKA LÄHDE OLISI KERTONUT MAAKUNNAN.
   *
   * Näillä viidellä lähteen kertoma arvo EI ole itsenäinen todiste: se
   * kirjoitettiin aikanaan meidän omasta taulustamme, joka oli väärässä.
   * Muissa tapauksissa lähteen omaa arvoa kunnioitetaan.
   */
  const SIIRTYNEET = new Set(["Iitti", "Joroinen", "Kuhmoinen", "Laihia", "Heinävesi"])

  const korjattavat = rivit
    .map((r) => ({ r, oikea: getMunicipalityByName(r.city)?.region ?? null }))
    .filter((x) => x.oikea && x.r.region && x.r.region !== x.oikea)
    .filter(
      (x) =>
        SIIRTYNEET.has(String(x.r.city)) ||
        !String(x.r.metadata?.region ?? "").trim()
    )

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: ${rivit.length} hanketta, korjattavia ${korjattavat.length}\n`)

  const per = new Map<string, number>()
  for (const { r, oikea } of korjattavat) {
    const avain = `${r.city}: ${r.region} -> ${oikea}`
    per.set(avain, (per.get(avain) ?? 0) + 1)
  }
  for (const [k, v] of [...per].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(52)} ${v}`)

  /*
   * TYHJAT MAAKUNNAT. Eri asia kuin vaara maakunta: tassa mikaan ei
   * ylikirjoitu, vaan tyhja kentta taytetaan samalla logiikalla jota
   * hyvaksynta ja TIC kayttavat (resolveRegion) - mukaan lukien
   * maakunnallinen tilaaja ja otsikon genetiivi.
   */
  const { resolveRegion } = await import("../lib/projects/resolveRegion")
  const tyhjat = rivit
    .filter((r) => r.status === "active" && r.is_public !== false)
    .filter((r) => !String(r.region ?? "").trim())
    .map((r) => ({
      r,
      oikea: resolveRegion({
        metadataRegion: r.metadata?.region,
        city: r.city,
        buyerName: r.metadata?.developer ?? r.developer,
        title: r.name,
      }),
    }))
    .filter((x) => x.oikea)

  console.log("")
  console.log("TYHJIA MAAKUNTIA taytettavissa " + tyhjat.length + ":")
  for (const { r, oikea } of tyhjat) {
    console.log("  " + String(oikea).padEnd(18) + " " + String(r.name ?? "").slice(0, 52) + "  (tilaaja: " + String(r.metadata?.developer ?? r.developer ?? "-").slice(0, 24) + ")")
  }

  if (!APPLY) {
    console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  let ok = 0
  for (const { r, oikea } of korjattavat) {
    const { error } = await admin.from("projects").update({ region: oikea }).eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.name}: ${error.message}`)
    else ok++
  }
  console.log(`\nkorjattu ${ok} / ${korjattavat.length}`)

  for (const { r, oikea } of tyhjat) {
    const { error } = await admin.from("projects").update({ region: oikea }).eq("id", r.id)
    if (error) console.log("  VIRHE " + r.name + ": " + error.message)
  }
  console.log("taytetty tyhjia " + tyhjat.length)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
