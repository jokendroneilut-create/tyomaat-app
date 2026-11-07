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
 * /tic-SIVUN LATAUKSEN KESTO, PALVELINPUOLI (D-387).
 *
 * Johannes 8.11.2026: *"tämä hyväksyminen hidastuu paljon kun sivun
 * lataus kestää niin kauan. mittaa sivun latauksen kesto ensin jotta
 * nähdään paljonko saatiin sitä nopeutettua."*
 *
 * Sivu on `force-dynamic` ja ajaa neljä palvelua rinnakkain, joten
 * latauksen kesto on hitaimman palvelun kesto. Erittely kertoo mitä
 * kannattaa korjata; summa kertoo mitä käyttäjä odottaa.
 *
 * MITTARI EI SAA MITATA OMAA VALIMUISTIAAN. `getYhteystietoMittarit`
 * pitaa prosessin muistissa kahden tunnin valimuistia, joten TOINEN
 * kutsu samassa prosessissa palauttaa nollan — ja jos skripti laskisi
 * sen keskiarvoon, se nayttaisi korjauksen paremmaksi kuin se on.
 * Siksi kylma ja lammin kutsu raportoidaan erikseen, ja kylma mitataan
 * vain kerran prosessia kohden.
 *
 * MITATTU 8.11.2026 (3 kierrosta, tuotantokanta):
 *
 *   ennen kenttarajausta   sivun data 26 802 ms  (15 436–48 855)
 *   kenttarajauksen jalkeen            2 700 ms  (2 452–2 857)
 *   valimuistista                       ~0 ms
 *
 *   npx tsx scripts/mittaa-tic-lataus.ts
 *   npx tsx scripts/mittaa-tic-lataus.ts --kierroksia 5
 */
const argKierrokset = process.argv.indexOf("--kierroksia")
const KIERROKSIA = argKierrokset > 0 ? Number(process.argv[argKierrokset + 1]) : 3

async function kesto<T>(nimi: string, f: () => Promise<T>): Promise<[number, T]> {
  const alku = performance.now()
  const tulos = await f()
  const kulunut = performance.now() - alku
  console.log(`  ${nimi.padEnd(36)} ${kulunut.toFixed(0).padStart(6)} ms`)
  return [kulunut, tulos]
}

