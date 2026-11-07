import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LOYDETTYJEN LAHDEOSOITTEIDEN KIRJOITUS (D-383).
 *
 * `etsi-puuttuvat-lahteet.ts` haki 238 hankkeelle osoitteen ja kirjoitti
 * tuloksen tiedostoon. Tama ajo kirjoittaa ne kantaan **samasta
 * tuotoksesta**, jotta kirjoitetaan tasan se mika luettiin: uusi haku
 * antaisi eri tuloksia (hakukone jarjestaa osumat eri tavalla eri
 * kerroilla), eika luettu otos enaa vastaisi kirjoitettua.
 *
 * KAKSI KARSINTAA LISAA, molemmat tuotosta lukemalla loydettyja:
 *
 * 1. YRITYSREKISTERI EI OLE HANKKEEN LAHDE. "Asunto Oy X" -nimiset
 *    hankkeet osuvat yhtiotietosivuille: `kauppalehti.fi/yritykset/
 *    yritys/<id>` (5 osumaa), `asiakastieto.fi/yritykset/...` (2).
 *    Sivulla on y-tunnus ja tilinpaatos, ei hanketta. Huomaa etta
 *    kauppalehti.fi on muuten kelpo lahde -- sen
 *    `/lehdistotiedotteet/` kelpaa -- joten saanto on POLUSSA eika
 *    verkkotunnuksessa.
 *
 * 2. TIETOSANAKIRJA JA KILPAILUTUSALUSTA. `fi.wikipedia.org` kuvaa
 *    kohteen muttei ole julkaisijan ilmoitus; `mercell.com`
 *    uudelleenjulkaisee Hilman ilmoituksia kuten cobrief ja
 *    openprocurements ([[rakennuslehti-is-secondary]]).
 *
 *   npx tsx scripts/kirjoita-loydetyt-lahteet.ts
 *   npx tsx scripts/kirjoita-loydetyt-lahteet.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const TUNNISTE = "lahde_verkkohausta_2026_11"
const TUOTOS = "C:/Users/johan/tyomaat-app/.tmp-lahdehaku.txt"

const ESTO_TUNNUS =
  /(^|\.)(wikipedia\.org|mercell\.com|asiakastieto\.fi|cobrief\.com|openprocurements\.com|profinder\.fi|etuovi\.com|oikotie\.fi|linkedin\.com)$/i

/* Yritysrekisterisivu: y-tunnus ja tilinpaatos, ei hanketta. */
const ESTO_POLKU = /\/yritykset\/(yritys|fi)\/|\/haku\/|\/yhteystiedot\/?$/i

function kelpaa(url: string): string | null {
  try {
    const osoite = new URL(url)
    if (ESTO_TUNNUS.test(osoite.hostname)) return `esto: ${osoite.hostname}`
    if (ESTO_POLKU.test(osoite.pathname)) return `esto: polku ${osoite.pathname.slice(0, 40)}`
  } catch {
    return "esto: viallinen osoite"
  }
  return null
}

async function main() {
  const rivit = readFileSync(TUOTOS, "utf8").split("\n").filter(Boolean)
  console.log(`tuotoksessa ${rivit.length} riviä\n`)

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hylatyt: string[] = []
  const hyvaksytyt: { id: string; nimi: string; url: string; sanat: string }[] = []

  for (const r of rivit) {
    const [id, nimi, , url, sanat] = r.split("\t")
    const syy = kelpaa(url)
    if (syy) {
      hylatyt.push(`${String(nimi).slice(0, 44).padEnd(44)} ${syy}`)
      continue
    }
    hyvaksytyt.push({ id, nimi, url, sanat })
  }

  console.log(`HYLATTY (${hylatyt.length}):`)
  for (const h of hylatyt) console.log(`  ${h}`)

  console.log(`\n${APPLY ? "KIRJOITETAAN" : "KIRJOITETTAISIIN"} ${hyvaksytyt.length}`)
  if (!APPLY) {
    console.log("\nKUIVAHARJOITUS")
    return
  }

  /*
   * Hankkeet luetaan kerran, ei yhta kyselya per rivi: instanssi on
   * NANO ja taman session toistuvat kyselyt osuivat yhteen kannan
   * kaatumisen kanssa.
   */
  const idt = hyvaksytyt.map((h) => h.id)
  const vanhat: any[] = []
  for (let i = 0; i < idt.length; i += 50) {
    const { data, error } = await db
      .from("projects")
      .select("id,metadata")
      .in("id", idt.slice(i, i + 50))
    if (error) throw error
    vanhat.push(...(data ?? []))
  }
  const metaById = new Map(vanhat.map((v) => [String(v.id), v.metadata ?? {}]))

  let kirjoitettu = 0
  let ohitettu = 0
  for (const h of hyvaksytyt) {
    const vanha = metaById.get(h.id)
    if (!vanha) {
      console.log(`  EI LOYDY ${h.nimi.slice(0, 40)}`)
      continue
    }
    /* Jos lahde on ehtinyt tulla valissa, sita ei ylikirjoiteta. */
    if (vanha.source_url) {
      ohitettu++
      continue
    }
    const md = {
      ...vanha,
      source_url: h.url,
      field_sources: {
        ...(vanha.field_sources ?? {}),
        source_url: `verkkohaku, vahvistettu sivulta sanoilla: ${h.sanat}`,
      },
      takautuvat_ajot: [
        ...new Set([...(Array.isArray(vanha.takautuvat_ajot) ? vanha.takautuvat_ajot : []), TUNNISTE]),
      ],
    }
    const { error } = await db.from("projects").update({ metadata: md }).eq("id", h.id)
    if (error) console.log(`  VIRHE ${h.nimi.slice(0, 36)}: ${error.message}`)
    else kirjoitettu++
  }

  console.log(`\n=== AJETTU ===`)
  console.log(`  kirjoitettu ${kirjoitettu}, ohitettu (lahde oli jo) ${ohitettu}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
