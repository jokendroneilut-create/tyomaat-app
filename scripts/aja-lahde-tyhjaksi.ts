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
 * AJA LAHDE TYHJAKSI (D-365).
 *
 * Uuden lahteen ensimmainen era ei mahdu yhteen ajoon: `IMPORT_BUDGET_MS`
 * on 60 s ja loput kirjataan siirtyneiksi. Cron antaa lahteelle vuoron
 * vasta kierroksen paasta, ja kierros on mitattuna 4,7 vrk (342 lahdetta,
 * 18 perustason paikkaa per ajo, 4 ajoa vuorokaudessa). Datakeskusrekisterin
 * 124 jaljella ollutta ehdokasta olisivat siis valuneet sisaan
 * ~75 vuorokautta.
 *
 * Tama ajaa samaa polkua kuin cron (`runSourceWorker`) peratysten, kunnes
 * lahde ei enaa tuota uutta. Ei siis ohita mitaan tarkistusta -- vain
 * poistaa odotuksen.
 *
 * LOPETUSEHTO ON MITATTU, EI ARVATTU: silmukka katsoo montako riviä
 * lahteella on jonossa ennen ja jalkeen. Kaksi perakkaista ajoa ilman
 * uutta riviä lopettaa. Pelkka yksi tyhja ajo ei riita, koska aikabudjetti
 * voi tayttya myos jo nahtyjen uudelleenkasittelyyn.
 *
 *   npx tsx scripts/aja-lahde-tyhjaksi.ts legacy-datakeskusrekisteri datakeskusrekisteri
 *   npx tsx scripts/aja-lahde-tyhjaksi.ts <lahteen-id> <source_name> [--max=25]
 */
const LAHDE_ID = process.argv[2]
const SOURCE_NAME = process.argv[3]
const maxArg = process.argv.find((a) => a.startsWith("--max="))
const MAX_AJOJA = maxArg ? Number(maxArg.slice("--max=".length)) : 25

/* Kaksi perakkaista tuloksetonta ajoa riittaa todisteeksi. */
const TYHJIA_PERAKKAIN = 2

async function main() {
  if (!LAHDE_ID || !SOURCE_NAME) {
    throw new Error(
      "kaytto: npx tsx scripts/aja-lahde-tyhjaksi.ts <lahteen-id> <source_name> [--max=25]"
    )
  }

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { runSourceWorker } = await import("../lib/agent/workers/sourceWorker")

  async function riveja(): Promise<number> {
    const { count, error } = await db
      .from("potential_projects")
      /* `head: true` kaatuu tyhjaan virheeseen nimetylla sarakkeella. */
      .select("*", { count: "exact", head: true })
      .eq("metadata->>source_name", SOURCE_NAME)
    if (error) throw error
    return count ?? 0
  }

  async function tapahtumia(): Promise<number> {
    const { count, error } = await db
      .from("project_import_events")
      .select("*", { count: "exact", head: true })
      .eq("source_name", SOURCE_NAME)
    if (error) throw error
    return count ?? 0
  }

  let edellinenRivit = await riveja()
  let edellinenTapahtumat = await tapahtumia()
  console.log(`Alussa: ${edellinenRivit} jonoriviä, ${edellinenTapahtumat} tuontitapahtumaa\n`)

  let tyhjia = 0
  let ajoja = 0

  for (let i = 1; i <= MAX_AJOJA; i++) {
    const alkoi = Date.now()
    let virhe: string | null = null
    try {
      const tulos: any = await runSourceWorker(LAHDE_ID)
      if (!tulos?.ok) virhe = JSON.stringify(tulos?.error ?? tulos)
    } catch (e: any) {
      virhe = e?.message ?? String(e)
    }
    ajoja++

    const rivit = await riveja()
    const tapahtumat = await tapahtumia()
    const uusiaRiveja = rivit - edellinenRivit
    const uusiaTapahtumia = tapahtumat - edellinenTapahtumat
    const kesto = ((Date.now() - alkoi) / 1000).toFixed(0)

    console.log(
      `ajo ${String(i).padStart(2)}: ${kesto.padStart(3)} s  ` +
        `+${String(uusiaRiveja).padStart(3)} riviä  ` +
        `+${String(uusiaTapahtumia).padStart(3)} tapahtumaa  ` +
        `yhteensä ${rivit}` +
        (virhe ? `  VIRHE: ${virhe}` : "")
    )

    edellinenRivit = rivit
    edellinenTapahtumat = tapahtumat

    /*
     * Tapahtuma ilman uutta riviä on edistymistä sekin: osuma tai
     * valmiina kirjautunut hanke ei luo jonoriviä. Vain kumpikin
     * nollana tarkoittaa ettei lähde enää tuota.
     */
    if (uusiaRiveja === 0 && uusiaTapahtumia === 0) {
      tyhjia++
      if (tyhjia >= TYHJIA_PERAKKAIN) {
        console.log(`\nKaksi perakkaista ajoa ilman uutta — lopetetaan.`)
        break
      }
    } else {
      tyhjia = 0
    }
  }

  console.log(`\n=== VALMIS ===`)
  console.log(`  ajoja          ${ajoja}`)
  console.log(`  jonorivejä     ${edellinenRivit}`)
  console.log(`  tapahtumia     ${edellinenTapahtumat}`)
  if (ajoja >= MAX_AJOJA) {
    console.log(`  HUOM: ajoraja ${MAX_AJOJA} tuli vastaan, lähde voi yhä tuottaa lisää.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
