import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * EURAN KORTTELI 164: KUVAUS KUVAKAAPPAUKSESTA (D-268).
 *
 * Tama on ainoa Euran kaava jonka selostusta ei voi lukea koneellisesti:
 * PDF:n fonteissa ei ole merkkikarttaa, joten kaikki 40 sivua purkautuvat
 * roskaksi seka pdf-parsella etta popplerilla ("AABCCDE"). Sama koskee
 * saman hankkeen neljaa muuta liitetta.
 *
 * Johannes luki luvun 1.3 ruudulta ja toimitti sen kuvana 11.10.2026.
 * Teksti kirjataan sellaisenaan ja sen alkupera merkitaan
 * `metadata.tiedon_lahteet`-kenttaan (docs/18_TYOMAAKUVAT.md).
 *
 *   npx tsx scripts/lisaa-kortteli164-kuvaus.ts
 *   npx tsx scripts/lisaa-kortteli164-kuvaus.ts --apply
 */

const ID = "eb57460a-5054-4451-a3b8-393c64ce0343"

const KUVAUS =
  "Laadittavan asemakaavan muutoksen tarkoituksena on osoittaa voimassa " +
  "olevan asemakaavan mukainen rakentamaton AO-kortteli 164 " +
  "teollisuusrakennusten korttelialueeksi (TY) ja mahdollistaa kaava-alueella " +
  "alueen länsipuolelle kortteliin 163 sijoittuvaa yritystoimintaa tukeva " +
  "varastorakentaminen."

const SELOSTUS =
  "https://www.eura.fi/wp-content/uploads/2026/10/selostus__kortteli_164_akm_ehdotus_2.9.2026.pdf"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await db
    .from("potential_projects")
    .select("id, title, municipality, metadata")
    .eq("id", ID)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    console.log("riviä ei löytynyt")
    return
  }

  const md = ((data as any).metadata ?? {}) as any
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`${data.title} (${data.municipality})`)
  console.log(`  kuvaus nyt: ${md.description ? `${String(md.description).length} merkkia` : "tyhjä"}`)
  console.log(`  -> ${KUVAUS}`)

  if (md.description) {
    console.log("\nKuvaus on jo olemassa — ei ylikirjoiteta.")
    return
  }
  if (!apply) {
    console.log("\nEi muutettu mitaan.")
    return
  }

  const { error: virhe } = await db
    .from("potential_projects")
    .update({
      metadata: {
        ...md,
        description: KUVAUS,
        tiedon_lahteet: {
          ...(md.tiedon_lahteet ?? {}),
          description: {
            tapa: "kuvakaappaus",
            asiakirja: SELOSTUS,
            luku: "1.3 Kaavan tarkoitus",
            syy: "PDF:n fonteissa ei ole merkkikarttaa; teksti ei ole koneellisesti luettavissa",
            paivays: "2026-10-11",
          },
        },
      },
    })
    .eq("id", ID)
  if (virhe) throw virhe
  console.log("\nTEHTY.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
