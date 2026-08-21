import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MISTA SAA YHTEYSTIEDON 2 483 PUUTTUVAAN?
 *
 * Kysymys ei ole "voiko poimia" vaan "mika on halvin kattavuus". Tama
 * mittaa kolme vipua ja niiden KESKITTYMISEN:
 *
 *   1. osapuoli tiedossa (rakennuttaja/urakoitsija) -> yritysrekisteri
 *   2. kunta tiedossa mutta ei osapuolta          -> kunnan kirjaamo
 *   3. ei kumpaakaan                              -> ei automaattista tieta
 *
 * Keskittyminen ratkaisee: jos 30 yritysta kattaa puolet, kasin
 * rakennettu rekisteri on halvempi kuin mika tahansa poiminta.
 *
 * Ei kirjoita mitaan.
 */

const norm = (s: any): string =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/\b(oy|oyj|ab|ltd|ky)\b\.?/gi, "")
    .replace(/[.,]/g, "")
    .trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await s
      .from("projects")
      .select("id,name,is_public,city,region,developer,builder,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const puuttuu = rivit.filter(
    (p) =>
      p.is_public &&
      !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length)
  )

  console.log(`ilman yhteystietoa: ${puuttuu.length}\n`)

  const osapuoliFor = (p: any): string | null => {
    const ehdokkaat = [p.developer, p.builder, p.metadata?.developer, p.metadata?.builder]
    for (const e of ehdokkaat) {
      const n = norm(e)
      if (n.length >= 3) return n
    }
    return null
  }

  const yritykset = new Map<string, number>()
  let osapuolella = 0, vainKunta = 0, eiMitaan = 0

  for (const p of puuttuu) {
    const o = osapuoliFor(p)
    if (o) {
      osapuolella++
      yritykset.set(o, (yritykset.get(o) ?? 0) + 1)
    } else if (String(p.city ?? "").trim()) {
      vainKunta++
    } else {
      eiMitaan++
    }
  }

  console.log("=== VIVUT ===")
  console.log(`  1. osapuoli tiedossa:        ${osapuolella}   ${Math.round(osapuolella / puuttuu.length * 100)} %`)
  console.log(`  2. vain kunta tiedossa:      ${vainKunta}   ${Math.round(vainKunta / puuttuu.length * 100)} %`)
  console.log(`  3. ei kumpaakaan:            ${eiMitaan}   ${Math.round(eiMitaan / puuttuu.length * 100)} %`)

  const jarjestys = [...yritykset].sort((a, b) => b[1] - a[1])
  console.log(`\n=== KESKITTYMINEN ===`)
  console.log(`eri osapuolia: ${jarjestys.length}`)

  let summa = 0
  const rajat = [10, 25, 50, 100, 200]
  for (const raja of rajat) {
    const katto = jarjestys.slice(0, raja).reduce((a, b) => a + b[1], 0)
    console.log(`  ${String(raja).padStart(3)} yleisinta kattaa ${String(katto).padStart(4)} hanketta   ${Math.round(katto / puuttuu.length * 100)} % puuttuvista`)
  }
  summa = jarjestys.reduce((a, b) => a + b[1], 0)

  console.log(`\n30 yleisinta osapuolta:`)
  for (const [k, v] of jarjestys.slice(0, 30)) console.log(`  ${String(v).padStart(4)}  ${k.slice(0, 52)}`)

  /* Kuinka moni yleisimmista on kunta? Niille kirjaamo on julkinen tieto. */
  const KUNTA = /(kaupunki|kunta|hyvinvointialue|seurakunta|kuntayhtym)/i
  const kunnat = jarjestys.filter(([k]) => KUNTA.test(k))
  const kuntaHankkeet = kunnat.reduce((a, b) => a + b[1], 0)
  console.log(`\nosapuolista kuntia/julkisia: ${kunnat.length} kpl, ${kuntaHankkeet} hanketta   ${Math.round(kuntaHankkeet / Math.max(1, summa) * 100)} % osapuolellisista`)

  /* Vipu 2: mitka kunnat, ja kuinka keskittyneita? */
  const kaupungit = new Map<string, number>()
  for (const p of puuttuu) {
    if (osapuoliFor(p)) continue
    const c = String(p.city ?? "").trim()
    if (c) kaupungit.set(c, (kaupungit.get(c) ?? 0) + 1)
  }
  const kj = [...kaupungit].sort((a, b) => b[1] - a[1])
  console.log(`\n=== VIPU 2: kunnat ilman osapuolta ===`)
  console.log(`eri kuntia: ${kj.length}`)
  for (const [k, v] of kj.slice(0, 15)) console.log(`  ${String(v).padStart(4)}  ${k}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
