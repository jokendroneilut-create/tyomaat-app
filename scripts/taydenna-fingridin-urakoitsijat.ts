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
 * URAKOITSIJA FINGRIDIN HANKEKUVAUKSESTA KENTTAAN (D-328).
 *
 * Johannes 22.10.2026: *"lisää nämä hankkeeseen liittyviksi
 * yrityksiksi. katso myös muut (osa jo hyväksytty) fingridistä tulleet
 * hankkeet (myös jono) ja etsi onko muissa samaa löydettävissä."*
 *
 * Kartoitus (`mittaa-fingridin-urakoitsijat.ts`): 56 hyväksyttyä ja 56
 * jonorivia, urakoitsija löytyy tekstistä 5:ltä ja 6:lta, eikä
 * yhdelläkään ole sitä missään kentässä.
 *
 * KAKSI KENTTAA, KOSKA KAKSI ERI TILANNETTA:
 *
 *   - YKSI urakoitsija ("Urakoitsijana toimii Enersense PN Oy") menee
 *     `builder`-sarakkeeseen, rooli "Pääurakoitsija". Se on myös
 *     hankehaun kenttä (`lib/projects/hakukentat.ts`), joten yritys
 *     löytyy haulla.
 *   - MONTA osuuskohtaista urakoitsijaa menee
 *     `metadata.winners`-kenttään, rooli "Urakoitsija". Tämä on juuri
 *     se tilanne jota varten kenttä on: *"emme voi päätellä mikä
 *     osaurakoista on pääurakka"* (`projectCompanies.ts`). Niitä ei
 *     kirjoiteta `builder`-sarakkeeseen, koska yksikään kolmesta ei ole
 *     koko hankkeen pääurakoitsija.
 *
 * EI related_companies, vaikka pyyntö sanoi "liittyviksi yrityksiksi":
 * se kenttä antaa roolin "Liittyvä yritys", ja osapuoli kuuluu
 * roolikenttään (D-313). "Urakoitsija" kertoo enemmän.
 *
 * TYHJAAN VAIN. Jos kentässä on jo arvo, sitä ei ylikirjoiteta.
 *
 *   npx tsx scripts/taydenna-fingridin-urakoitsijat.ts
 *   npx tsx scripts/taydenna-fingridin-urakoitsijat.ts --apply
 */

import { poimiUrakoitsijat } from "../lib/agent/poimiUrakoitsija"

/* Vain Fingridin oma kerääjä, ei lähteen nimen perusteella arvattu. */
const LAHDE = "fingrid_hankkeet"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* ---------- HYVAKSYTYT HANKKEET ---------- */
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, phase, status, is_public, builder, developer, additional_info, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE projects: ${error.message}`)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const kohteet = hankkeet.filter(
    (p) => String(p.metadata?.source_name ?? "") === LAHDE && p.is_public && p.status === "active"
  )
  console.log(`\nFingrid-hankkeita: ${kohteet.length}\n`)

  let kirjBuilder = 0
  let kirjWinners = 0
  let ohi = 0

  for (const p of kohteet) {
    const nimet = poimiUrakoitsijat(p.additional_info)
    if (!nimet.length) continue

    const onBuilder = Boolean(String(p.builder ?? "").trim())
    const onWinners = Array.isArray(p.metadata?.winners) && p.metadata.winners.length > 0
    if (onBuilder || onWinners) {
      ohi += 1
      console.log(`   OHI  ${String(p.name).slice(0, 44).padEnd(46)} kentassa jo: ${p.builder ?? JSON.stringify(p.metadata?.winners)}`)
      continue
    }

    const yksi = nimet.length === 1
    console.log(
      `   ${yksi ? "builder" : "winners"} ${String(p.name).slice(0, 44).padEnd(46)} ${nimet.join(" // ")}`
    )

    if (!apply) continue

    const md: Record<string, any> = { ...(p.metadata ?? {}) }
    md.urakoitsija_lahde = {
      nimet,
      jasennin: "poimiUrakoitsijat",
      kentta: yksi ? "builder" : "metadata.winners",
      milloin: new Date().toISOString().slice(0, 10),
    }
    const paivitys: Record<string, any> = { metadata: md }
    if (yksi) paivitys.builder = nimet[0]
    else md.winners = nimet

    const { error } = await db.from("projects").update(paivitys).eq("id", p.id)
    if (error) {
      console.error(`      VIRHE: ${error.message}`)
      continue
    }
    if (yksi) kirjBuilder += 1
    else kirjWinners += 1
  }

  /* ---------- JONO ---------- */
  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE potential_projects: ${error.message}`)
      process.exit(1)
    }
    jono.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  /*
   * Vain avoimet jonorivit. `approved` on jo hanke (ja kasitelty yllä),
   * `ignored` on tietoinen poisto jota ei herateta ([[queue-removal-ignored]]).
   */
  const jonoKohteet = jono.filter(
    (p) => String(p.metadata?.source_name ?? "") === LAHDE && (p.status === "new" || p.status === "reviewing")
  )
  console.log(`\nAvoimia Fingrid-jonorivejä: ${jonoKohteet.length}\n`)

  let kirjJono = 0
  for (const p of jonoKohteet) {
    const nimet = poimiUrakoitsijat(p.metadata?.description)
    if (!nimet.length) continue

    const onJo =
      Boolean(String(p.metadata?.builder ?? "").trim()) ||
      (Array.isArray(p.metadata?.winners) && p.metadata.winners.length > 0)
    if (onJo) {
      console.log(`   OHI  ${String(p.title).slice(0, 44).padEnd(46)} kentassa jo arvo`)
      continue
    }

    console.log(`   winners ${String(p.title).slice(0, 44).padEnd(46)} ${nimet.join(" // ")}`)

    if (!apply) continue

    const md: Record<string, any> = { ...(p.metadata ?? {}) }
    md.winners = nimet
    md.urakoitsija_lahde = {
      nimet,
      jasennin: "poimiUrakoitsijat",
      kentta: "metadata.winners",
      milloin: new Date().toISOString().slice(0, 10),
    }
    const { error } = await db.from("potential_projects").update({ metadata: md }).eq("id", p.id)
    if (error) {
      console.error(`      VIRHE: ${error.message}`)
      continue
    }
    kirjJono += 1
  }

  if (apply)
    console.log(
      `\nKirjoitettu: builder ${kirjBuilder}, winners ${kirjWinners}, jonoon ${kirjJono}. Ohitettu ${ohi}.`
    )
  else console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
