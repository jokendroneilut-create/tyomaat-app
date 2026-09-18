import { readFileSync, writeFileSync } from "node:fs"
import * as cheerio from "cheerio"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SIVUN KUVAUS ALUSTA ASTI - KUUDEN KERAAJAN BACKFILL (D-194).
 *
 * Keraajat korjattiin lukemaan sivun johdanto (lib/agent/discovery/
 * collectors/sivunKuvaus.ts). Puuttuvaa tekstia ei ole tallessa, joten
 * sivut haetaan uudelleen - yksi pyynto per sivu, viiveella.
 *
 * TURVARAJA: kuvaus korvataan VAIN jos vanha kuvaus sisaltyy uuteen
 * kokonaan. Uusi on siis aina vanha + lisaa, eika mitaan voi kadota.
 * `additional_info` korvataan vain jos se on sama kuin vanha kuvaus
 * (muuten se on muokattu teksti, johon ei kosketa).
 *
 *   npx tsx scripts/fix-sivun-kuvaus-alusta.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-sivun-kuvaus-alusta.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const VIIVE_MS = 1000
const nuku = (ms: number) => new Promise((r) => setTimeout(r, ms))
const tiivis = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const K = await import("../lib/agent/discovery/collectors/sivunKuvaus")

  const NAANTALI_MENETTELY = /kaupunginhallitus|kaupunginvaltuusto|valitus|muistutus/i
  const LAHTEET: Record<string, ($: cheerio.CheerioAPI) => string | null> = {
    "Puolustuskiinteistöt uutiset": K.puolustuskiinteistotKuvaus,
    "Kaarinan vireillä olevat asemakaavat": K.kaarinaKuvaus,
    "Porvoon asemakaavat": K.porvooKuvaus,
    "Naantalin vireillä olevat asemakaavat": ($) => K.naantaliKuvaus($, NAANTALI_MENETTELY),
    "Jämsän vireillä olevat asemakaavat": K.jamsaKuvaus,
    "Ylöjärven vireillä olevat asemakaavat": K.ylojarviKuvaus,
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (const table of ["potential_projects", "projects"] as const) {
    const columns = table === "potential_projects" ? "id, title, status, metadata" : "id, name, additional_info, metadata"
    for (const lahde of Object.keys(LAHTEET)) {
      const { data, error } = await supabase.from(table).select(columns).eq("metadata->>source_name", lahde)
      if (error) throw error
      for (const r of data ?? []) rivit.push({ ...(r as any), _taulu: table, _lahde: lahde })
    }
  }
  console.log(`rivejä: ${rivit.length}`)

  /* Sama sivu on usein sekä ehdokkaana että hankkeena: haetaan kerran. */
  const sivut = new Map<string, string | null>()
  const osoitteet = new Map<string, string>()
  for (const r of rivit) {
    const url = String(r.metadata?.source_url ?? "")
    if (/^https?:\/\//.test(url)) osoitteet.set(url, r._lahde)
  }
  console.log(`haettavia sivuja: ${osoitteet.size}`)

  for (const [url, lahde] of osoitteet) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } })
      if (!res.ok) {
        console.log(`  HAKU EPÄONNISTUI ${res.status}: ${url}`)
        sivut.set(url, null)
      } else {
        const $ = cheerio.load(await res.text())
        $("style, script").remove()
        sivut.set(url, LAHTEET[lahde]($))
      }
    } catch {
      console.log(`  VIRHE: ${url}`)
      sivut.set(url, null)
    }
    await nuku(VIIVE_MS)
  }

  const laskurit = { taydentyy: 0, sama: 0, eiSisalla: 0, eiSivua: 0, additionalInfo: 0, lahdedokumentti: 0 }
  const raportti: string[] = []
  const paivitettavat: { r: any; uusi: string; ai: boolean }[] = []

  for (const r of rivit) {
    const uusi = sivut.get(String(r.metadata?.source_url ?? ""))
    const vanha = String(r.metadata?.description ?? "")
    if (!uusi) { laskurit.eiSivua++; continue }
    if (tiivis(uusi) === tiivis(vanha) || tiivis(uusi).length <= tiivis(vanha).length) { laskurit.sama++; continue }
    if (vanha && !tiivis(uusi).includes(tiivis(vanha))) {
      laskurit.eiSisalla++
      raportti.push(`\n!! EI SISÄLLÄ (ei kosketa) ${r._taulu} ${r._lahde} | ${tiivis(r.title ?? r.name).slice(0, 60)}\n   VANHA: ${tiivis(vanha).slice(0, 220)}\n   UUSI:  ${tiivis(uusi).slice(0, 220)}`)
      continue
    }
    const ai = r._taulu === "projects" && !!r.additional_info && tiivis(r.additional_info) === tiivis(vanha)
    laskurit.taydentyy++
    if (ai) laskurit.additionalInfo++
    paivitettavat.push({ r, uusi, ai })
    const lisa = tiivis(uusi).replace(tiivis(vanha), " [[VANHA]] ")
    raportti.push(`\n${r._taulu} ${r.status ?? ""} ${r._lahde} | ${tiivis(r.title ?? r.name).slice(0, 60)}\n   ${tiivis(vanha).length} -> ${tiivis(uusi).length} merkkiä${ai ? "  (+additional_info)" : ""}\n   ${lisa.slice(0, 700)}`)
  }

  const polku = "C:/Users/johan/AppData/Local/Temp/claude/C--Users-johan-tyomaat-app-app/e709baee-8f55-4e09-92ad-d73c4fd628d2/scratchpad/sivun-kuvaus-raportti.txt"
  writeFileSync(polku, raportti.join("\n"), "utf8")

  if (APPLY) {
    for (const { r, uusi, ai } of paivitettavat) {
      const metadata = { ...(r.metadata ?? {}), description: uusi }
      const { error } = await supabase
        .from(r._taulu)
        .update(r._taulu === "projects" ? { metadata, ...(ai ? { additional_info: uusi } : {}) } : { metadata })
        .eq("id", r.id)
      if (error) throw error
    }

    /* Lahdedokumentti: Puolustuskiinteistot kayttaa tallessa olevaa kuvausta uudelleen eika hae sivua. */
    for (const [url, uusi] of sivut) {
      if (!uusi) continue
      const { data } = await supabase.from("source_documents").select("id, raw_payload").eq("document_url", url)
      for (const d of data ?? []) {
        const vanha = tiivis((d as any).raw_payload?.description)
        if (!vanha || tiivis(uusi).length <= vanha.length || !tiivis(uusi).includes(vanha)) continue
        const { error } = await supabase
          .from("source_documents")
          .update({ raw_payload: { ...(d as any).raw_payload, description: uusi } })
          .eq("id", (d as any).id)
        if (error) throw error
        laskurit.lahdedokumentti++
      }
    }
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(laskurit)
  console.log(`raportti: ${polku}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
