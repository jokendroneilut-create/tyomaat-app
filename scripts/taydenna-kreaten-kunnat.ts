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
 * KREATEN KUNNAT, MAAKUNNAT JA TILAAJAT TAKAUTUVASTI (D-371).
 *
 * Resolveri korjattiin 3.11.2026 lukemaan kunta `Osoite`-kentasta ja
 * tilaaja kuvauksen tilaajamaininnasta, mutta fact-tyolainen kasittelee
 * dokumentin vain kerran -- korjattu putki ei paivita vanhoja rivaja.
 *
 * Mitattu 3.11.2026: 14/44 jonorivilta puuttui kunta, ja 13 niista oli
 * jo HYVAKSYTTYJA eli eleavia hankkeita listalla ilman kaupunkia.
 * Osoitteen pilkun jalkeinen hanta ratkaisee 11.
 *
 * TAYTTAA VAIN TYHJAN. Johannes taydentaa osapuolia kasin
 * ([[manual-parties-linkedin]]), eika kasin annettu arvo saa havita.
 * Kunta ja maakunta kirjoitetaan vain jos ne puuttuvat, tilaaja vain jos
 * `developer` on tyhja.
 *
 * TUNNISTE KIRJOITETAAN AINA ([[backfill-marker]]).
 *
 *   npx tsx scripts/taydenna-kreaten-kunnat.ts
 *   npx tsx scripts/taydenna-kreaten-kunnat.ts --apply
 */
import { getMunicipalityByAnyForm } from "../lib/geo/municipalityFromName"
import { extractClientFromText } from "../lib/agent/fetchSttHakuSource"

const APPLY = process.argv.includes("--apply")
const TUNNISTE = "kreate_kunta_tilaaja_2026_11"

function kuntaOsoitteesta(osoite: string | null | undefined) {
  const osat = String(osoite ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .reverse()
  for (const osa of osat) {
    const kunta = getMunicipalityByAnyForm(osa)
    if (kunta) return kunta
  }
  return null
}

const tyhja = (v: unknown) => v === null || v === undefined || String(v).trim() === ""

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Sivutettu luku; WHERE JSON-kenttaan on taysi taulunluku ([[backfill-run-limits]]). */
  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,status,municipality,metadata")
      .range(a, a + 999)
    if (error) throw error
    jono.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,region,developer,metadata")
      .range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  /* Hanke loytyy osoitteella tai lahdehistoriasta ([[own-data-unread]]). */
  const hankeOsoitteella = new Map<string, any>()
  for (const h of hankkeet) {
    const urlit = [
      h.metadata?.source_url,
      ...(Array.isArray(h.metadata?.source_history) ? h.metadata.source_history : []).map(
        (x: any) => (typeof x === "string" ? x : x?.document_url)
      ),
    ]
    for (const u of urlit) if (u && !hankeOsoitteella.has(String(u))) hankeOsoitteella.set(String(u), h)
  }

  const kreate = jono.filter((r) => r.metadata?.resolver === "kreateResolver")
  console.log(`Kreate-jonorivia ${kreate.length}\n`)

  let jonoKunta = 0
  let jonoTilaaja = 0
  let hankeKunta = 0
  let hankeTilaaja = 0
  const eiRatkea: string[] = []

  for (const r of kreate) {
    const kunta = tyhja(r.municipality) ? kuntaOsoitteesta(r.metadata?.project_address) : null
    const tilaaja = tyhja(r.metadata?.developer)
      ? extractClientFromText(null, String(r.metadata?.description ?? ""))
      : null

    const hanke = hankeOsoitteella.get(String(r.metadata?.source_url ?? ""))
    const hankeenKunta = hanke && tyhja(hanke.city) ? (kunta ?? kuntaOsoitteesta(r.metadata?.project_address)) : null
    const hankeenTilaaja =
      hanke && tyhja(hanke.developer)
        ? (tilaaja ?? extractClientFromText(null, String(r.metadata?.description ?? "")))
        : null

    if (tyhja(r.municipality) && !kunta) {
      eiRatkea.push(`${String(r.title).slice(0, 44)} | os="${r.metadata?.project_address ?? "-"}"`)
    }
    if (!kunta && !tilaaja && !hankeenKunta && !hankeenTilaaja) continue

    console.log(`[${r.status}] ${String(r.title).slice(0, 48)}`)
    if (kunta) {
      jonoKunta++
      console.log(`   jono:  kunta -> ${kunta.name} / ${kunta.region ?? "-"}`)
    }
    if (tilaaja) {
      jonoTilaaja++
      console.log(`   jono:  tilaaja -> ${tilaaja}`)
    }
    if (hankeenKunta) {
      hankeKunta++
      console.log(`   HANKE: kaupunki -> ${hankeenKunta.name} / ${hankeenKunta.region ?? "-"}  (${String(hanke.name).slice(0, 34)})`)
    }
    if (hankeenTilaaja) {
      hankeTilaaja++
      console.log(`   HANKE: rakennuttaja -> ${hankeenTilaaja}`)
    }

    if (!APPLY) continue

    if (kunta || tilaaja) {
      const md = { ...(r.metadata ?? {}) }
      if (kunta) md.region = md.region ?? kunta.region ?? null
      if (tilaaja) {
        md.developer = tilaaja
        md.field_sources = {
          ...(md.field_sources ?? {}),
          developer: "Kreaten hankesivun teksti: tilaajamaininta",
        }
      }
      md.takautuvat_ajot = [
        ...new Set([
          ...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []),
          TUNNISTE,
        ]),
      ]
      const paivitys: any = { metadata: md }
      if (kunta) paivitys.municipality = kunta.name
      const { error } = await db.from("potential_projects").update(paivitys).eq("id", r.id)
      if (error) console.log(`   VIRHE jono: ${error.message}`)
    }

    if (hanke && (hankeenKunta || hankeenTilaaja)) {
      const md = { ...(hanke.metadata ?? {}) }
      if (hankeenTilaaja) {
        md.field_sources = {
          ...(md.field_sources ?? {}),
          developer: "Kreaten hankesivun teksti: tilaajamaininta",
        }
      }
      md.takautuvat_ajot = [
        ...new Set([
          ...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []),
          TUNNISTE,
        ]),
      ]
      const paivitys: any = { metadata: md }
      if (hankeenKunta) {
        paivitys.city = hankeenKunta.name
        if (tyhja(hanke.region)) paivitys.region = hankeenKunta.region ?? null
      }
      if (hankeenTilaaja) paivitys.developer = hankeenTilaaja
      const { error } = await db.from("projects").update(paivitys).eq("id", hanke.id)
      if (error) console.log(`   VIRHE hanke: ${error.message}`)
    }
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  jonorivit:  kunta ${jonoKunta}, tilaaja ${jonoTilaaja}`)
  console.log(`  hankkeet:   kaupunki ${hankeKunta}, rakennuttaja ${hankeTilaaja}`)
  console.log(`  kunta ei ratkea osoitteesta ${eiRatkea.length}:`)
  for (const e of eiRatkea) console.log(`     ${e}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
