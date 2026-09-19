import { readFileSync } from "node:fs"
import * as cheerio from "cheerio"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LÄHTEETTÖMÄT HANKKEET: HAULLA LÖYDETTY LÄHDESIVU (D-200).
 *
 * Lähdesivut on löydetty verkkohaulla hanke kerrallaan ja luettu:
 * sivun on oltava rakennuttajan, urakoitsijan tai kunnan oma tiedote tai
 * hankesivu JUURI tästä hankkeesta. Yhteyshenkilöt poimitaan itse
 * sivulta (`sivunYhteyshenkilot`), ei hakutuloksen tiivistelmästä.
 * Ensimmäinen osoite kirjataan source_urliksi.
 *
 * Syöte: scripts/data/lahteettomat-lahteet.json
 *   [{ "id": "<projektin uuid>", "urls": ["https://...", ...] }]
 *
 *   npx tsx scripts/fix-lahteettomat-haku.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-lahteettomat-haku.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const VIIVE_MS = 1000
const nuku = (ms: number) => new Promise((r) => setTimeout(r, ms))
const peita = (s: unknown) => String(s ?? "").replace(/\S+/g, (w, i) => (i === 0 ? w : "X"))

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { sivunYhteyshenkilot } = await import("../lib/projects/sivunYhteyshenkilot")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const syote: { id: string; urls: string[] }[] = JSON.parse(
    readFileSync("C:/Users/johan/tyomaat-app/scripts/data/lahteettomat-lahteet.json", "utf8")
  )

  let lahde = 0
  let henkilo = 0
  for (const { id, urls } of syote) {
    const { data } = await db.from("projects").select("id, name, city, developer, builder, metadata").eq("id", id)
    const p: any = data?.[0]
    if (!p) { console.log(`EI LÖYDY ${id}`); continue }
    if (p.metadata?.source_name) { console.log(`OHITETAAN (lähde jo) ${p.name}`); continue }

    /*
     * SIVUN ON KOSKETTAVA TÄTÄ HANKETTA. Haku voi tuoda saman yhtiön
     * toisen kohteen tiedotteen. Sivun tekstissä on mainittava hankkeen
     * kunta (vartalo, jotta taivutus menee läpi) tai osapuolen nimi.
     */
    const vartalo = (s: unknown) => String(s ?? "").trim().toLowerCase().slice(0, 5)
    const tunnisteet = [vartalo(p.city), ...[p.developer, p.builder].map((x) => String(x ?? "").trim().toLowerCase().split(/\s+/)[0])]
      .filter((t) => t && t.length >= 3)

    const uudet: any[] = []
    const toimivat: string[] = []
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } })
        if (res.ok) {
          const html = await res.text()
          const teksti = cheerio.load(html)("body").text().toLowerCase()
          if (tunnisteet.length && !tunnisteet.some((t) => teksti.includes(t))) {
            console.log(`   EI KOSKE HANKETTA (${tunnisteet.join("/")} puuttuu): ${url}`)
            await nuku(VIIVE_MS)
            continue
          }
          toimivat.push(url)
          for (const c of sivunYhteyshenkilot(cheerio.load(html))) {
            if (!uudet.some((u) => String(u.email).toLowerCase() === String(c.email).toLowerCase())) uudet.push(c)
          }
        } else console.log(`   HTTP ${res.status} ${url}`)
      } catch {
        console.log(`   VIRHE ${url}`)
      }
      await nuku(VIIVE_MS)
    }
    if (!toimivat.length) { console.log(`EI TOIMIVAA LÄHDETTÄ: ${p.name}`); continue }
    const olemassa: any[] = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
    const lisattavat = uudet.filter((c) => !olemassa.some((o) => String(o.email ?? "").toLowerCase() === String(c.email).toLowerCase()))
    lahde++
    if (lisattavat.length) henkilo++
    console.log(`${String(p.name).slice(0, 55)}\n   lähde ${toimivat[0] ? new URL(toimivat[0]).hostname : "EI TOIMIVAA"} | +${lisattavat.length}: ${lisattavat.map((c) => `${peita(c.name)} | ${c.title ?? "-"} | ${c.email.split("@")[1]} | ${c.phone ? "puh" : "-"}`).join(" ;; ")}`)
    if (!APPLY) continue
    const { error } = await db
      .from("projects")
      .update({ metadata: { ...p.metadata, source_url: p.metadata?.source_url ?? toimivat[0], source_urls_found: toimivat, contact_persons: [...olemassa, ...lisattavat] } })
      .eq("id", p.id)
    if (error) throw error
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: lähde ${lahde}, joista henkilö ${henkilo} ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
