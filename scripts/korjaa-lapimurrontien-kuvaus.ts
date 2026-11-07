import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LAPIMURRONTIEN KUVAUS KUVAKAAPPAUKSESTA (D-392).
 *
 * Johannes 8.11.2026: *"ei ole poimittu olennaisinta lahteesta"* ja
 * kuvakaappaus luvusta "Hankkeen kuvaus ja tavoitteet".
 *
 * JASENNIN EI OLLUT RIKKI. Pornaisten kaavasivulla tallä kaavalla on
 * tasan yksi liite, `Kuulutus-taululle.pdf`, ja se on **kuvatiedosto**:
 * PDF:ssa on 10 kuvaobjektia ja NOLLA fonttia, eli tekstikerrosta ei
 * ole lainkaan. `pdf-parse` palauttaa siita kaksi merkkia. Mitaan ei
 * siis ollut poimittavissa koneellisesti
 * (vrt. [[unreadable-pdf-fonts]], jossa fontit olivat olemassa mutta
 * ilman merkkikarttaa — tassa fontteja ei ole).
 *
 * Teksti kirjataan siksi kuvakaappauksesta, kuten D-268:ssa Euran
 * korttelin 164 kanssa, ja alkupera merkitaan `field_sources`iin
 * ([[screenshot-intake]]).
 *
 * MENETTELYTEKSTI JAA VIIMEISEKSI. Nahtavillaoloaika on totta ja
 * hyodyllinen, mutta se ei kerro mita alueelle tulee — joten sisalto
 * tulee ensin ja aika perään.
 *
 *   npx tsx scripts/korjaa-lapimurrontien-kuvaus.ts
 *   npx tsx scripts/korjaa-lapimurrontien-kuvaus.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const EHDOKAS = "e8fc52d2-3898-46db-8c9f-98c594241810"
const DOKUMENTTI = "63b79a7b-0dde-4d9e-b6bd-eb7cb7271241"
const KUULUTUS = "https://pornainen.fi/wp-content/uploads/2026/11/Kuulutus-taululle.pdf"

/* Sanatarkasti kuulutuksen luvusta "Hankkeen kuvaus ja tavoitteet". */
const KUVAUS = [
  "Suunnittelualue sijaitsee Pornaisten Portin yritystoiminnan alueella Läpimurrontien varressa sekä Ahertajanpolun kohdalla. Kaavamuutosalueen pinta-ala on noin 2,7 hehtaaria.",
  "Asemakaavamuutoksella on tarkoitus muuttaa pääosa voimassa olevan asemakaavan teollisuus- ja varastorakennusten korttelialueesta (T) teollisuus- ja varastorakennusten korttelialueeksi, jolle saa sijoittaa merkittävän, vaarallisia kemikaaleja valmistavan tai varastoivan laitoksen (T/kem).",
  "Osa nykyisestä T-alueesta on tarkoitus muuttaa yleiskaavan mukaisesta maa- ja metsätalousvaltaiseksi alueeksi, jolla on erityisiä ympäristöarvoja (MY).",
  "Lisäksi tavoitteena on osoittaa alueelta uusi katuyhteys Järvenpääntielle sekä turvata yleiskaavan mukainen katuyhteys pohjoiseen uudelle teollisuus- ja varastoalueelle.",
  "Osallistumis- ja arviointisuunnitelma on nähtävillä 11.11.–11.12.2026; mielipiteet tulee toimittaa viimeistään 11.12.2026.",
].join(" ")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data } = await db
    .from("potential_projects")
    .select("id,title,status,metadata")
    .eq("id", EHDOKAS)
    .maybeSingle()
  const r: any = data
  if (!r) { console.log("jonoriviä ei loydy"); return }
  const md = r.metadata ?? {}

  console.log(`RIVI  ${r.title} (${r.status})`)
  console.log(`  nykyinen kuvaus (${String(md.description ?? "").length} mrk): ${String(md.description ?? "-")}`)
  console.log(`\n  UUSI kuvaus (${KUVAUS.length} mrk):\n${KUVAUS}`)

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const { error } = await db
    .from("potential_projects")
    .update({
      metadata: {
        ...md,
        description: KUVAUS,
        field_sources: {
          ...(md.field_sources ?? {}),
          description: `kuulutus (kuvatiedosto, ei tekstikerrosta), luettu kuvakaappauksesta: ${KUULUTUS}`,
        },
      },
    })
    .eq("id", EHDOKAS)
  if (error) throw error

  /*
   * Dokumenttiin sama, jottei kerain kirjoita menettelytekstia takaisin
   * seuraavalla ajolla.
   */
  const { data: dok } = await db
    .from("source_documents")
    .select("raw_payload")
    .eq("id", DOKUMENTTI)
    .maybeSingle()
  const hy: any = (dok as any)?.raw_payload ?? {}
  const { error: e2 } = await db
    .from("source_documents")
    .update({ raw_payload: { ...hy, description: KUVAUS }, updated_at: new Date().toISOString() })
    .eq("id", DOKUMENTTI)
  if (e2) throw e2

  console.log("\n=== KIRJOITETTU === jonorivi ja dokumentti")
}
main().catch((e) => { console.error(e); process.exit(1) })