async function main() {
  const { getPotentialProjectsForReview } = await import(
    "../app/tic/services/getPotentialProjectsForReview"
  )
  const { getPendingReviewCount } = await import("../app/tic/services/getPendingReviewCount")
  const { getTicDailySummary } = await import("../app/tic/services/getTicDailySummary")
  const { getYhteystietoMittarit } = await import("../app/tic/services/getYhteystietoMittarit")
  const { getPendingDuplicateCount } = await import("../app/tic/services/getDuplicateCandidates")
  const { getHealthAlertCount } = await import("../app/tic/services/getHealthAlertCount")
  const { getIncompleteProjectCount } = await import(
    "../app/tic/services/getIncompleteProjectCount"
  )
  const { createClient } = await import("@supabase/supabase-js")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const yhteensa: Record<string, number[]> = {}
  const kirjaa = (nimi: string, kulunut: number) => {
    yhteensa[nimi] = [...(yhteensa[nimi] ?? []), kulunut]
  }

  /* Kylma mittari ensin, kerran: taman jalkeen se tulee valimuistista. */
  console.log("=== MITTARI KYLMANA (kerran prosessia kohden) ===")
  const [kylma] = await kesto("getYhteystietoMittarit (kylma)", () =>
    getYhteystietoMittarit()
  )
  kirjaa("mittarit KYLMANA", kylma)

  for (let kierros = 1; kierros <= KIERROKSIA; kierros++) {
    console.log(`\n=== KIERROS ${kierros}/${KIERROKSIA} ===`)

    console.log("\nPalvelut erikseen:")
    for (const [nimi, f] of [
      ["getPotentialProjectsForReview(1)", () => getPotentialProjectsForReview(1)],
      ["getPendingReviewCount", () => getPendingReviewCount()],
      ["getTicDailySummary", () => getTicDailySummary()],
      ["getYhteystietoMittarit (lammin)", () => getYhteystietoMittarit()],
    ] as [string, () => Promise<unknown>][]) {
      const [kulunut] = await kesto(nimi, f)
      kirjaa(nimi, kulunut)
    }

    console.log("\nMittarin kysely erikseen (ohi valimuistin):")
    const [raskas, raskaatRivit] = await kesto("koko metadata (vanha tapa)", async () => {
      const rivit: any[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from("projects")
          .select("phase, status, is_public, metadata, developer, builder")
          .range(from, from + 999)
        if (error) {
          console.log(`     (kysely kaatui: ${error.message})`)
          return rivit
        }
        rivit.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      return rivit
    })
    kirjaa("koko metadata (vanha tapa)", raskas)
    console.log(
      `     (${(raskaatRivit as any[]).length} riviä, ${(JSON.stringify(raskaatRivit).length / 1e6).toFixed(1)} Mt)`
    )

    const [kevyt, kevyetRivit] = await kesto("vain contact_persons (uusi)", async () => {
      const rivit: any[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from("projects")
          .select(
            "phase, status, is_public, developer, builder, yhteyshenkilot:metadata->contact_persons"
          )
          .eq("status", "active")
          .eq("is_public", true)
          .range(from, from + 999)
        if (error) throw error
        rivit.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      return rivit
    })
    kirjaa("vain contact_persons (uusi)", kevyt)
    console.log(
      `     (${(kevyetRivit as any[]).length} riviä, ${(JSON.stringify(kevyetRivit).length / 1e6).toFixed(2)} Mt)`
    )

    /*
     * ULOASU AJAA OMAT NELJA KYSELYAAN JOKA LATAUKSELLA. Kayttaja odottaa
     * layoutin JA sivun, joten mittaus ilman layoutia on liian hyva.
     */
    console.log("\nLayout (navigaation luvut, ajetaan joka latauksella):")
    const alkuL = performance.now()
    await Promise.all([
      getPendingReviewCount(),
      getPendingDuplicateCount(),
      getHealthAlertCount(),
      getIncompleteProjectCount(),
    ])
    const layout = performance.now() - alkuL
    console.log(`  layoutin data yhteensa               ${layout.toFixed(0).padStart(6)} ms`)
    kirjaa("LAYOUT", layout)

    console.log("\nKoko sivu (neljä palvelua rinnakkain, kuten page.tsx):")
    const alku = performance.now()
    await Promise.all([
      getPotentialProjectsForReview(1),
      getPendingReviewCount(),
      getTicDailySummary(),
      getYhteystietoMittarit(),
    ])
    const sivu = performance.now() - alku
    console.log(`  sivun data yhteensa                  ${sivu.toFixed(0).padStart(6)} ms`)
    kirjaa("SIVU (mittari valimuistista)", sivu)
  }

  console.log(`\n\n=== KESKIARVOT (${KIERROKSIA} kierrosta) ===`)
  for (const [nimi, luvut] of Object.entries(yhteensa)) {
    const ka = luvut.reduce((a, b) => a + b, 0) / luvut.length
    console.log(
      `  ${nimi.padEnd(36)} ka ${ka.toFixed(0).padStart(6)} ms   (${Math.min(...luvut).toFixed(0)}–${Math.max(...luvut).toFixed(0)}, n=${luvut.length})`
    )
  }

  console.log(
    "\nHUOM: sivun luku on mittarin valimuistin kanssa. Kylma lataus on\n" +
      "      'mittarit KYLMANA' + muiden palveluiden hitain, eli se mita\n" +
      "      kayttaja odottaa kerran kahdessa tunnissa."
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
