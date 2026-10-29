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
 * OYS C-RAKENNUKSEN KUVAUS AJAN TASALLE (D-361).
 *
 * Kentassa oli jo NCC:n hankesivun aikataulu (syksy 2030), mutta kuvaus
 * oli yha Pohteen sopimusuutisesta (Q4/2025) ja sanoi *"vuosille
 * 2025-2029 ... elokuun 2029 loppuun mennessa"*. Asiakas luki siis
 * kuvauksesta eri vuoden kuin kentasta
 * ([[newer-source-is-not-current-state]]: paivita molemmat).
 *
 * Kuvaus kirjoitetaan uusiksi tiivistaen, ei liittamalla kahta tekstia
 * perakkain ([[condense-dont-recreate]]). Vanha versio talteen
 * metadataan, koska se on ainoa jalki siita mita sopimushetkella
 * sanottiin.
 *
 *   npx tsx scripts/paivita-oys-c-kuvaus.ts
 *   npx tsx scripts/paivita-oys-c-kuvaus.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const C_RAKENNUS = "a495c984-54d3-494c-a232-9b32f56d10a0"

/*
 * Luvut ja sisalto NCC:n hankesivulta 30.10.2026, hankkeen arvo
 * Pohteen sopimusuutisesta. Molemmat ovat hankkeen omia osapuolia.
 */
const KUVAUS = [
  "Oulun yliopistollisen sairaalan uusi C-rakennus nousee OYSin vanhan K-rakennusosan",
  "paikalle osoitteeseen Kajaanintie 50. Laajuus on 35 538 brm².",
  "Rakennus kokoaa yhteen erikoissairaanhoidon avohoitoa ja opetusta: sinne sijoittuvat",
  "muun muassa erikoissairaanhoidon poliklinikat ja päiväsairaalatoiminta, patologian",
  "laboratoriot, opetus- ja koulutustiloja sekä opetuspainotteinen sosiaali- ja",
  "terveyskeskus.",
  "C-rakennus toteutetaan allianssiurakkana NCC:n ja Pohjois-Pohjanmaan hyvinvointialue",
  "Pohteen yhteisessä organisaatiossa. Hankkeen arvo NCC:lle on noin 158 miljoonaa euroa.",
  "Rakennustyöt ajoittuvat vuosille 2025–2030, ja kohde luovutetaan tilaajalle syksyllä 2030.",
  "Arkkitehtisuunnittelu Lukkaroinen Oy, Tähti-Set Oy ja Uki Arkkitehdit Oy,",
  "rakennesuunnittelu A-insinöörit Suunnittelu Oy ja TATE-suunnittelu Ramboll Finland Oy.",
  "NCC:n työnumero on 13819.",
].join(" ")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data, error } = await db.from("projects").select("*").eq("id", C_RAKENNUS).single()
  if (error) throw error
  const c: any = data
  const vanha = String(c.additional_info ?? "")

  const md = { ...(c.metadata ?? {}) }
  md.kuvaus_ennen_2026_10_30 = {
    teksti: vanha,
    lahde: md.source_url ?? null,
    syy: "aikataulu 2025–2029 / 8/2029 oli vanhentunut; NCC:n hankesivu sanoo 2025–2030 ja syksy 2030",
  }
  md.description = KUVAUS
  md.field_sources = {
    ...(md.field_sources ?? {}),
    description: "NCC:n hankesivu 30.10.2026 + hankkeen arvo Pohteen sopimusuutisesta",
    estimated_completion: "NCC:n hankesivu 30.10.2026 (syksy 2030)",
  }

  console.log(`ENNEN (${vanha.length} merkkia):`)
  console.log(vanha.replace(/\s+/g, " "))
  console.log(`\nJALKEEN (${KUVAUS.length} merkkia):`)
  console.log(KUVAUS)

  const vanhentuneet = [/2025\s*[–-]\s*2029/, /elokuun\s+2029/i]
  console.log(`\nVanhentuneet maininnat uudessa tekstissa: ${vanhentuneet.filter((r) => r.test(KUVAUS)).length}`)
  console.log(`Kentan valmistuminen: ${c.estimated_completion} (kuvaus sanoo syksy 2030)`)

  if (!APPLY) {
    console.log("\nKuivaharjoitus, ei kirjoitettu.")
    return
  }
  const r = await db.from("projects").update({ additional_info: KUVAUS, metadata: md }).eq("id", C_RAKENNUS)
  if (r.error) throw r.error
  console.log("\n=== AJETTU ===")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
