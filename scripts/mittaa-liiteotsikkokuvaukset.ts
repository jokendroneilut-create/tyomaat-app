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
 * KUVAUS ON PELKKIA LIITEOTSIKOITA -- MISSA MUUALLA? (D-351)
 *
 * Johannes 26.10.2026 Suonenjoen rivista: *"tarkista onko muita
 * paassyt kantaan tai jonoon samasta lahteesta"*. Suonenjoki on
 * korjattu; tama mittaa onko sama vika muissa lahteissa.
 *
 * TUNNISTE EI OLE PITUUS vaan sisalto: kuvaus joka koostuu
 * liitelinkkien nimista ("Kuulutus 17.9.2026 Asemakaavaselostusehdotus
 * Asemakaavakartta Tonttijako") voi olla 70 merkkia, mutta se ei kerro
 * hankkeesta mitaan. Sanasto on kaavasivujen vakiosanasto.
 *
 * Ei kirjoita mitaan.
 *
 *   npx tsx scripts/mittaa-liiteotsikkokuvaukset.ts
 *   npx tsx scripts/mittaa-liiteotsikkokuvaukset.ts --lahde="Kemin kaavoitus"
 */

/* Liitteiden vakionimet kaavasivuilla. */
const LIITESANA =
  /kuulutus|selostus|kaavakartta|kaavakarttaa?|kartta|osallistumis-?\s*ja\s*arviointisuunnitelma|\boas\b|tonttijako|seurantalomake|liite|luonnos|ehdotus|havainnekuva|asemakaavamuutos|kaavaluonnos|kaavaehdotus|päätös|pöytäkirja|vastine|lausunto|selvitys|kaavamääräykset|merkinnät/gi

/* Kuinka monta kirjainta jaa jaljelle kun liitesanat poistetaan. */
const JAANNOS_RAJA = 40

function jaannos(kuvaus: string): string {
  return kuvaus
    .replace(LIITESANA, " ")
    .replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, " ")
    .replace(/[^\wåäöÅÄÖ]+/g, " ")
    .trim()
}

async function main() {
  const vainLahde = process.argv.find((a) => a.startsWith("--lahde="))?.split("=")[1]
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  type Rivi = { taulu: string; id: string; otsikko: string; kuvaus: string; lahde: string }
  const rivit: Rivi[] = []

  for (const taulu of ["projects", "potential_projects"] as const) {
    const data: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data: era, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id,name,additional_info,metadata"
            : "id,title,status,metadata"
        )
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      data.push(...(era ?? []))
      if ((era ?? []).length < 1000) break
    }
    for (const r of data) {
      if (taulu === "potential_projects" && (r.status === "ignored" || r.status === "rejected")) continue
      const kuvaus = String(r.additional_info ?? r.metadata?.description ?? "").replace(/\s+/g, " ").trim()
      if (!kuvaus) continue
      rivit.push({
        taulu,
        id: r.id,
        otsikko: String(r.name ?? r.title ?? ""),
        kuvaus,
        lahde: String(r.metadata?.source_name ?? r.metadata?.source ?? "(tuntematon)"),
      })
    }
  }

  const osumat = rivit.filter(
    (r) => r.kuvaus.length < 400 && jaannos(r.kuvaus).length < JAANNOS_RAJA && (!vainLahde || r.lahde === vainLahde)
  )

  console.log(`Rivejä joilla kuvaus: ${rivit.length}`)
  console.log(`Kuvaus on pelkkiä liiteotsikoita: ${osumat.length}\n`)

  const lahteittain = new Map<string, Rivi[]>()
  for (const o of osumat) lahteittain.set(o.lahde, [...(lahteittain.get(o.lahde) ?? []), o])

  for (const [lahde, lista] of [...lahteittain.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${String(lista.length).padStart(4)}  ${lahde}`)
    for (const r of lista.slice(0, 2)) {
      console.log(`        ${r.otsikko.slice(0, 52).padEnd(54)} "${r.kuvaus.slice(0, 60)}"`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
