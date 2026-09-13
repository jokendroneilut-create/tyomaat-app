import { readFileSync } from "node:fs"
import * as cheerio from "cheerio"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ALKAAKO TALLENNETTU KUVAUS VASTA SIVUN KESKELTÄ? (D-190)
 *
 * Pyhäjoen kaavasivulla kuvaus alkoi vasta toisesta virkkeestä, koska
 * kerääjä luki vain leipätekstilohkon eikä ingressiä - ja juuri
 * ingressissä luki hankkeen omistaja. Sama vika voi olla muissa
 * kerääjissä, eikä sitä näe koodista: kuvaus rakennetaan eri tavoin.
 *
 * Tunnusmerkki on datassa: jos tallennetun kuvauksen alku löytyy elävältä
 * sivulta VASTA jonkin matkan päästä, väliin jäänyt teksti on pudonnut
 * meiltä. Skripti tulostaa sen tekstin luettavaksi.
 *
 * YKSI PYYNTÖ PER LÄHDE. Otetaan yksi dokumentti kustakin lähteestä,
 * jotta kuormitus jakautuu eikä yhtä sivustoa rasiteta.
 *
 *   npx tsx scripts/measure-puuttuva-alku.ts
 *   npx tsx scripts/measure-puuttuva-alku.ts --lahteita=40
 */

const LAHTEITA = Number(process.argv.find((a) => a.startsWith("--lahteita="))?.split("=")[1] ?? 200)
const VIIVE_MS = 800
const nuku = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* Alle tämän jäävä ero on otsikko tai murupolku, ei sisältöä. */
const MERKITTAVA_ALKU = 60

/*
 * YLI TÄMÄN EI OLE PUDONNUT ALKU VAAN ERI SIVUTYYPPI.
 *
 * Ensimmäinen mittaus lipsautti 116 osumaa 182:sta, ja luettuna valtaosa
 * oli vääriä: monella kunnalla KAIKKI kaavat ovat yhdellä sivulla
 * ankkureilla (`.../vireilla-olevat-kaavat/#kohde`), jolloin meidän
 * kuvauksemme on yhden kaavan osio ja "väliin jäänyt" teksti on
 * navigaatiota ja MUIDEN kaavojen sisältöä - ei meiltä kadonnutta.
 *
 * Pyhäjoen vian tuntomerkki oli eri: oma sivu per kaava ja lyhyt puuttuva
 * alku (104 merkkiä), joka oli sivun oma ingressi.
 */
const PISIN_PUDONNUT_ALKU = 800

function sivunTeksti(html: string): string {
  const $ = cheerio.load(html)
  $("script, style, noscript, nav, header, footer, form, iframe").remove()
  const main = $("main").first().text()
  const teksti = (main && main.length > 200 ? main : $("body").text()) ?? ""
  return teksti.replace(/\s+/g, " ").trim()
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Yksi ehdokas per lähde, jolla on kuvaus ja verkkosivuosoite. */
  const perLahde = new Map<string, any>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, metadata")
      .range(from, from + 999)
    if (error) throw error
    for (const r of data ?? []) {
      const m: any = (r as any).metadata ?? {}
      const url = String(m.source_url ?? "")
      const kuvaus = String(m.description ?? "")
      /* Ankkuriosoite = yksi sivu, monta kaavaa. Ks. PISIN_PUDONNUT_ALKU. */
      if (!/^https?:\/\//.test(url) || url.endsWith(".pdf") || url.includes("#")) continue
      if (kuvaus.length < 120) continue
      const lahde = String(m.source_name ?? "?")
      if (!perLahde.has(lahde)) perLahde.set(lahde, { ...(r as any), url, kuvaus, lahde })
    }
    if (!data || data.length < 1000) break
  }

  const otos = [...perLahde.values()].slice(0, LAHTEITA)
  console.log(`lähteitä otoksessa: ${otos.length}\n`)

  let tarkistettu = 0
  const puuttuvat: any[] = []

  for (const r of otos) {
    try {
      const res = await fetch(r.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
      })
      if (!res.ok) continue
      const teksti = sivunTeksti(await res.text())
      if (teksti.length < 200) continue
      tarkistettu++

      /* Mistä kohtaa sivua tallennettu kuvaus alkaa? */
      const alku = r.kuvaus.slice(0, 70).replace(/\s+/g, " ").trim()
      const kohta = teksti.indexOf(alku)
      if (kohta < MERKITTAVA_ALKU || kohta > PISIN_PUDONNUT_ALKU) continue

      puuttuvat.push({ ...r, kohta, edelta: teksti.slice(0, kohta) })
    } catch {
      /* Sivu ei vastannut - ei kerro vikaa meidän päässä. */
    }
    await nuku(VIIVE_MS)
  }

  console.log(`tarkistettu ${tarkistettu} lähdettä, alku puuttuu ${puuttuvat.length}:ltä\n`)
  for (const p of puuttuvat.sort((a, b) => b.kohta - a.kohta)) {
    console.log(`### ${p.lahde}  (kuvaus alkaa vasta merkistä ${p.kohta})`)
    console.log(`    ${p.url}`)
    console.log(`    VÄLIIN JÄÄNYT: "${p.edelta.slice(0, 240)}"`)
    console.log()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
