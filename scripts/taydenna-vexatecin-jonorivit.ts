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
 * VEXATECIN JONORIVIT: YHTEYSHENKILOT JA KAKSI TUTTUA KOHDETTA (D-322).
 *
 * Lahde ajettiin ennen kuin keraajaan lisattiin yhteyshenkiloiden
 * poiminta, joten kuusi riviä on jo jonossa ilman niita. Keraaja ei
 * kirjoita jo tuotua riviä uudelleen (`duplicate_source`), joten ne
 * taydennetaan tassa samalla funktiolla jota keraaja kayttaa.
 *
 * KAKSI RIVIA ON TUTTUA KOHDETTA:
 *
 *   Perusmaki   sama hanke kuin `f7534625`, jonka juuri taydensin
 *               Vexatecin tiedotteesta (D-321). Merkitaan kasitellyksi.
 *
 *   Joensuu     EI yhdisteta. Kannassa on `f1dd9a74`
 *               "Asumispalveluyksikko, Rantakyla": sama kaupunki, sama
 *               rakentaja ja sama tilaajapari (Toivo + Norlandia),
 *               mutta ERI KATU ja ERI KAYTTAJARYHMA:
 *
 *                 kannassa   Rantakylankatu 10&12, kaksi yksikkoa,
 *                            yhteensa 120 asuntoa IKAANTYNEILLE
 *                 tiedote    Penttilankadun tontti, 60 paikkaa,
 *                            2 487 brm², KEHITYSVAMMAISILLE
 *
 *               Nama voivat olla eri hankkeita tai saman hankkeen eri
 *               vaiheita. Rivi saa viitteen naapurihankkeeseen, ja
 *               katselmoija ratkaisee (muisti: check-duplicate-reviews).
 *
 *   npx tsx scripts/taydenna-vexatecin-jonorivit.ts
 *   npx tsx scripts/taydenna-vexatecin-jonorivit.ts --apply
 */

import { haeVexatecinJulkaisut, lapaiseeSuodatuksen, vexatecEhdokkaat } from "../lib/agent/fetchVexatecSource"

const PERUSMAKI_HANKE = "f7534625-7a78-48b7-8e0c-cfa3bf95b680"
const JOENSUU_HANKE = "f1dd9a74-9d76-4fb8-b4be-b69fe200fb96"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const julkaisut = await haeVexatecinJulkaisut()
  const ehdokkaat = julkaisut.filter(lapaiseeSuodatuksen).flatMap(vexatecEhdokkaat)
  const osoitteella = new Map(ehdokkaat.map((e) => [e.source_url, e]))

  const { data: rivit, error } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .eq("metadata->>source_name", "vexatec")
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }
  console.log(`\nJonorivejä ${(rivit ?? []).length}, ehdokkaita lähteestä ${ehdokkaat.length}\n`)

  for (const r of (rivit ?? []) as any[]) {
    const md: Record<string, any> = r.metadata ?? {}
    const ehdokas = osoitteella.get(String(md.source_url ?? ""))
    const yhteys = ((ehdokas?.metadata as any)?.contact_persons ?? []) as any[]
    const paivitys: Record<string, any> = { ...md }
    const muutokset: string[] = []

    if (yhteys.length && !(md.contact_persons ?? []).length) {
      paivitys.contact_persons = yhteys
      muutokset.push(`yhteyshenkilöt ${yhteys.map((c) => c.name).join(", ")}`)
    }

    let tila: string | null = null
    if (String(md.source_url ?? "").includes("32-rivitaloasuntoa-espoon-perusmakeen")) {
      paivitys.matched_existing_project_id = PERUSMAKI_HANKE
      paivitys.yhdistetty = {
        milloin: new Date().toISOString().slice(0, 10),
        syy: "sama hanke kuin f7534625; tiedote on jo sen lähteenä",
      }
      tila = "ignored"
      muutokset.push(`sama kuin ${PERUSMAKI_HANKE.slice(0, 8)} -> ignored`)
    }
    if (String(md.source_url ?? "").includes("palveluasumisyksikko-joensuuhun")) {
      paivitys.liittyva_hanke = JOENSUU_HANKE
      muutokset.push(`viite naapurihankkeeseen ${JOENSUU_HANKE.slice(0, 8)} (ei yhdistetä)`)
    }

    console.log(`   ${r.id.slice(0, 8)} ${String(r.title).slice(0, 46).padEnd(48)} ${muutokset.join(" | ") || "ei muutosta"}`)

    if (!apply || !muutokset.length) continue
    const { error: e1 } = await db
      .from("potential_projects")
      .update({ metadata: paivitys, ...(tila ? { status: tila } : {}) })
      .eq("id", r.id)
    if (e1) console.error(`      VIRHE: ${e1.message}`)
    else console.log(`      kirjoitettu`)
  }

  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
