import { readFileSync } from "node:fs"

/*
 * KOHDETYYPIN KORJAUS TAKAUTUVASTI.
 *
 * Kohdetyyppi on asiakkaan ensisijainen suodatin, ja vaara arvo
 * vahingoittaa kahdesti: hanke katoaa oikeasta suodattimesta ja nousee
 * vaaraan. Mitattu 1.9.2026 60 rivin otoksella niista nakyvista
 * hankkeista joiden tyyppia saanto ei tuota otsikosta: noin 10 %
 * selvasti vaaria ("Puuilo-myymala Jamsaan" -> Toimitila,
 * "Atlantinaukio, katusuunnitelma" -> Logistiikka).
 *
 * VAIHE A - SAANTO KORJAA. Saanto lukee tyypin otsikosta, on mitattu
 * lahes virheettomaksi eika maksa mitaan. Jos se on eri mielta kuin
 * kannassa oleva arvo, saanto voittaa.
 *
 * VAIHE B - MALLIN KIRJOITTAMAT TARKISTETAAN KAHDELLA AANELLA. Rivit
 * joiden arvo ei tule lahteesta eika saannosta ovat mallin arvauksia.
 * Ne pisteytetaan uudelleen kahdesti (`resolveBuildingType`). Jos
 * kutsut ovat yksimielisia TOISESTA tyypista, arvo korvataan; muuten
 * rivi jatetaan rauhaan. Tyhjentaminen kokeiltiin ja hylattiin: se
 * poisti yhta monta oikeaa arvoa kuin vaaraa.
 *
 * KASIN MUOKATTUUN EI KOSKETA. `metadata.edited_fields` kertoo mitka
 * kentat ihminen on itse asettanut - niita ei ylikirjoiteta koneella.
 *
 *   npx tsx scripts/fix-building-type.ts --vaihe=a
 *   npx tsx scripts/fix-building-type.ts --vaihe=a --apply
 *   npx tsx scripts/fix-building-type.ts --vaihe=b --raja=50
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")
const VAIHE = process.argv.find((a) => a.startsWith("--vaihe="))?.split("=")[1] ?? "a"
const RAJA = Number(process.argv.find((a) => a.startsWith("--raja="))?.split("=")[1] ?? "100000")
const RINNAKKAIN = 6
/* Kuivaharjoituksessa rivit luetaan lapi, joten ne tulostetaan kaikki. */
const KAIKKI = Number(process.argv.find((a) => a.startsWith("--nayta="))?.split("=")[1] ?? "40")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferBuildingType, matchingBuildingTypes } = await import("../lib/agent/buildingType")
  const { resolveBuildingType } = await import("../lib/agent/quality/resolveBuildingType")
  const { BUILDING_TYPES } = await import("../lib/agent/quality/scorers/llmBuildingTypeScorer")
  const kanoniset = new Set<string>(BUILDING_TYPES as any)

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const hankkeet: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,city,property_type,status,is_public,additional_info,metadata")
      .range(f, f + 999)
    if (error) throw error
    hankkeet.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const live = hankkeet.filter((r) => r.status === "active" && r.is_public !== false)

  /* Ihmisen asettamaan kenttaan ei kosketa. */
  const kasin = (r: any) =>
    Array.isArray(r.metadata?.edited_fields) && r.metadata.edited_fields.includes("property_type")

  const kohteet = live.filter((r) => !kasin(r))
  console.log(
    `${APPLY ? "AJO" : "KUIVAHARJOITUS"} vaihe ${VAIHE.toUpperCase()}\n` +
      `  nakyvia hankkeita   ${live.length}\n` +
      `  kasin muokattuja    ${live.length - kohteet.length} (ohitetaan)\n`
  )

  if (VAIHE === "a") {
    const korjattavat = kohteet
      .map((r) => ({ r, saanto: inferBuildingType(String(r.name ?? ""), null) }))
      .filter((x) => x.saanto && x.saanto !== x.r.property_type)
      /*
       * Jos otsikko tukee myos vanhaa arvoa, sita ei vaihdeta: molemmat
       * ovat oikeita eika kone tieda kumpi on hankkeen paaasia.
       */
      .filter((x) => !matchingBuildingTypes(String(x.r.name ?? "")).includes(String(x.r.property_type ?? "")))

    console.log(`saanto eri mielta: ${korjattavat.length} rivia\n`)
    const per = new Map<string, number>()
    for (const { r, saanto } of korjattavat) {
      const avain = `${String(r.property_type ?? "(tyhja)").padEnd(18)} -> ${saanto}`
      per.set(avain, (per.get(avain) ?? 0) + 1)
    }
    for (const [k, n] of [...per].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)

    console.log(`
RIVIT (${Math.min(KAIKKI, korjattavat.length)}/${korjattavat.length}):`)
    for (const { r, saanto } of korjattavat.slice(0, KAIKKI)) {
      console.log(`  ${String(r.property_type ?? "-").padEnd(17)} -> ${String(saanto).padEnd(17)} ${String(r.name ?? "").slice(0, 62)}`)
    }

    if (!APPLY) { console.log("\nKuivaharjoitus: mitaan ei kirjoitettu."); return }

    let ok = 0
    for (const { r, saanto } of korjattavat) {
      const { error } = await admin
        .from("projects")
        .update({
          property_type: saanto,
          metadata: { ...(r.metadata ?? {}), building_type: saanto, building_type_source: "saanto" },
        })
        .eq("id", r.id)
      if (error) console.log(`  VIRHE ${r.name}: ${error.message}`)
      else ok++
    }
    console.log(`\nkorjattu ${ok} / ${korjattavat.length}`)
    return
  }

  /*
   * VAIHE B. Ehdokasrivi kertoo mika arvo tuli lahteesta: jos ehdokkaan
   * `metadata.building_type` on kanoninen, arvo on lahteen omaa tietoa
   * eika mallin arvausta.
   */
  const ehdokkaat: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin.from("potential_projects").select("metadata").range(f, f + 999)
    if (error) throw error
    ehdokkaat.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const lahteesta = new Map<string, string>()
  for (const e of ehdokkaat) {
    const pid = e.metadata?.approved_project_id
    if (pid) lahteesta.set(String(pid), String(e.metadata?.building_type ?? "").trim())
  }

  const arvaukset = kohteet.filter((r) => {
    const nyt = String(r.property_type ?? "").trim()
    if (!nyt || !kanoniset.has(nyt)) return false
    if (inferBuildingType(String(r.name ?? ""), null)) return false
    return !kanoniset.has(lahteesta.get(r.id) ?? "")
  })

  console.log(`mallin arvauksia tarkistettavana: ${arvaukset.length} (kasitellaan ${Math.min(RAJA, arvaukset.length)})\n`)

  const tyo = arvaukset.slice(0, RAJA)
  let i = 0
  let sama = 0
  let muuttui = 0
  let tyhjeni = 0
  const rivit: string[] = []

  await Promise.all(
    Array.from({ length: RINNAKKAIN }, async () => {
      while (i < tyo.length) {
        const r = tyo[i++]
        const tulos = await resolveBuildingType({
          title: String(r.name ?? ""),
          description: String(r.additional_info ?? r.metadata?.description ?? ""),
          ruleBuildingType: null,
        })
        const uusi = (tulos.metadata.building_type as string | undefined) ?? null

        if (uusi === r.property_type) { sama++; continue }
        /*
         * TYHJENTAMINEN EI KANNATA - MITATTU, EI OLETETTU.
         *
         * Alkuperainen suunnitelma oli tyhjentaa kentta silloin kun
         * kaksi kutsua ei paase yksimielisyyteen. Kuivaharjoitus 60
         * rivilla 1.9.2026 kumosi sen: 12 tyhjennettavasta noin nelja
         * oli oikein ("Tuotantolaitos Jyvaskylaan" = Teollisuus,
         * "Monitoimihalli Hausjarvi" = Liikuntapaikka) ja nelja vaarin.
         * Vaihtokauppa on tasapeli, joten arvo jatetaan rauhaan.
         *
         * KORVAAMINEN sen sijaan osui: seitsemasta vaihdosta viisi oli
         * selva parannus ("Kelan paatoimitalo" Kulttuurirakennus ->
         * Toimitila, "Biltema Kokkolaan" -> Kauppa).
         */
        if (!uusi) { tyhjeni++; continue }
        muuttui++
        rivit.push(`  ${String(r.property_type).padEnd(17)} -> ${String(uusi ?? "(tyhja)").padEnd(17)} ${String(r.name ?? "").slice(0, 60)}`)

        if (!APPLY) continue
        await admin
          .from("projects")
          .update({
            property_type: uusi,
            metadata: { ...(r.metadata ?? {}), building_type: uusi, ...(tulos.metadata ?? {}) },
          })
          .eq("id", r.id)
      }
    })
  )

  console.log(`  vahvistui samaksi  ${sama}`)
  console.log(`  vaihtui toiseksi   ${muuttui}`)
  console.log(`  tyhjeni            ${tyhjeni}\n`)
  console.log("MUUTOKSET:")
  for (const rivi of rivit.slice(0, 80)) console.log(rivi)
  if (rivit.length > 80) console.log(`  ... ja ${rivit.length - 80} muuta`)
  if (!APPLY) console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
