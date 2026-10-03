import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MISTA OSAPUOLETTOMIEN JONO OIKEASTI KOOSTUU (D-232).
 *
 * Johannes 3.10.2026: *"se ei ole osapuoleton koska NCC tiedetaan"* —
 * jonossa oli hanke jonka tekstissa urakoitsija on ensimmainen sana.
 *
 * Jono on `developer` JA `builder` tyhjia. Tama ei kerro onko osapuoli
 * tiedossa, vain etta se ei ole kentassa. Tama skripti luokittelee jonon
 * neljaan ryhmaan, koska ryhmat vaativat eri tyon:
 *
 *   1. KAKSOISKAPPALE   sama hanke on kannassa toiseen kertaan
 *                       osapuolineen -> yhdistaminen, ei poiminta
 *   2. NIMI TEKSTISSA   osapuoli lukee hankkeen omassa tekstissa
 *                       -> poiminta, roolin paattely on tyo
 *   3. KAAVA            kaavarivi jonka hankevastaava on tiedossa
 *                       toisella rivilla -> ei yhdisteta (kaava pidetaan
 *                       erillaan), mutta rakennuttaja on taytettavissa
 *   4. AIDOSTI TYHJA    lahteessa ei ole osapuolta
 *
 * EI MUUTA MITAAN. Tulostaa vain.
 *
 *   npx tsx scripts/mittaa-osapuolettomat.ts
 *   npx tsx scripts/mittaa-osapuolettomat.ts --listaa
 */

const VAIHEET = ["Suunnittelussa", "Suunnittelu", "Rakenteilla", "Rakentaminen aloitettu"]
const KIRJAIN = /[0-9a-zA-ZåäöÅÄÖ]/
const KAAVA = /kaava|kaavoitus/i

function sisaltaaSanana(teksti: string, nimi: string, isotKirjaimetMerkitsevat: boolean): boolean {
  const t = isotKirjaimetMerkitsevat ? teksti : teksti.toLowerCase()
  const n = isotKirjaimetMerkitsevat ? nimi : nimi.toLowerCase()
  let i = t.indexOf(n)
  while (i !== -1) {
    const ennen = i === 0 ? "" : t[i - 1]
    const jalkeen = i + n.length >= t.length ? "" : t[i + n.length]
    if (!KIRJAIN.test(ennen) && !KIRJAIN.test(jalkeen)) return true
    i = t.indexOf(n, i + 1)
  }
  return false
}

async function main() {
  const listaa = process.argv.includes("--listaa")
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select(
        "id, name, city, region, location, phase, status, is_public, developer, builder, property_type, estimated_completion, additional_info, latitude, longitude, completed_at, permit_number:metadata->>permit_number, property_id:metadata->>property_id, source_name:metadata->>source_name"
      )
      .range(from, from + 999)
    if (error) throw error
    kaikki.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const onOsapuoli = (p: any) => Boolean(String(p.developer ?? "").trim() || String(p.builder ?? "").trim())
  const jono = kaikki.filter(
    (p) => p.status === "active" && p.is_public === true && !onOsapuoli(p) && VAIHEET.includes(String(p.phase))
  )

  /*
   * Haettavat nimet ovat niita jotka kannassa jo ovat osapuolena. Lyhyet
   * nimet (NCC, YIT, SRV, ARE) ovat juuri niita joita tassa haetaan,
   * joten pituusrajaa ei voi asettaa viiteen — mutta lyhyt nimi haetaan
   * isot kirjaimet huomioiden, jottei "are" osu sanaan "areena".
   */
  const nimet = new Set<string>()
  for (const p of kaikki) {
    for (const kentta of [p.developer, p.builder]) {
      const v = String(kentta ?? "").trim()
      if (!v) continue
      nimet.add(v)
      const ilmanYhtiomuotoa = v.replace(/\s+(oy|oyj|ab|ky|ltd)\.?$/i, "").trim()
      if (ilmanYhtiomuotoa.length >= 3) nimet.add(ilmanYhtiomuotoa)
      /* "NCC Suomi" -> myos "NCC": ensimmainen sana jos se on lyhenne. */
      const eka = ilmanYhtiomuotoa.split(/\s+/)[0]
      if (eka.length >= 3 && eka === eka.toUpperCase()) nimet.add(eka)
    }
  }
  const YLEISET = new Set(["kiinteisto", "asunto", "rakennus", "kaupunki", "kunta", "group"])
  const haettavat = [...nimet]
    .filter((n) => n.length >= 3 && !YLEISET.has(n.toLowerCase()))
    .sort((a, b) => b.length - a.length)

  const verrokit = kaikki.map((p) => ({ ...p, metadata: { permit_number: p.permit_number, property_id: p.property_id } }))

  type Rivi = { p: any; ryhma: string; todiste: string }
  const rivit: Rivi[] = []

  for (const p of jono) {
    const teksti = `${p.name ?? ""} ${p.additional_info ?? ""}`

    const tulos = findProjectMatchDetailed(
      verrokit.filter((v) => v.id !== p.id && onOsapuoli(v)) as any,
      {
        name: p.name,
        city: p.city,
        region: p.region,
        location: p.location,
        permitNumber: p.permit_number,
        propertyId: p.property_id,
        buildingType: p.property_type,
        description: p.additional_info,
      }
    )

    const osumat: string[] = []
    for (const n of haettavat) {
      if (sisaltaaSanana(teksti, n, n.length <= 4)) osumat.push(n)
      if (osumat.length >= 2) break
    }

    const onKaava = KAAVA.test(String(p.name))

    if (tulos && tulos.confidence >= 70 && !onKaava) {
      rivit.push({ p, ryhma: "1 kaksoiskappale", todiste: `${tulos.confidence}% ${tulos.project.name}` })
    } else if (onKaava && tulos && tulos.confidence >= 70) {
      rivit.push({
        p,
        ryhma: "3 kaava",
        todiste: `${tulos.confidence}% ${tulos.project.developer ?? tulos.project.builder}`,
      })
    } else if (osumat.length) {
      rivit.push({ p, ryhma: "2 nimi tekstissa", todiste: osumat.join(" | ") })
    } else {
      rivit.push({ p, ryhma: "4 aidosti tyhja", todiste: "" })
    }
  }

  const ryhmat = new Map<string, Rivi[]>()
  for (const r of rivit) ryhmat.set(r.ryhma, [...(ryhmat.get(r.ryhma) ?? []), r])

  console.log(`osapuolettomia jonossa ${jono.length}\n`)
  for (const [k, v] of [...ryhmat].sort()) {
    console.log(`  ${k.padEnd(20)} ${String(v.length).padStart(4)}  (${((v.length / jono.length) * 100).toFixed(0)} %)`)
  }

  if (!listaa) {
    console.log("\nAja --listaa nahdaksesi rivit.")
    return
  }

  for (const [k, v] of [...ryhmat].sort()) {
    console.log(`\n${"=".repeat(100)}\n${k}  (${v.length})\n`)
    for (const r of v) {
      console.log(`  ${String(r.p.name).slice(0, 56).padEnd(58)} ${String(r.p.city ?? "-").slice(0, 14).padEnd(15)} ${r.todiste.slice(0, 60)}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
