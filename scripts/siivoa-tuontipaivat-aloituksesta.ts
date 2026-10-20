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
 * HELMIKUUN TUONTIPAIVAT POIS ALOITUSKENTASTA (D-324).
 *
 * Johannes 21.10.2026: *"siivoa helmikuun tuontipaivat."*
 *
 * `construction_start` oli taytetty 457 julkisella hankkeella, mutta
 * 234:lla arvo on sama kuin rivin LUONTIPAIVA. Helmikuussa 2026 ne
 * kasautuvat muutamaan keruupaivaan: 21.2. seitsemallakymmenella-
 * seitsemalla hankkeella, 20.2. ja 22.2. neljallakymmenellayhdella.
 * Seitseman kymmenta hanketta ei ala samana paivana, ja teksti kiistaa
 * ne suoraan: "Kerrotalo Murkionkatu" -- kannassa 22.2.2026, kuvaus
 * "rakentaminen on aloitettu syyskuussa 2025".
 *
 * RAJAUS ON TARKKA. Siivotaan vain rivit joilla
 *   construction_start == created_at  JA  paiva on helmikuussa 2026.
 * Muut 64 tuontipaivaepailya jaavat koskematta: ne ovat hajallaan eri
 * paivissa, ja hanke VOI alkaa sina paivana kun se loydetaan.
 *
 * TEKSTI VOITTAA TYHJAN. Jos kuvauksesta loytyy aloituskuukausi, se
 * kirjoitetaan tilalle; muuten kentta tyhjennetaan. Vaara paiva on
 * asiakkaalle pahempi kuin tyhja, mutta oikea paiva on paras.
 *
 * Poistettu arvo jaa metadataan (`construction_start_poistettu`), jotta
 * siivous on jaljitettavissa eika tieto katoa kokonaan.
 *
 *   npx tsx scripts/siivoa-tuontipaivat-aloituksesta.ts
 *   npx tsx scripts/siivoa-tuontipaivat-aloituksesta.ts --apply
 */

import { parseFinnishStartDate } from "../lib/agent/parseFinnishStartDate"

const ALKU = "2026-02-01"
const LOPPU = "2026-02-28"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, phase, created_at, construction_start, is_public, status, additional_info, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  /*
   * YHDEN PAIVAN HEITTO KUULUU SAMAAN ERAAN. Ensimmainen ajo siivosi
   * rivit joilla aloitus == luontipaiva, mutta helmikuuhun jai 27
   * rivia joilla aloitus on luontipaivaa SEURAAVA paiva -- sama
   * tuontiera aikavyohykkeen verran sivussa ("Datakeskus Espoon
   * Hepokorpi": luotu 21.2., aloitus 22.2.). Siksi ero 0 tai 1 vrk.
   */
  const eroVuorokausina = (p: any) => {
    const alku = new Date(`${String(p.construction_start).slice(0, 10)}T00:00:00Z`).getTime()
    const luotu = new Date(`${String(p.created_at ?? "").slice(0, 10)}T00:00:00Z`).getTime()
    if (!Number.isFinite(alku) || !Number.isFinite(luotu)) return null
    return Math.round((alku - luotu) / 86400000)
  }

  const kohteet = rivit.filter((p) => {
    if (!p.construction_start) return false
    const alku = String(p.construction_start).slice(0, 10)
    if (alku < ALKU || alku > LOPPU) return false
    const ero = eroVuorokausina(p)
    return ero === 0 || ero === 1
  })

  const kaikkiHelmikuussa = rivit.filter(
    (p) =>
      p.construction_start &&
      String(p.construction_start).slice(0, 10) >= ALKU &&
      String(p.construction_start).slice(0, 10) <= LOPPU
  )
  console.log(
    `\nHelmikuun 2026 aloituspäiviä ${kaikkiHelmikuussa.length}, niistä luontipäivä tai sitä seuraava ${kohteet.length}`
  )
  console.log(`Koskematta jäävät ${kaikkiHelmikuussa.length - kohteet.length} (aloitus ei osu luontipäivään)\n`)

  let tekstista = 0
  let vahvistettu = 0
  let tyhjennetaan = 0

  for (const p of kohteet) {
    const teksti = `${p.additional_info ?? ""} ${p.metadata?.description ?? ""}`.trim()
    const tulos = parseFinnishStartDate(teksti)
    const samaKuukausi = tulos ? tulos.paiva.slice(0, 7) === String(p.construction_start).slice(0, 7) : false

    /*
     * TEKSTI VOI MYOS VAHVISTAA PAIVAN. Jos kuvaus kertoo saman
     * kuukauden, arvo ei ole tuontipaiva vaan oikea -- silloin sita ei
     * saa tyhjentaa, vaikka se sattuu osumaan luontipaivaan.
     */
    if (samaKuukausi) {
      vahvistettu += 1
      console.log(
        `   ${String(p.construction_start).slice(0, 10)} ${String(p.name).slice(0, 44).padEnd(46)} ${String(p.phase ?? "-").slice(0, 20).padEnd(22)} -> SAILYY (teksti vahvistaa)`
      )
      console.log(`      lähde: "${tulos!.osuma}"`)
      continue
    }

    const uusi = tulos && !samaKuukausi ? tulos : null
    if (uusi) tekstista += 1
    else tyhjennetaan += 1

    console.log(
      `   ${String(p.construction_start).slice(0, 10)} ${String(p.name).slice(0, 44).padEnd(46)} ${String(p.phase ?? "-").slice(0, 20).padEnd(22)} ${uusi ? `-> ${uusi.paiva}` : "-> tyhjä"}`
    )
    if (uusi) console.log(`      lähde: "${uusi.osuma}"`)

    if (!apply) continue

    const md: Record<string, any> = { ...(p.metadata ?? {}) }
    md.construction_start_poistettu = {
      arvo: String(p.construction_start).slice(0, 10),
      syy: "sama kuin rivin luontipäivä (helmikuun 2026 tuontierä)",
      milloin: new Date().toISOString().slice(0, 10),
    }
    const { error } = await db
      .from("projects")
      .update({ construction_start: uusi ? uusi.paiva : null, metadata: md })
      .eq("id", p.id)
    if (error) console.error(`      VIRHE: ${error.message}`)
  }

  console.log(
    `\nYhteensä ${kohteet.length}: tekstistä korvataan ${tekstista}, säilyy vahvistettuna ${vahvistettu}, tyhjennetään ${tyhjennetaan}`
  )
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
