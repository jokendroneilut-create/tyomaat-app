import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITA KASIN LUODUISSA HANKKEISSA ON?
 *
 * 459 hanketta ilman yhteystietoa on "(kasin)" - suurin yksittainen
 * jaljella oleva kasa. Ennen kuin puhutaan LLM:sta on tiedettava mita
 * naissa riveissa oikeasti on: onko tekstia, onko osapuolta, ja onko
 * tekstissa sahkoposti jonka poimija on jo missannut.
 *
 * Halvin voitto olisi se viimeinen: silloin kyse ei ole uudesta
 * tiedosta vaan poiminnan aukosta.
 *
 * Ei kirjoita mitaan.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g
const PHONE_RE = /(?:\+358|0)\s?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,4}(?:[\s-]?\d{1,4})?/

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts, deobfuscateEmails } = await import("../lib/projects/contacts")

  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s
      .from("projects")
      .select("id,name,is_public,city,developer,builder,additional_info,metadata")
      .range(f, f + 999)
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const puuttuu = rivit.filter(
    (p) => p.is_public && !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length)
  )

  /* "(kasin)" = ei lahdenimea lainkaan. */
  const kasin = puuttuu.filter((p) => !String(p.metadata?.source_name ?? "").trim())

  console.log(`ilman yhteystietoa: ${puuttuu.length}`)
  console.log(`  niista kasin luotuja: ${kasin.length}\n`)

  let tekstia = 0, pitkaTeksti = 0, osapuoli = 0, url = 0
  let sahkopostiTekstissa = 0, puhelinTekstissa = 0, poimijaLoytaisi = 0
  const osapuolet = new Map<string, number>()
  const naytteet: string[] = []

  for (const p of kasin) {
    const teksti = deobfuscateEmails(
      [p.additional_info, p.metadata?.description].filter(Boolean).join("\n")
    )

    if (teksti.trim()) tekstia++
    if (teksti.trim().length > 200) pitkaTeksti++
    if (p.metadata?.source_url) url++

    const o = [p.developer, p.builder, p.metadata?.developer, p.metadata?.builder].find(
      (x) => String(x ?? "").trim().length >= 3
    )
    if (o) {
      osapuoli++
      const k = String(o).trim()
      osapuolet.set(k, (osapuolet.get(k) ?? 0) + 1)
    }

    const spostit = [...teksti.matchAll(EMAIL_RE)]
    if (spostit.length) sahkopostiTekstissa++
    if (PHONE_RE.test(teksti)) puhelinTekstissa++

    if (extractContacts(teksti).length) poimijaLoytaisi++

    if (naytteet.length < 12 && teksti.trim()) {
      naytteet.push(
        `  ${String(p.name).slice(0, 34).padEnd(36)} osapuoli=${String(o ?? "-").slice(0, 18).padEnd(20)} tekstia=${String(teksti.trim().length).padStart(5)}`
      )
    }
  }

  console.log("=== MITA RIVEILLA ON ===")
  console.log(`  tekstia lainkaan:        ${tekstia}   ${Math.round(tekstia / kasin.length * 100)} %`)
  console.log(`    yli 200 merkkia:       ${pitkaTeksti}`)
  console.log(`  osapuoli tiedossa:       ${osapuoli}   ${Math.round(osapuoli / kasin.length * 100)} %`)
  console.log(`  lahdelinkki:             ${url}`)
  console.log(`\n=== ONKO YHTEYSTIETO JO TEKSTISSA? ===`)
  console.log(`  sahkoposti tekstissa:    ${sahkopostiTekstissa}`)
  console.log(`  puhelin tekstissa:       ${puhelinTekstissa}`)
  console.log(`  POIMIJA LOYTAISI:        ${poimijaLoytaisi}   <- talla ei tarvita mitaan uutta`)

  console.log("\n=== YLEISIMMAT OSAPUOLET ===")
  for (const [k, v] of [...osapuolet].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(v).padStart(4)}  ${k.slice(0, 50)}`)
  }

  console.log(`\neri osapuolia: ${osapuolet.size}`)
  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
