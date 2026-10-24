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
 * VAARAN TASMAYKSEN PERUMINEN: MALMIN PURKURIVI (D-350).
 *
 * Jalonin tyomaalistan ensimmaisessa ajossa kohde "Malmin peruskoulu ja
 * paivakoti" tasmasi luottamuksella 70 riviin "Malmin peruskoulun
 * liikuntahallin purkaminen" -- eri tyo samassa osoitteessa. Kuvio on
 * nyt estetty jasentimessa (`haveDifferentDemolition`), mutta jo
 * kirjoitettu on peruttava kasin ([[matched-overwrites-fields]]).
 *
 * PURKURIVI `2e12e431` sai Jalonilta kolme asiaa jotka eivat ole sen:
 *   builder               tyhja -> "Jalon Group Oy" (purkajaa ei tiedeta)
 *   estimated_completion  2026-05-31 -> 2028-04-30 (koulun valmistuminen)
 *   contact_persons       tyomaan numero, joka on koulutyomaan
 * Lisaksi `field_sources` korvautui Jalonin omalla.
 *
 * Oikea paiva on rivin omassa metadatassa (`metadata.estimated_completion`
 * = 2026-05-31), jota tasmays ei koskenut -- siita se palautetaan.
 *
 * OIKEA RIVI `853a0698` ("Malmin peruskoulun ja paivakodin rakentaminen",
 * rakentaja Jalon Uusimaa Oy) saa tyomaan numeron, joka sille kuuluu.
 * Rakentajaa ei korvata: alueyhtio on tarkempi kuin konserni.
 *
 *   npx tsx scripts/korjaa-malmin-purkurivi.ts
 *   npx tsx scripts/korjaa-malmin-purkurivi.ts --apply
 */

import { mergeContacts } from "../lib/projects/contacts"

const PURKU = "2e12e431-9ed0-4407-81c2-920b02f33f3c"
const RAKENNUS = "853a0698-9291-48be-ace6-e618fa23ef10"
const JALON_LINKKI = "https://jalon.fi/tyomaatiedot/malmin-peruskoulu-ja-paivakoti/"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id,name,builder,estimated_completion,metadata")
    .in("id", [PURKU, RAKENNUS])
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  const purku = data?.find((r) => r.id === PURKU)
  const rakennus = data?.find((r) => r.id === RAKENNUS)
  if (!purku || !rakennus) {
    console.error("Riviä ei löydy")
    process.exit(1)
  }

  /* --- 1. Purkurivi ennalleen --- */
  const pmd: Record<string, any> = { ...(purku.metadata ?? {}) }
  const oikeaPaiva = pmd.estimated_completion ?? null
  const jalonKontaktit = (pmd.contact_persons ?? []).filter((c: any) =>
    String(c?.source ?? "").includes("jalon.fi")
  )
  pmd.contact_persons = (pmd.contact_persons ?? []).filter(
    (c: any) => !String(c?.source ?? "").includes("jalon.fi")
  )
  delete pmd.field_sources
  pmd.peruttu_tasmays = {
    lahde: "jalon_tyomaat",
    syy: "purku ja rakentaminen ovat eri työ samassa osoitteessa (D-350)",
    milloin: new Date().toISOString().slice(0, 10),
  }

  console.log(`\n1) PURKURIVI ${purku.name.slice(0, 54)}`)
  console.log(`   rakentaja "${purku.builder}" -> tyhjä`)
  console.log(`   valmistuu ${purku.estimated_completion} -> ${oikeaPaiva ?? "tyhjä"} (rivin oma metadata)`)
  console.log(`   poistetaan yhteyshenkilöitä: ${jalonKontaktit.length}`)

  /* --- 2. Numero oikealle riville --- */
  const rmd: Record<string, any> = { ...(rakennus.metadata ?? {}) }
  const ennen = (rmd.contact_persons ?? []).length
  rmd.contact_persons = mergeContacts(
    Array.isArray(rmd.contact_persons) ? rmd.contact_persons : [],
    jalonKontaktit
  )
  console.log(`\n2) RAKENNUSRIVI ${rakennus.name.slice(0, 54)}`)
  console.log(`   rakentaja pysyy: ${rakennus.builder}`)
  console.log(`   yhteyshenkilöt ${ennen} -> ${rmd.contact_persons.length}`)
  for (const c of jalonKontaktit) console.log(`      + ${c.phone} (${c.title ?? "-"})`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e1 } = await db
    .from("projects")
    .update({ builder: null, estimated_completion: oikeaPaiva, metadata: pmd })
    .eq("id", PURKU)
  if (e1) console.error(`   VIRHE purkurivi: ${e1.message}`)

  const { error: e2 } = await db.from("projects").update({ metadata: rmd }).eq("id", RAKENNUS)
  if (e2) console.error(`   VIRHE rakennusrivi: ${e2.message}`)

  if (!e1 && !e2) console.log("\nKirjoitettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
