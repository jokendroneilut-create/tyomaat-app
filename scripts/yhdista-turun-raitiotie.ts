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
 * TURUN RAITIOTIEN KAHDEN RIVIN YHDISTAMINEN (D-306).
 *
 * Johannes 18.10.2026: *"yhdista nuo kaksi turun raitiotiehanketta."*
 *
 * TEKEE SAMAN KUIN KATSELMOINTINAPPI, EIKA OMAA VERSIOTA. Vaiheet on
 * luettu `app/api/tic/duplicates/review/route.ts`:sta ja ne ajetaan
 * samassa jarjestyksessa samoilla funktioilla:
 *
 *   1. pari -> confirmed_duplicate + reviewed_at
 *   2. voittaja `chooseDuplicateSurvivor`-funktiolla
 *   3. SUOJA: jos piilotettava on jonkun omissa, piilotus jaa tekematta
 *   4. edistyneempi vaihe siirretaan voittajalle (`moreAdvancedPhase`)
 *   5. haviaja `is_public = false`
 *
 * Yhdistaminen EI poista rivia eika muuta nimea: haviaja jaa kantaan
 * piilotettuna, ja historia sailyy.
 *
 *   npx tsx scripts/yhdista-turun-raitiotie.ts
 *   npx tsx scripts/yhdista-turun-raitiotie.ts --apply
 */

const A = "85a116f7-2e91-4d1a-b2b7-cfb6794c3ff5"
const B = "09d73bd8-69fe-444f-a42c-ca61557a2c34"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { chooseDuplicateSurvivor, moreAdvancedPhase } = await import(
    "../lib/projects/duplicateSurvivor"
  )
  const { phaseOrder } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: hankkeet, error } = await db
    .from("projects")
    .select(
      "id,name,phase,created_at,developer,builder,location,lat,lng,apartments,floor_area,estimated_cost,construction_start,property_type,metadata,is_public"
    )
    .in("id", [A, B])
  if (error || !hankkeet || hankkeet.length !== 2) {
    console.error(`VIRHE: hankkeita ei loytynyt (${error?.message ?? hankkeet?.length})`)
    process.exit(1)
  }

  const [a, b] = hankkeet as any[]
  const valinta = chooseDuplicateSurvivor(a, b)
  const jaava = hankkeet.find((h: any) => h.id === valinta.keepId) as any
  const piilotettava = hankkeet.find((h: any) => h.id === valinta.hideId) as any

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`\nJAA NAKYVIIN   ${jaava.name}`)
  console.log(`               ${jaava.id}  ${jaava.phase}  luotu ${String(jaava.created_at).slice(0, 10)}`)
  console.log(`PIILOTETAAN    ${piilotettava.name}`)
  console.log(`               ${piilotettava.id}  ${piilotettava.phase}  luotu ${String(piilotettava.created_at).slice(0, 10)}`)
  console.log(`\nvalinnan peruste: ${valinta.reason}`)

  if (piilotettava.is_public === false) {
    console.log("\nPiilotettava on jo ei-julkinen. Ei tehtavaa.")
    return
  }

  /* Suoja: asiakkaan omat menevat edelle. */
  const { data: suosikit, error: suosikkiVirhe } = await db
    .from("user_project_favorites")
    .select("user_id")
    .eq("project_id", valinta.hideId)
  if (suosikkiVirhe) {
    console.error(`VIRHE suosikkien tarkistuksessa: ${suosikkiVirhe.message}`)
    process.exit(1)
  }
  console.log(`piilotettava on ${suosikit?.length ?? 0} kayttajan omissa`)
  if ((suosikit?.length ?? 0) > 0) {
    console.log("EI PIILOTETA: hanke on jonkun omissa, se jaa ihmisen paatettavaksi.")
    return
  }

  const nostettuVaihe = moreAdvancedPhase(jaava.phase, piilotettava.phase, phaseOrder)
  console.log(`vaihe voittajalle: ${nostettuVaihe ?? "ei muutosta"}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e1 } = await db
    .from("project_duplicate_candidates")
    .update({ status: "confirmed_duplicate", reviewed_at: new Date().toISOString() })
    .or(`and(project_id_a.eq.${A},project_id_b.eq.${B}),and(project_id_a.eq.${B},project_id_b.eq.${A})`)
  if (e1) {
    console.error(`VIRHE parin paivityksessa: ${e1.message}`)
    process.exit(1)
  }

  if (nostettuVaihe) {
    const { error: e2 } = await db
      .from("projects")
      .update({ phase: nostettuVaihe })
      .eq("id", valinta.keepId)
    if (e2) {
      console.error(`VIRHE vaiheen siirrossa: ${e2.message}`)
      process.exit(1)
    }
  }

  const { error: e3 } = await db
    .from("projects")
    .update({ is_public: false })
    .eq("id", valinta.hideId)
  if (e3) {
    console.error(`VIRHE piilotuksessa: ${e3.message}`)
    process.exit(1)
  }

  console.log(`\nYHDISTETTY. Nakyviin jai "${jaava.name}".`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
