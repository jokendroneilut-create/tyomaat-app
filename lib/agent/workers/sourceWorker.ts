import { createClient } from "@supabase/supabase-js"
import { collectApiSource } from "@/lib/agent/discovery/collectors/apiCollector"
import { collectHtmlSource } from "@/lib/agent/discovery/collectors/htmlCollector"
import { collectLegacySource } from "@/lib/agent/discovery/collectors/legacyFetchCollector"
import { collectCompanyMentionSource } from "@/lib/agent/discovery/collectors/companyMentionCollector"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * Node.js:n fetch kääntää kaikki verkkovirheet samaksi viestiksi "fetch
 * failed" ja jättää oikean syyn (ECONNRESET, ETIMEDOUT, ENOTFOUND, EPROTO...)
 * error.cause-kenttään. Ilman tätä lokista ei näe, onko kyse esimerkiksi
 * palomuurin katkaisemasta yhteydestä vai nimipalveluvirheestä. Yhteysvirheet
 * tulevat usein AggregateErrorina (yksi yritys per IP-osoite), jolloin koodi
 * on vasta cause.errors-listan ensimmäisessä alkiossa.
 */
function describeError(error: any): string {
  const message = String(error?.message ?? error)
  const cause: any = error?.cause
  if (!cause) return message

  const detail =
    cause.code ??
    cause.errors?.find((e: any) => e?.code)?.code ??
    cause.message

  return detail ? `${message} (${detail})` : message
}

/*
 * AIKAKATKAISU LAHDEAJOLLE.
 *
 * Yksikään haku ei saa jumittaa ajoa ikuisesti. Ilman tätä hidas tai
 * vastaamaton palvelin jätti ajon tilaan "started" pysyvästi: mitattu
 * 13 tällaista ajoa heinäkuulta asti, eikä yksikään kirjannut virhettä,
 * koska kumpikaan try/catch-haara ei koskaan suoriutunut.
 *
 * RAJA MITOITETAAN AJON BUDJETTIIN, EI YKSITTAISEEN LAHTEESEEN.
 * Reitin `maxDuration` on 500 s ja yksi ajo käsittelee 14 lähdettä, joten
 * keskimäärin aikaa on noin 35 s per lähde - mitattu toteuma on ~20 s.
 * Liian pitkä katkaisu ei siis korjaa mitään: viiden minuutin rajalla
 * yksi jumittaja söisi 60 % budjetista ja loput jäisivät yhä ajamatta,
 * mikä on juuri se vika jota korjataan.
 *
 * 90 sekuntia on nelinkertainen mitattuun keskiarvoon nähden - riittää
 * hitaalle alasivuja hakevalle kerääjälle (Seinäjoki, Kerava) mutta
 * jättää 400 s muille vaikka yksi lähde katkaistaisiin.
 *
 * RAJA EI KOSKE PELKKAA HAKUA. Sen sisällä on koko lähteen ajo: haku,
 * alasivujen täydennys JA kaikkien kandidaattien tuonti
 * duplikaattivertailuineen. Siksi viesti ei saa syyttää lähdettä -
 * mitattu 14.8.2026: Rakennuslehden syöte ja kaikkien kandidaattien
 * täydennys vievät 1,2 s, mutta koko ajo katkesi 114 sekuntiin. Hitaus
 * oli omassa tuonnissa, ei palvelimessa.
 */
const SOURCE_TIMEOUT_MS = 90 * 1000

export class SourceTimeoutError extends Error {
  constructor(sourceName: string, ms: number) {
    super(
      `Ajo ylitti ${Math.round(ms / 1000)} sekuntia (haku + tuonti): ${sourceName}`
    )
    this.name = "SourceTimeoutError"
  }
}

async function withTimeout<T>(work: Promise<T>, sourceName: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined

  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new SourceTimeoutError(sourceName, SOURCE_TIMEOUT_MS)),
          SOURCE_TIMEOUT_MS
        )
      }),
    ])
  } finally {
    /*
     * Ajastin on siivottava myös onnistuneessa haarassa, muuten prosessi
     * jää elämään viideksi minuutiksi jokaisen ajon jälkeen.
     */
    if (timer) clearTimeout(timer)
  }
}

/*
 * VAHTIKOIRA JUMIIN JAANEILLE AJOILLE.
 *
 * Aikakatkaisu estää uudet jumit, mutta ei siivoa vanhoja eikä auta jos
 * koko suoritusympäristö kaatuu kesken ajon (Vercelin aikaraja, deploy).
 * Silloin rivi jää "started"-tilaan eikä kukaan tiedä siitä: lähteen
 * `error_count` pysyy nollassa ja tilannekuva näyttää terveeltä.
 *
 * Ajetaan putken alussa, jotta edellisen ajon roskat siivoutuvat ennen
 * kuin uusia valitaan.
 */
const STUCK_RUN_AGE_MS = 60 * 60 * 1000

