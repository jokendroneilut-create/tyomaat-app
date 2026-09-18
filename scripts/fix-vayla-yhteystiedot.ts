import { readFileSync } from "node:fs"
import * as cheerio from "cheerio"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VÄYLÄN HANKKEET ILMAN YHTEYSTIETOA (D-199).
 *
 *   1. Oma yhteystietolaatikko (voi olla ilmestynyt keräyksen jälkeen).
 *   2. Kattohanke ("Kts. osahankkeiden yhteystiedot"): ensimmäinen
 *      osahankkeen henkilö. Vain kun sivu itse ohjaa osahankkeisiin.
 *   3. Leipätekstin henkilöt (ohjelmasivut, esim. Siltatyöt Itä-Suomessa).
 *
 * Vain rivit joilla EI ole puhelinta eikä sähköpostia - mitään ei korvata.
 * Sivupyynnöt viiveellä; sama sivu haetaan kerran.
 *
 *   npx tsx scripts/fix-vayla-yhteystiedot.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-vayla-yhteystiedot.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE = "Väylävirasto hankkeet"
const VIIVE_MS = 900
const nuku = (ms: number) => new Promise((r) => setTimeout(r, ms))
const UA = { headers: { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } }

function decodeCf(encoded: string): string | null {
  try {
    const key = parseInt(encoded.substring(0, 2), 16)
    let email = ""
    for (let i = 2; i < encoded.length; i += 2) email += String.fromCharCode(parseInt(encoded.substring(i, i + 2), 16) ^ key)
    return email || null
  } catch {
    return null
  }
}

function laatikko($: cheerio.CheerioAPI) {
  const box = $(".contact-information .contact").first()
  if (!box.length) return null
  const enc = box.find(".__cf_email__").first().attr("data-cfemail")
  return {
    organization: box.find(".organization").first().text().trim() || null,
    title: box.find(".title").first().text().trim() || null,
    name: box.find(".full-name").first().text().trim() || null,
    phone: box.find(".phones li").first().text().trim() || null,
    email: enc ? decodeCf(enc) : null,
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { normalizeVaylaContact } = await import("../lib/agent/vaylaContacts")
  const { extractContacts } = await import("../lib/projects/contacts")
  const { vaylaSubprojectLinks } = await import("../lib/agent/vaylaSubprojects")
  const { siivoaTitteli } = await import("../lib/projects/vapaaYhteystieto")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (const taulu of ["projects", "potential_projects"] as const) {
    const { data, error } = await db.from(taulu).select("id, metadata").eq("metadata->>source_name", LAHDE)
    if (error) throw error
    for (const r of (data ?? []) as any[]) {
      const c: any[] = Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons : []
      if (c.some((x) => x && (x.email || x.phone))) continue
      rivit.push({ ...r, _taulu: taulu })
    }
  }
  console.log(`rivejä ilman yhteystietoa: ${rivit.length}`)

  const sivut = new Map<string, { box: any; tapa: string } | null>()
  for (const url of new Set(rivit.map((r) => String(r.metadata?.source_url ?? "")).filter(Boolean))) {
    try {
      const $ = cheerio.load(await (await fetch(url, UA)).text())
      let box = laatikko($)
      let tapa = "oma laatikko"
      if (!box && /osahankkeiden\s+yhteystiedot/i.test($("body").text())) {
        for (const ala of vaylaSubprojectLinks($, url)) {
          await nuku(VIIVE_MS)
          box = laatikko(cheerio.load(await (await fetch(ala, UA)).text()))
          tapa = `osahanke ${ala.replace("https://vayla.fi", "")}`
          if (box?.name) break
        }
      }
      sivut.set(url, box ? { box, tapa } : null)
    } catch {
      sivut.set(url, null)
    }
    await nuku(VIIVE_MS)
  }

  const tavat = new Map<string, number>()
  let n = 0
  for (const r of rivit) {
    const url = String(r.metadata?.source_url ?? "")
    const sivu = sivut.get(url)
    let uudet = sivu ? normalizeVaylaContact(sivu.box) : []
    let tapa = sivu?.tapa ?? ""
    if (uudet.length === 0) {
      uudet = extractContacts(r.metadata?.description)
        .filter((c) => c.kind === "person" && c.role !== "authority")
        .map((c) => ({ ...c, title: siivoaTitteli(c.title) }))
      tapa = "leipäteksti"
    }
    if (uudet.length === 0) continue
    n++
    const avain = tapa.startsWith("osahanke") ? "osahanke" : tapa
    tavat.set(avain, (tavat.get(avain) ?? 0) + 1)
    console.log(`${r._taulu} ${url.replace("https://vayla.fi", "")} <- ${tapa}: ${uudet.map((c) => `${c.title ?? "-"} | ${c.organization ?? "-"} | ${c.phone ? "puh" : "-"} | ${c.email ? "email" : "-"}`).join(" ;; ")}`)
    if (!APPLY) continue
    const olemassa: any[] = Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons : []
    const { error } = await db.from(r._taulu).update({ metadata: { ...r.metadata, contact_persons: [...olemassa, ...uudet] } }).eq("id", r.id)
    if (error) throw error
    /* Lähdedokumenttiin myös, jottei keräimen välimuisti palauta tyhjää. */
    if (sivu?.box) {
      const { data: docs } = await db.from("source_documents").select("id, raw_payload").eq("document_url", url)
      for (const d of (docs ?? []) as any[]) {
        if (d.raw_payload?.contact) continue
        await db.from("source_documents").update({ raw_payload: { ...d.raw_payload, contact: sivu.box } }).eq("id", d.id)
      }
    }
  }
  console.log(`\ntavat: ${[...tavat].map(([k, v]) => `${k} ${v}`).join(", ")}`)
  console.log(`=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} / ${rivit.length} riviä ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
