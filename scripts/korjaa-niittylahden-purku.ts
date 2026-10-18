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
 * NIITTYLAHDEN PURKU OMAKSI RIVIKSEEN JA VAARA LIPPU POIS (D-308).
 *
 * Purkukohteiden erottelussa `importCandidate` tasmasi
 * "Niittylahden koulun ja paivakodin purku" OLEMASSA OLEVAAN
 * hankkeeseen 3dc2566f "Niittylahden UUSI koulu ja paivakoti".
 * Nimet ovat lahella toisiaan, mutta kyse on eri tyosta: toinen on
 * uudisrakennus, toinen vanhan rakennuksen purku. Myyjalle ne ovat
 * eri mahdollisuuksia ja todennakoisesti eri urakoitsijalle.
 *
 * Tasmays ehti kirjoittaa purkuhankkeen metadatan uuden koulun
 * riville, eli uusi koulu oli merkitty `purettava: true`. Se on
 * virhe ja poistetaan.
 *
 * Purku luodaan SUORAAN jonoon eika `importCandidate`-polun kautta:
 * polku on jo ajettu ja se antoi tuloksen jonka olen todennut
 * vaaraksi. Suora lisays on tassa tietoinen ohitus, ei oikotie.
 *
 *   npx tsx scripts/korjaa-niittylahden-purku.ts
 *   npx tsx scripts/korjaa-niittylahden-purku.ts --apply
 */

const UUSI_KOULU = "3dc2566f-9282-4557-b23e-c53b1d70d631"
const LAHDE = "9beb523a-28eb-4755-a511-99ef37bb5368"
const VIERAAT_AVAIMET = ["purettava", "purkuvuosi", "eroteltu_rivista", "eroteltu_lahteen_sanamuoto"]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* 1. Vaarat avaimet pois uuden koulun rivilta. */
  const { data: koulu, error } = await db
    .from("projects")
    .select("id, name, metadata")
    .eq("id", UUSI_KOULU)
    .maybeSingle()
  if (error || !koulu) {
    console.error(`VIRHE: hanketta ei loytynyt (${error?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const md: any = { ...(koulu.metadata ?? {}) }
  const loytyneet = VIERAAT_AVAIMET.filter((k) => k in md)
  console.log(`\n1) ${koulu.name.slice(0, 60)}`)
  console.log(`   poistettavat avaimet: ${loytyneet.join(", ") || "ei mitaan"}`)
  for (const k of loytyneet) delete md[k]

  /* 2. Purku omaksi jonoriviksi. */
  const { data: lahde, error: e2 } = await db
    .from("potential_projects")
    .select("metadata")
    .eq("id", LAHDE)
    .maybeSingle()
  if (e2 || !lahde) {
    console.error(`VIRHE: lahderivia ei loytynyt (${e2?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const lm: any = lahde.metadata ?? {}

  const { data: jo, error: e3 } = await db
    .from("potential_projects")
    .select("id")
    .eq("title", "Niittylahden koulun ja päiväkodin purku")
  if (e3) {
    console.error(`VIRHE: ${e3.message}`)
    process.exit(1)
  }
  if ((jo ?? []).length) {
    console.log(`\n2) Purkurivi on jo jonossa (${(jo ?? []).length} kpl). Ei lisata.`)
  } else {
    console.log(`\n2) Lisataan jonoon: Niittylahden koulun ja päiväkodin purku`)
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  if (loytyneet.length) {
    const { error: e4 } = await db.from("projects").update({ metadata: md }).eq("id", UUSI_KOULU)
    if (e4) {
      console.error(`VIRHE lipun poistossa: ${e4.message}`)
      process.exit(1)
    }
    console.log(`   poistettu ${loytyneet.length} avainta`)
  }

  if (!(jo ?? []).length) {
    const kuvaus =
      `Joensuun Tilakeskus esittää Niittylahden vanhan koulun ja päiväkodin purettavaksi vuonna 2027. ` +
      `Lähteen sanamuoto: "Nittylahden koulu ja päiväkoti". ` +
      `Esitys sisältyy Tilakeskuksen vuoden 2027 investointiohjelmaan, jonka konsernijaosto käsittelee 19.10.2026. ` +
      `HUOM: samalle paikkakunnalle rakennetaan uusi koulu ja päiväkoti, joka on oma hankkeensa — ` +
      `tämä rivi koskee vanhan rakennuksen purkua.`

    const { error: e5 } = await db.from("potential_projects").insert({
      title: "Niittylahden koulun ja päiväkodin purku",
      municipality: "Joensuu",
      status: "new",
      confidence: 75,
      source_count: 1,
      metadata: {
        region: lm.region ?? "Pohjois-Karjala",
        source: lm.source_name ?? "joensuu_paatokset",
        source_name: lm.source_name ?? "joensuu_paatokset",
        source_url: `${lm.source_url}#niittylahden-koulu-ja-paivakoti`,
        operation: "Niittylahden koulun ja päiväkodin purku",
        description: kuvaus,
        developer: "Joensuun kaupunki",
        builder: null,
        phase_hint: "Suunnittelussa",
        building_type: "Koulu",
        purettava: true,
        purkuvuosi: 2027,
        eroteltu_rivista: LAHDE,
        eroteltu_lahteen_sanamuoto: "Nittylahden koulu ja päiväkoti",
        /* Naapurihanke, jotta katselmoija nakee eron heti. */
        liittyva_hanke: UUSI_KOULU,
      },
    })
    if (e5) {
      console.error(`VIRHE lisayksessa: ${e5.message}`)
      process.exit(1)
    }
    console.log(`   lisatty jonoon`)
  }

  console.log("\nVALMIS.")
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
