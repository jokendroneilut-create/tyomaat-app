import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
import { randomInt } from "node:crypto"

/*
 * SATUNNAINEN HANKE TARKASTELUUN.
 *
 * Johannes 8.11.2026: *"pystytko valitsemaan sattumanvaraisesti jonkun
 * hankkeen jonka otan tarkasteluun? Nain isoa datamassaa ei oikein
 * pysty tarkastelemaan muuten kuin satunnaistarkistamisella."*
 *
 * ARPA, EI VALINTA. Jos malli (tai ihminen) "valitsee" hankkeen, otos
 * on vino: huomio hakeutuu siihen mika nayttaa poikkeavalta. Tama
 * skripti arpoo `crypto.randomInt`illa koko joukosta, ja tulostaa
 * nimittajan nakyviin ([[name-the-denominator]],
 * [[sample-must-be-representative]]).
 *
 * OLETUSJOUKKO ON SE MITA ASIAKAS NAKEE: status `active` ja
 * `is_public`. `--kaikki` ottaa mukaan myos piilotetut ja arkistoidut.
 *
 *   npx tsx scripts/satunnainen-hanke.ts
 *   npx tsx scripts/satunnainen-hanke.ts --n 3
 *   npx tsx scripts/satunnainen-hanke.ts --kaikki
 *   npx tsx scripts/satunnainen-hanke.ts --vaihe rakenteilla
 */
const argv = process.argv.slice(2)
const KAIKKI = argv.includes("--kaikki")
const MAARA = Math.max(1, Number(argv[argv.indexOf("--n") + 1]) || 1)
const VAIHE = argv.includes("--vaihe") ? String(argv[argv.indexOf("--vaihe") + 1] ?? "") : null

const KENTAT = [
  "id", "name", "city", "region", "location", "phase", "status", "is_public",
  "property_type", "estimated_cost", "floor_area", "apartments",
  "construction_start", "start_date", "estimated_completion", "completed_at",
  "developer", "builder", "contractor", "architectural_design",
  "structural_design", "hvac_design", "electrical_design",
  "geotechnical_design", "earthworks_contractor", "additional_info",
  "latitude", "longitude", "needs_review", "source_confidence",
  "last_verified_at", "created_at",
].join(",")

function tulosta(h: any, md: any) {
  const kuvaus = String(h.additional_info ?? "")
  const kentta = (nimi: string, arvo: unknown) => {
    const teksti = arvo === null || arvo === undefined || arvo === "" ? "–" : String(arvo)
    console.log(`  ${nimi.padEnd(22)} ${teksti}`)
  }
  console.log("=".repeat(100))
  console.log(`${h.name}`)
  console.log(`  https://app.tyomaat.fi/tic/projects/${h.id}`)
  console.log(`  https://app.tyomaat.fi/projects/${h.id}`)
  console.log("")
  kentta("kunta", h.city)
  kentta("maakunta", h.region)
  kentta("sijainti", h.location)
  kentta("vaihe", `${h.phase ?? "–"}   (status ${h.status}, julkinen ${h.is_public})`)
  kentta("kohdetyyppi", h.property_type)
  kentta("kustannusarvio", h.estimated_cost ? `${Number(h.estimated_cost).toLocaleString("fi-FI")} €` : null)
  kentta("kerrosala", h.floor_area)
  kentta("asuntoja", h.apartments)
  kentta("aloitus", h.construction_start ?? h.start_date)
  kentta("valmistuminen", h.estimated_completion ?? h.completed_at)
  kentta("rakennuttaja", h.developer)
  kentta("rakentaja", h.builder)
  kentta("urakoitsija", h.contractor)
  kentta("arkkitehti", h.architectural_design)
  kentta("rakennesuunn.", h.structural_design)
  kentta("LVI / sähkö", [h.hvac_design, h.electrical_design].filter(Boolean).join(" / ") || null)
  kentta("geo / maanrak.", [h.geotechnical_design, h.earthworks_contractor].filter(Boolean).join(" / ") || null)
  kentta("koordinaatit", h.latitude && h.longitude ? `${h.latitude}, ${h.longitude}` : null)
  kentta("lähde", md.source_name ?? md.source ?? null)
  kentta("lähdeosoite", md.source_url ?? md.documents_url ?? null)
  kentta("luotu", String(h.created_at).slice(0, 10))
  kentta("tarkistettu", h.last_verified_at ? String(h.last_verified_at).slice(0, 10) : null)
  if (h.needs_review) kentta("needs_review", "kyllä")
  const yh = Array.isArray(md.contact_persons) ? md.contact_persons : []
  kentta("yhteyshenkilöt", yh.length ? yh.map((y: any) => `${y.name ?? "?"}${y.title ? ` (${y.title})` : ""}${y.phone ? ` ${y.phone}` : ""}${y.email ? ` ${y.email}` : ""}`).join(" | ") : null)
  if (Array.isArray(md.takautuvat_ajot) && md.takautuvat_ajot.length) kentta("takautuvat ajot", md.takautuvat_ajot.join(", "))
  console.log("")
  console.log(`  KUVAUS (${kuvaus.length} merkkiä):`)
  console.log(kuvaus ? kuvaus.split("\n").map((r) => `    ${r}`).join("\n") : "    – ei kuvausta –")
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  /* Tunnisteet ensin: koko rivin lukeminen koko taulusta on kallista ([[metadata-column-is-the-cost]]). */
  const idt: string[] = []
  for (let a = 0; ; a += 1000) {
    let kysely = db.from("projects").select("id").range(a, a + 999)
    if (!KAIKKI) kysely = kysely.eq("status", "active").eq("is_public", true)
    if (VAIHE) kysely = kysely.eq("phase", VAIHE)
    const { data, error } = await kysely
    if (error) throw error
    idt.push(...(data ?? []).map((x: any) => String(x.id)))
    if (!data || data.length < 1000) break
  }

  const joukko = KAIKKI ? "kaikki hankkeet" : "asiakkaalle näkyvät hankkeet (active + julkinen)"
  console.log(`Arvonta: ${joukko}${VAIHE ? `, vaihe "${VAIHE}"` : ""} — nimittäjä ${idt.length}`)
  if (!idt.length) { console.log("ei rivejä"); return }

  const valitut = new Set<string>()
  while (valitut.size < Math.min(MAARA, idt.length)) valitut.add(idt[randomInt(idt.length)])
  console.log(`Arvottu ${valitut.size} / ${idt.length} (1 : ${Math.round(idt.length / valitut.size)})\n`)

  for (const id of valitut) {
    const { data, error } = await db.from("projects").select(`${KENTAT},metadata`).eq("id", id).maybeSingle()
    if (error) throw error
    const h: any = data
    if (!h) continue
    tulosta(h, h.metadata ?? {})
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
