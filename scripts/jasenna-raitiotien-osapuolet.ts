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
 * TURUN RAITIOTIEN OSAPUOLET LAUSEESTA RAKENTEISIKSI (D-288).
 *
 * Asiakas katsoi hanketta 15.10.2026 eikä löytänyt NRC:tä kunnolla.
 * Syy ei ollut puuttuva tieto vaan sen muoto: rakentaja-kentässä luki
 * kokonainen lause, jolloin yrityksen mukaan hakeminen löytää sen vain
 * vapaalla tekstillä eikä rakenteisesti.
 *
 *   rakentaja:   "Rakentajina allianssissa ovat GRK ja NRC Group"
 *   suunnittelu: "Ramboll ja Sweco"
 *
 * Konventio muualla kannassa on pilkku: "Invera Oy (2668672-5),
 * SRH Rakennus Oy (2519255-5)". Nimet otetaan täsmälleen siinä
 * muodossa kuin lähde (GRK:n oma hankesivu) ne kirjoittaa — oikeaa
 * yhtiömuotoa tai y-tunnusta ei keksitä.
 *
 * Alkuperäinen lause säilyy metadatassa: tieto ei katoa, vaikka kentän
 * muoto muuttuu. Kuvaus (2 334 merkkiä) kertoo allianssista muutenkin.
 *
 *   npx tsx scripts/jasenna-raitiotien-osapuolet.ts
 *   npx tsx scripts/jasenna-raitiotien-osapuolet.ts --apply
 */

const HANKE = "85a116f7-2e91-4d1a-b2b7-cfb6794c3ff5"

const ODOTETTU_RAKENTAJA = "Rakentajina allianssissa ovat GRK ja NRC Group"
const UUSI_RAKENTAJA = "GRK, NRC Group"
const ODOTETTU_SUUNNITTELU = "Ramboll ja Sweco"
const UUSI_SUUNNITTELU = "Ramboll, Sweco"
const YRITYKSET = ["GRK", "NRC Group"]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: hanke, error } = await db
    .from("projects")
    .select("id, name, builder, structural_design, metadata")
    .eq("id", HANKE)
    .maybeSingle()

  if (error) throw error
  if (!hanke) {
    console.log("hanketta ei löytynyt")
    return
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`hanke: ${hanke.name}\n`)

  /*
   * Kentän on oltava se jonka luimme. Jos joku on muuttanut sitä
   * välissä, skripti ei kirjoita päälle.
   */
  if (hanke.builder !== ODOTETTU_RAKENTAJA) {
    console.log(`OHITETTU: rakentaja-kentässä lukee nyt "${hanke.builder}"`)
    console.log(`          odotettiin "${ODOTETTU_RAKENTAJA}"`)
    return
  }

  console.log(`rakentaja:   "${hanke.builder}"`)
  console.log(`          -> "${UUSI_RAKENTAJA}"`)
  console.log(`suunnittelu: "${hanke.structural_design}"`)
  console.log(
    `          -> "${hanke.structural_design === ODOTETTU_SUUNNITTELU ? UUSI_SUUNNITTELU : hanke.structural_design} (ennallaan jos ei täsmää)"`
  )
  console.log(`related_companies -> ${JSON.stringify(YRITYKSET)}`)
  console.log(`metadata.builder_alkuperainen -> "${ODOTETTU_RAKENTAJA}"`)

  if (!apply) {
    console.log("\nEi muutettu mitään. Aja --apply kun rivit on luettu.")
    return
  }

  const metadata = {
    ...((hanke.metadata as any) ?? {}),
    related_companies: YRITYKSET,
    /* Alkuperäinen muotoilu talteen: kentän muoto muuttuu, tieto ei katoa. */
    builder_alkuperainen: ODOTETTU_RAKENTAJA,
    osapuolet_jasennetty: new Date().toISOString(),
  }

  const { error: virhe } = await db
    .from("projects")
    .update({
      builder: UUSI_RAKENTAJA,
      ...(hanke.structural_design === ODOTETTU_SUUNNITTELU
        ? { structural_design: UUSI_SUUNNITTELU }
        : {}),
      metadata,
    })
    .eq("id", HANKE)

  console.log(virhe ? `\nVIRHE: ${virhe.message}` : "\nTEHTY")
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