export async function reapStuckRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_RUN_AGE_MS).toISOString()

  const { data: stuck, error } = await supabaseAdmin
    .from("discovery_runs")
    .select("id, source_id, source_name, created_at")
    .eq("status", "started")
    .lt("created_at", cutoff)

  if (error || !stuck?.length) return 0

  const message = "Ajo jäi kesken (ei päättynyt tunnissa)"

  for (const run of stuck) {
    /*
     * AIKALEIMAT AJON MUKAAN, EI SIIVOUSHETKEN.
     *
     * Siivous voi tapahtua viikkoja ajon jälkeen. Jos virhe leimattaisiin
     * nykyhetkeen, lähde näyttäisi hajonneen juuri nyt vaikka se on
     * onnistunut sen jälkeen monta kertaa. Mitattu 14.8.2026: kuusi
     * lähdettä näkyi rikkinäisinä 11.-14.8. jumiajan takia, ja kolmella
     * niistä TUOREIN ajo oli onnistunut.
     *
     * Päättymisajaksi merkitään hetki jolloin ajo tiedettiin kuolleeksi
     * (alku + tunti). Nykyhetki tuottaisi kestoja kuten 24 vuorokautta,
     * jotka pilaavat kestotilastot - mitattu p99 10 037 s.
     */
    const startedAt = new Date(run.created_at)
    const deadAt = new Date(startedAt.getTime() + STUCK_RUN_AGE_MS).toISOString()

    await supabaseAdmin
      .from("discovery_runs")
      .update({
        status: "error",
        error_message: message,
        finished_at: deadAt,
      })
      .eq("id", run.id)

    const { data: source } = await supabaseAdmin
      .from("discovery_sources")
      .select("error_count, last_error_at")
      .eq("id", run.source_id)
      .maybeSingle()

    /*
     * Vanhempaa jumia siivotessa ei saa siirtää virheaikaa taaksepäin,
     * jos lähteellä on jo tuoreempi virhe kirjattuna.
     */
    const known = source?.last_error_at ? new Date(source.last_error_at) : null
    const lastErrorAt = known && known > new Date(deadAt) ? source!.last_error_at : deadAt

    await supabaseAdmin
      .from("discovery_sources")
      .update({
        last_error_at: lastErrorAt,
        last_error_message: message,
        error_count: Number(source?.error_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.source_id)
  }

  return stuck.length
}

export async function runSourceWorker(sourceId: string) {
  const { data: source, error: sourceError } = await supabaseAdmin
    .from("discovery_sources")
    .select("*")
    .eq("id", sourceId)
    .single()

  if (sourceError || !source) {
    return {
      ok: false,
      error: "Source not found",
    }
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("discovery_runs")
    .insert({
      source_id: source.id,
      source_name: source.name,
      status: "started",
    })
    .select()
    .single()

  if (runError) throw runError

  /*
   * LAST_RUN_AT MERKITAAN HETI, EI VASTA LOPUSSA.
   *
   * Putki valitsee lähteet järjestyksessä vanhin ensin. Jos leima
   * päivitetään vasta onnistuneen ajon lopussa, jumiin jäänyt lähde pysyy
   * ikuisesti vanhimpana: se valitaan joka ajossa ensimmäisenä, jumittuu
   * taas, eikä leima päivity koskaan.
   *
   * Mitattu 13.8.2026: umpikuja alkoi 11.8. klo 12 ja jokainen sen
   * jälkeinen cron-ajo käsitteli enää KAKSI lähdettä - Hilman ja yhden
   * jumittajan (ensin YVA, sitten STT). 70 lähdettä 300:sta jäi ajamatta
   * viikoksi, koska ajo kuoli jumittajaan eikä ehtinyt lopuille.
   *
   * Aloitusleima katkaisee kierteen: jumittunutkin lähde siirtyy jonon
   * hännille ja muut pääsevät vuoroon.
   */
  await supabaseAdmin
    .from("discovery_sources")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", source.id)

  try {
    let result

    const collectors: Record<string, (source: any) => Promise<any>> = {
  htmlCollector: collectHtmlSource,
  apiCollector: collectApiSource,
  legacyFetchCollector: collectLegacySource,
  /*
   * Rikastuslähde: ei luo ehdokkaita vaan liittää yrityksen olemassa olevaan
   * hankkeeseen. Yritys tiedottaa siitä missä hankkeissa se on mukana, ei
   * omista hankkeistaan.
   */
  companyMentionCollector: collectCompanyMentionSource,
}

const collectorName = source.collector ?? (
  source.type === "api" ? "apiCollector" :
  source.type === "html" ? "htmlCollector" :
  null
)

if (!collectorName || !collectors[collectorName]) {
  throw new Error(`Unsupported collector: ${collectorName ?? source.type}`)
}

result = await withTimeout(
  collectors[collectorName](source),
  source.name
)

    await supabaseAdmin
      .from("discovery_runs")
      .update({
        status: "success",
        documents_found: result.documentsFound ?? 1,
        documents_saved: result.documentsSaved ?? 1,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id)

    await supabaseAdmin
      .from("discovery_sources")
      .update({
        last_run_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        run_count: Number(source.run_count ?? 0) + 1,
        success_count: Number(source.success_count ?? 0) + 1,
        /*
         * Onnistuminen tyhjentää virhetilan, jotta lähdelistan "Virheet"
         * kertoo nykytilan (peräkkäiset epäonnistumiset) eikä koko elinkaaren
         * historiaa - itsestään korjautunut lähde näytti muuten ikuisesti
         * kymmeniä virheitä. Kumulatiivinen historia ei katoa: jokainen ajo
         * tuloksineen jää discovery_runs-tauluun.
         */
        last_error_message: null,
        error_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id)

    return {
      ok: true,
      sourceId: source.id,
      source: source.name,
      result,
    }
  } catch (error: any) {
    const errorMessage = describeError(error)

    await supabaseAdmin
      .from("discovery_runs")
      .update({
        status: "error",
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id)

    await supabaseAdmin
      .from("discovery_sources")
      .update({
        last_run_at: new Date().toISOString(),
        last_error_at: new Date().toISOString(),
        last_error_message: errorMessage,
        run_count: Number(source.run_count ?? 0) + 1,
        error_count: Number(source.error_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id)

    return {
      ok: false,
      sourceId: source.id,
      source: source.name,
      error: errorMessage,
    }
  }
}