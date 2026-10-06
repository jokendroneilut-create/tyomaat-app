import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}


/*
 * HELSINGIN PAATOSTEN YHTEYSHENKILOT TAKAUTUVASTI (D-240).
 *
 * 500 hanketta 505:sta on ilman yhteyshenkiloa, vaikka jokaisella
 * paatossivulla on projektipaallikon nimi, nimike, puhelin ja
 * sahkoposti. Tama hakee ne ja taydentaa.
 *
 * EI YLIKIRJOITA. Kirjaamon osoite jaa paikalleen listan alkuun ja
 * henkilot lisataan sen rinnalle — yhteystietokentasta ei poisteta
 * mitaan, vain lisataan.
 *
 *   npx tsx scripts/taydenna-helsingin-yhteyshenkilot.ts
 *   npx tsx scripts/taydenna-helsingin-yhteyshenkilot.ts --apply
 *   npx tsx scripts/taydenna-helsingin-yhteyshenkilot.ts --apply --raja 50
 */
async function main() {
  const apply = process.argv.includes("--apply")
  const rajaArg = process.argv.indexOf("--raja")
  const raja = rajaArg >= 0 ? Number(process.argv[rajaArg + 1] ?? 0) : 25

  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { helsinginYhteyshenkilot } = await import("../lib/agent/helsinginLisatiedot")
  const { onYhteyshenkilo } = await import("../lib/metrics/yhteystiedonKattavuus")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const hankkeet: any[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, metadata")
      .eq("metadata->>source_name", "helsinki_paatokset")
      .range(from, from + 499)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 500) break
  }

  const puuttuu = hankkeet.filter((p) => !onYhteyshenkilo(p.metadata))
  console.log("helsinki_paatokset-hankkeita " + hankkeet.length + ", ilman yhteyshenkiloa " + puuttuu.length)
  console.log("kasitellaan enintaan " + raja)
  console.log("")

  let loytyi = 0
  let eiLoytynyt = 0
  let virheita = 0
  let kirjoitettu = 0

  for (const p of puuttuu.slice(0, raja)) {
    const url = String((p.metadata ?? {}).source_url ?? "")
    if (!url.startsWith("http")) continue

    let henkilot: any[] = []
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } })
      if (!r.ok) {
        virheita++
        console.log("  " + r.status + "  " + String(p.name).slice(0, 60))
        continue
      }
      const $ = cheerio.load(await r.text())
      henkilot = helsinginYhteyshenkilot($("body").text().split(/\s+/g).join(" "))
    } catch (e: any) {
      virheita++
      console.log("  VIRHE " + String(e?.message ?? e).slice(0, 50))
      continue
    }

    if (!henkilot.length) {
      eiLoytynyt++
      console.log("  ei lisatietojen antajaa: " + String(p.name).slice(0, 60))
      continue
    }

    loytyi++
    console.log("  " + String(p.name).slice(0, 52).padEnd(54) + henkilot.map((h) => h.nimi + " (" + (h.nimike ?? "-") + ")").join(", ").slice(0, 70))

    if (!apply) continue

    const md = (p.metadata ?? {}) as any
    const vanhat = Array.isArray(md.contact_persons) ? md.contact_persons : []
    const uudet = henkilot.map((h) => ({
      kind: "person",
      name: h.nimi,
      title: h.nimike,
      email: h.sahkoposti,
      phone: h.puhelin,
      organization: "Helsingin kaupunki",
    }))

    const { error } = await db
      .from("projects")
      .update({ metadata: { ...md, contact_persons: [...vanhat, ...uudet] } })
      .eq("id", p.id)

    if (error) console.log("    VIRHE: " + error.message)
    else kirjoitettu++
  }

  console.log("")
  console.log("yhteyshenkilo loytyi:   " + loytyi)
  console.log("ei lisatietojen antajaa: " + eiLoytynyt)
  console.log("hakuvirheita:            " + virheita)
  console.log(apply ? "kirjoitettu:             " + kirjoitettu : "Ei kirjoitettu mitaan. Aja --apply kun rivit on luettu.")
}
main().catch((e) => { console.error(e); process.exit(1) })
