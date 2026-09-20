import Link from "next/link"
import { getDiscoveryHealth } from "../../services/getDiscoveryHealth"
import {
  getHealthAlertCount,
  kuvaaHealthHalytys,
} from "../../services/getHealthAlertCount"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("fi-FI")
}

function formatMs(value: number | null) {
  if (!value) return "-"
  return `${value} ms`
}

/* "2 vrk sitten" - ikä on se mitä virheestä ensin halutaan tietää. */
function ika(value: string | null) {
  if (!value) return "ei koskaan"
  const vrk = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (vrk <= 0) return "tänään"
  return vrk === 1 ? "1 vrk sitten" : `${vrk} vrk sitten`
}

export default async function DiscoveryHealthPage() {
  /*
   * Hälytys haetaan samalta palvelulta kuin sivupalkin merkki, ei
   * uudelleen laskettuna: merkki vie tälle sivulle, joten eri luku
   * täällä olisi juuri se ristiriita jota `lahteenTila`-säännön
   * keskittäminen esti (D-185).
   */
  const [health, alert] = await Promise.all([
    getDiscoveryHealth(),
    getHealthAlertCount(),
  ])

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic/discovery" className="text-sm text-gray-600">
        ← Takaisin Discoveryyn
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        Discovery Health
      </h1>

      <p className="mt-2 text-gray-600">
        Seuraa Discoveryn lähteitä, dokumentteja, jonoja ja viimeisimpiä ajoja.
      </p>

      {/*
        * RIKKINÄISET LÄHTEET ENSIMMÄISENÄ.
        *
        * Sivupalkin merkki tuo tänne, joten sivun on vastattava siihen
        * kysymykseen jonka merkki herättää: mikä on rikki. Aiemmin sivu
        * alkoi lähde- ja dokumenttiluvuilla eikä maininnut rikkinäistä
        * lähdettä missään - syy oli vain merkin title-attribuutissa.
        *
        * Otsikkolause tulee samasta funktiosta kuin merkin teksti, joten
        * ne eivät voi kertoa samaa asiaa eri sanoin.
        */}
      <section
        className={`mt-8 rounded-2xl border p-5 shadow-sm ${
          alert.yhteensa > 0
            ? "border-red-200 bg-red-50"
            : "border-green-200 bg-green-50"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold text-gray-900">
            Rikkinäiset lähteet
          </h2>
          <span
            className={`text-sm font-semibold ${
              alert.yhteensa > 0 ? "text-red-700" : "text-green-700"
            }`}
          >
            {kuvaaHealthHalytys(alert)}
          </span>
        </div>

        {alert.rikkinaiset.length === 0 ? (
          <p className="mt-3 text-sm text-gray-700">
            Yhdenkään käytössä olevan lähteen viimeisin ajo ei ole kaatunut
            viimeisen viikon aikana.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {alert.rikkinaiset.map((lahde) => (
              <div
                key={lahde.id}
                className="rounded-xl border border-red-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold text-gray-900">{lahde.name}</div>
                  <div className="text-sm text-gray-500">
                    virhe {ika(lahde.lastErrorAt)} · viimeisin onnistuminen{" "}
                    {ika(lahde.lastSuccessAt)}
                  </div>
                </div>

                {/*
                  * Virheviesti kokonaisena. Se on koko syy - esimerkiksi
                  * "Ajo ylitti 90 sekuntia (haku + tuonti)" kertoo heti
                  * ettei vika ole lähteen palvelimessa vaan ajon katossa.
                  */}
                <div className="mt-2 text-sm text-red-700">
                  {lahde.lastErrorMessage ?? "(ei virheviestiä)"}
                </div>

                <div className="mt-2 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                  <div>Virheen aika: {formatDate(lahde.lastErrorAt)}</div>
                  <div>
                    Viimeisin onnistuminen: {formatDate(lahde.lastSuccessAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {alert.putkenVirheita > 0 && (
          <p className="mt-4 text-sm text-red-700">
            Lisäksi koko putki kaatui {alert.putkenVirheita} kertaa viimeisen
            24 tunnin aikana (agent_runs). Ne eivät näy lähteiden tilassa.
          </p>
        )}

        <p className="mt-4 text-xs text-gray-500">
          Sama sääntö kuin Keräimet-sivun &quot;ongelmia N&quot; -luvussa:
          lähde on käytössä ja sen viimeisin tapahtuma on virhe, joka on alle
          viikon vanha. Lippu putoaa vasta onnistuneesta ajosta.{" "}
          <Link href="/tic/discovery" className="underline">
            Keräimet
          </Link>
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Sources</div>
          <div className="mt-2 text-3xl font-bold">{health.sources.total}</div>
          <div className="mt-1 text-sm text-gray-600">
            Käytössä {health.sources.enabled}, pois {health.sources.disabled}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Documents</div>
          <div className="mt-2 text-3xl font-bold">{health.documents.total}</div>
          <div className="mt-1 text-sm text-gray-600">
            Tänään {health.documents.today}
          </div>
        </div>

        {/*
          * Aiemmin tässä näkyi agent_jobs-taulun "pending"-määrä, joka on
          * käytännössä aina 0: sama putkiajo sekä luo PDF-työt (vaihe 2) että
          * tyhjentää ne sekunteja myöhemmin (vaihe 3), joten jono on olemassa
          * vain ajon sisällä. Faktapoiminnan jono sen sijaan säilyy ajojen
          * välissä - se kasvaa jos putki ei pysy perässä ja purkautuu kun pysyy.
          */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Jonossa</div>
          <div className="mt-2 text-3xl font-bold">
            {health.queue.pendingFacts}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            odottaa faktapoimintaa
          </div>
          <div
            className={`mt-1 text-sm ${
              health.queue.stuckJobs > 0
                ? "font-semibold text-red-600"
                : "text-gray-600"
            }`}
          >
            {health.queue.stuckJobs} jumissa · {health.jobs.error} virhettä
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Document types</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-gray-500">HTML</div>
            <div className="text-2xl font-bold">{health.documents.html}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">PDF</div>
            <div className="text-2xl font-bold">{health.documents.pdf}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">API</div>
            <div className="text-2xl font-bold">{health.documents.api}</div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Queue status</h2>
        <p className="mt-1 text-sm text-gray-600">
          PDF-latausjono (agent_jobs). Putkiajo luo ja tyhjentää jonon samassa
          ajossa, joten Pending on lepotilassa 0 - Success on kertymä kaikilta
          ajoilta. Running-luku, joka ei laske nollaan, tarkoittaa kesken
          kuollutta ajoa: sitä ei yritetä automaattisesti uudelleen.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm text-gray-500">Pending</div>
            <div className="text-2xl font-bold">{health.jobs.pending}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Running</div>
            <div className="text-2xl font-bold">{health.jobs.running}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Success</div>
            <div className="text-2xl font-bold">{health.jobs.success}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Error</div>
            <div className="text-2xl font-bold">{health.jobs.error}</div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-xl font-semibold">Recent runs</h2>
        </div>

        <div className="divide-y">
          {health.recentRuns.map((run) => (
            <div key={run.id} className="grid gap-3 p-5 md:grid-cols-6">
              <div>
                <div className="font-semibold">{run.agent_type}</div>
                <div className="text-sm text-gray-500">
                  {run.source_name ?? "-"}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Status</div>
                <div>{run.status}</div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Documents</div>
                <div>
                  {run.documents_saved ?? 0}/{run.documents_found ?? 0}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">PDF</div>
                <div>
                  {run.pdf_saved ?? 0}/{run.pdf_found ?? 0}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Duration</div>
                <div>{formatMs(run.duration_ms)}</div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Created</div>
                <div>{formatDate(run.created_at)}</div>
              </div>

              {run.error_message && (
                <div className="md:col-span-6 text-sm text-red-600">
                  {run.error_message}
                </div>
              )}
            </div>
          ))}

          {health.recentRuns.length === 0 && (
            <div className="p-5 text-gray-600">Ei ajoja vielä.</div>
          )}
        </div>
      </section>
    </main>
  )
}