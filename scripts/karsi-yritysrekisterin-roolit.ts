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
 * YRITYSREKISTERIN ROOLIKARSINTA (D-381).
 *
 * Johannes kavi varareitin yrityskohtaisesti lapi 7.11.2026 ja poimi
 * nelja tapausta: Pohjola Rakennuksen myyntivaki, SRV:n viestinnan
 * asiantuntijat, Laptin myyntipaallikko ja Espoon Asuntojen karjessa
 * ollut SRV:n johtaja.
 *
 * KAKSI ERI VIKAA, KAKSI ERI KORJAUSTA.
 *
 * 1. VAARA ROOLI. Nimike kertoo etta ihminen ei vastaa tyomaasta.
 *    Saanto on nyt `lib/projects/tyomaayhteys.ts` ja se on kytketty
 *    SEKA generaattoriin etta julkaisuskriptiin, joten rivit eivat
 *    palaa seuraavalla ajolla.
 *
 *    Generaattorin vanha kuvio oli `/viestint|tiedott|media|markkinoin/i`
 *    eika se osunut sanaan **"viestinnan"** -- `viestint` vaatii
 *    kirjaimet `t`,`i`,`n`,`t` perakkain. Siksi SRV:n kaksi viestinnan
 *    asiantuntijaa nakyivat asiakkaalle kolmella hankkeella.
 *
 * 2. VAARA AVAIN. Jorma Seppa on SRV:n ihminen (`jorma.seppa@srv.fi`)
 *    mutta rekisterissa myos avaimella `espoonasunnot`, koska SRV
 *    rakentaa Espoon Asunnoille ja johdos liitti yhteyshenkilon
 *    hankkeen MOLEMPIIN osapuoliin. Han on jo oikealla avaimella `srv`,
 *    joten vaara rivi poistetaan -- ihminen ei katoa.
 *
 *    Itse johdosvika jaa tyojonoon: sama tapahtuu muillekin kun
 *    urakoitsijan ihminen paatyy rakennuttajan avaimen alle.
 *
 * POISTO ON DELETE, poikkeuksellisesti. `yritys_yhteyshenkilot`issa ei
 * ole piilotuskenttaa, ja generaattori poistaa johdetut rivit joka
 * ajolla itsekin -- kasin lisatyt (`lahde` alkaa "kasin") se jattaa
 * rauhaan, eika tama ajo koske niihin.
 *
 *   npx tsx scripts/karsi-yritysrekisterin-roolit.ts
 *   npx tsx scripts/karsi-yritysrekisterin-roolit.ts --apply
 */
import { eiTyomaaRooli } from "../lib/projects/tyomaayhteys"

const APPLY = process.argv.includes("--apply")

/* Vaara avain: SRV:n ihminen Espoon Asuntojen alla. */
const VAARA_AVAIN = [{ avain: "espoonasunnot", nimi: "Jorma Seppa" }]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: rek, error } = await db
    .from("yritys_yhteyshenkilot")
    .select("id,avain,yritys,nimi,nimike,email,lahde")
  if (error) throw error

  const rooli = (rek ?? []).filter((r) => eiTyomaaRooli(r.nimike))
  const avain = (rek ?? []).filter((r) =>
    VAARA_AVAIN.some((v) => v.avain === r.avain && String(r.nimi).trim() === v.nimi)
  )

  console.log(`rekisterissa ${rek?.length ?? 0} rivia\n`)
  console.log(`VAARA ROOLI (${rooli.length}):`)
  for (const r of rooli) {
    console.log(`  ${String(r.avain).padEnd(18)} ${String(r.nimi).padEnd(22)} ${String(r.nimike).slice(0, 48)}`)
  }

  console.log(`\nVAARA AVAIN (${avain.length}):`)
  for (const r of avain) {
    const muualla = (rek ?? []).filter(
      (x) => String(x.email ?? "").toLowerCase() === String(r.email ?? "").toLowerCase() && x.avain !== r.avain
    )
    console.log(
      `  ${String(r.avain).padEnd(18)} ${String(r.nimi).padEnd(22)} ${r.email}` +
        `  -> loytyy myos avaimilta: ${muualla.map((x) => x.avain).join(", ") || "EI MISSAAN"}`
    )
    /* Jos hanta ei ole muualla, poisto hukkaisi ihmisen. */
    if (!muualla.length) console.log(`     EI POISTETA: ei ole missaan muualla`)
  }

  const poistettavat = [
    ...rooli,
    ...avain.filter((r) =>
      (rek ?? []).some(
        (x) => String(x.email ?? "").toLowerCase() === String(r.email ?? "").toLowerCase() && x.avain !== r.avain
      )
    ),
  ]

  const kasin = poistettavat.filter((r) => /^kasin/i.test(String(r.lahde ?? "")))
  if (kasin.length) {
    console.log(`\nVAROITUS: ${kasin.length} poistettavaa on kasin lisattyja, ne jatetaan rauhaan`)
  }
  const lopulliset = poistettavat.filter((r) => !/^kasin/i.test(String(r.lahde ?? "")))

  console.log(`\n=== ${APPLY ? "POISTETAAN" : "KUIVAHARJOITUS"} ${lopulliset.length} rivia ===`)
  if (!APPLY) return

  for (const r of lopulliset) {
    const { error: e } = await db.from("yritys_yhteyshenkilot").delete().eq("id", r.id)
    if (e) console.log(`  VIRHE ${r.nimi}: ${e.message}`)
  }

  const { data: jalkeen } = await db.from("yritys_yhteyshenkilot").select("id")
  console.log(`rekisterissa nyt ${jalkeen?.length ?? 0} rivia`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
