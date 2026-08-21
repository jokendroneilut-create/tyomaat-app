import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: miksi 157 nakyvaa Vaylavirasto-hanketta on ilman yhteystietoa,
 * vaikka poiminta on jo olemassa?
 *
 * apiCollector.fetchVaylaProjectDetails() lukee hankesivun
 * ".contact-information .contact" -lohkon (organisaatio, nimike, nimi,
 * puhelin, Cloudflare-suojattu sahkoposti) ja vaylaResolver kirjoittaa
 * sen contact_persons-kenttaan. Poimin ei siis puutu.
 *
 * EPAILY: VAYLA_MAX_DETAIL_FETCHES_PER_RUN = 5. Katalogissa on ~390
 * hanketta, joten valtaosa dokumenteista ei ole koskaan saanut
 * detaljihakua - raw_payload.contact on null.
 *
 * Tama mittaus tarkistaa kaksi asiaa:
 *   1. kuinka monella source_documents-rivilla on contact tallessa
 *   2. loytyyko puuttuvien hankkeiden sivulta yhteystieto NYT
 *
 * Ei kirjoita mitaan.
 */

const SAMPLE = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 25)

function decodeCloudflareEmail(encoded: string): string | null {
  try {
    const key = parseInt(encoded.substring(0, 2), 16)
    let email = ""
    for (let i = 2; i < encoded.length; i += 2) {
      email += String.fromCharCode(parseInt(encoded.substring(i, i + 2), 16) ^ key)
    }
    return email || null
  } catch {
    return null
  }
}

export type VaylaContact = {
  organization: string | null
  title: string | null
  name: string | null
  phone: string | null
  email: string | null
}

/* Tarkalleen samat valitsimet kuin apiCollector.fetchVaylaProjectDetails(). */
export function parseVaylaContact(html: string, cheerio: any): VaylaContact | null {
  const $ = cheerio.load(html)
  const box = $(".contact-information .contact").first()
  if (!box.length) return null

  const cf = box.find(".__cf_email__").first().attr("data-cfemail")

  return {
    organization: box.find(".organization").first().text().trim() || null,
    title: box.find(".title").first().text().trim() || null,
    name: box.find(".full-name").first().text().trim() || null,
    phone: box.find(".phones li").first().text().trim() || null,
    email: cf ? decodeCloudflareEmail(cf) : null,
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")

  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  /* 1. Onko yhteystieto tallessa lahdedokumenteissa? */
  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s
      .from("source_documents")
      .select("document_url,raw_payload")
      .eq("source_name", "vayla_hankkeet")
      .range(f, f + 999)
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const contactTallessa = docs.filter((d) => d.raw_payload?.contact?.name).length
  const detaljiYritetty = docs.filter((d) => "contact" in (d.raw_payload ?? {})).length

  console.log("=== LAHDEDOKUMENTIT ===")
  console.log(`vayla_hankkeet-dokumentteja:      ${docs.length}`)
  console.log(`  detaljihaku yritetty:           ${detaljiYritetty}   ${Math.round(detaljiYritetty / Math.max(1, docs.length) * 100)} %`)
  console.log(`  yhteystieto nimineen tallessa:  ${contactTallessa}   ${Math.round(contactTallessa / Math.max(1, docs.length) * 100)} %`)

  /* 2. Kuinka moni nakyva hanke on ilman yhteystietoa? */
  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("projects").select("name,is_public,metadata").range(f, f + 999)
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const vayla = rivit.filter((p) => p.is_public && /väylävirasto/i.test(String(p.metadata?.source_name ?? "")))
  const puuttuu = vayla.filter(
    (p) => !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length) && p.metadata?.source_url
  )

  console.log("\n=== NAKYVAT HANKKEET ===")
  console.log(`Vaylavirasto nakyvissa:  ${vayla.length}`)
  console.log(`  ilman yhteystietoa:    ${puuttuu.length}`)

  /* 3. Loytyyko puuttuvien sivulta yhteystieto nyt? */
  const otos = puuttuu.slice(0, SAMPLE)
  console.log(`\n=== OTOS ${otos.length} SIVUA ===`)

  let haettu = 0, lohko = 0, nimella = 0, puhelimella = 0, sahkopostilla = 0
  const naytteet: string[] = []

  for (const p of otos) {
    try {
      const r = await fetch(String(p.metadata.source_url), { cache: "no-store" })
      if (!r.ok) continue
      haettu++

      const c = parseVaylaContact(await r.text(), cheerio)
      if (!c) continue
      lohko++
      if (c.name) nimella++
      if (c.phone) puhelimella++
      if (c.email) sahkopostilla++

      if (naytteet.length < 12) {
        naytteet.push(
          `  ${String(p.name).slice(0, 30).padEnd(32)} ${[c.name, c.title, c.phone, c.email]
            .map((x) => x ?? "-")
            .join(" | ")
            .slice(0, 100)}`
        )
      }
    } catch {
      /* yksittainen sivu ei kaada mittausta */
    }
  }

  console.log(`haettu:              ${haettu}`)
  console.log(`  yhteystietolohko:  ${lohko}   ${Math.round(lohko / Math.max(1, haettu) * 100)} %`)
  console.log(`  nimi:              ${nimella}`)
  console.log(`  puhelin:           ${puhelimella}`)
  console.log(`  sahkoposti:        ${sahkopostilla}`)
  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
