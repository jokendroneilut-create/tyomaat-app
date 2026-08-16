import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Props = {
  searchParams: Promise<{ q?: string; puutteelliset?: string; sivu?: string }>
}

/*
 * Rakentamisvaihe kärkeen: käynnissä oleva työmaa ilman osapuolia on
 * kiireellisin korjattava — asiakkaalle se on liidi jolle ei ole ketään
 * soitettavaa. Järjestys on EKSPLISIITTINEN eikä nojaa siihen että
 * "Rakenteilla" sattuu olemaan aakkosissa ennen "Suunnittelussa".
 */
const PHASE_RANK: Record<string, number> = {
  Rakenteilla: 0,
  "Rakentaminen aloitettu": 0,
  Suunnittelussa: 1,
  Suunnittelu: 1,
}

const PAGE_SIZE = 50

/*
 * Järjestys ja sivutus tehdään muistissa, koska PostgREST ei osaa
 * mielivaltaista vaihejärjestystä. Katto on tästä syystä pakko olla:
 * ilman sitä suodattamaton näkymä hakisi koko kannan.
 */
const FETCH_CAP = 1000

/*
 * Hankehaku korjausta varten (D-076).
 *
 * Nimihaun lisäksi suodatin "osapuolet puuttuvat", koska se on se joukko
 * jonka vuoksi muokkausreitti ylipäätään tehtiin: mitattu 15.8.2026, 135
 * asiakkaalle näkyvää suunnittelu- tai rakentamisvaiheen hanketta on ilman
 * rakennuttajaa ja urakoitsijaa. Ilman valmista listaa ne pitäisi etsiä
 * käsin yksitellen.
 */
export default async function TicProjectSearchPage({ searchParams }: Props) {
  const { q, puutteelliset, sivu } = await searchParams
  const onlyIncomplete = puutteelliset === "1"
  const page = Math.max(1, Number(sivu) || 1)

  /* Näkymän tila kulkee mukana hankelinkeissä, jotta paluu palaa TÄHÄN. */
  const viewParams = onlyIncomplete
    ? "?puutteelliset=1"
    : q?.trim()
      ? `?q=${encodeURIComponent(q.trim())}`
      : ""

  let query = supabaseAdmin
    .from("projects")
    .select("id, name, city, region, phase, developer, builder, estimated_cost")
    .eq("status", "active")
    .limit(FETCH_CAP)

  if (q?.trim()) {
    query = query.ilike("name", `%${q.trim()}%`)
  }

  if (onlyIncomplete) {
    query = query
      .or("developer.is.null,developer.eq.")
      .or("builder.is.null,builder.eq.")
      .in("phase", [
        "Suunnittelussa",
        "Suunnittelu",
        "Rakenteilla",
        "Rakentaminen aloitettu",
      ])
  }

  const { data: allMatching, error } = await query.order("name")

  const sorted = [...(allMatching ?? [])].sort((a: any, b: any) => {
    const rank =
      (PHASE_RANK[String(a.phase)] ?? 9) - (PHASE_RANK[String(b.phase)] ?? 9)
    if (rank !== 0) return rank
    return String(a.name).localeCompare(String(b.name), "fi")
  })

  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const projects = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    if (onlyIncomplete) params.set("puutteelliset", "1")
    if (q?.trim()) params.set("q", q.trim())
    if (target > 1) params.set("sivu", String(target))
    const query = params.toString()
    return query ? `/tic/hanke?${query}` : "/tic/hanke"
  }

  const constructionCount = sorted.filter(
    (r: any) => PHASE_RANK[String(r.phase)] === 0
  ).length

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/tic" className="text-sm text-gray-600 hover:text-gray-900">
        ← Takaisin TICiin
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Hankehaku</h1>
      <p className="mt-2 text-gray-600">
        Hyväksyttyjen hankkeiden tietojen korjaus.
      </p>

      <form className="mt-5 flex flex-wrap items-center gap-3" action="/tic/hanke">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Hankkeen nimi…"
          className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="puutteelliset"
            value="1"
            defaultChecked={onlyIncomplete}
          />
          Vain osapuolettomat (suunnittelu / rakenteilla)
        </label>

        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Hae
        </button>
      </form>

      {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}

      {/*
        MITÄ LISTA NYT NÄYTTÄÄ — sanottava ääneen. Ilman tätä suodattamaton
        perusnäkymä on erehdyttävän näköinen jono: navigaatiossa lukee
        "Hankkeet (N)", ja jos suodatin on pois päältä, listalla on hankkeita
        joilla osapuolet ovat kunnossa. Se näyttää siltä ettei jono tyhjentynyt.
      */}
      <p className="mt-6 text-sm">
        {onlyIncomplete ? (
          <span className="font-medium text-gray-900">
            Osapuolettomat hankkeet — suunnittelu tai rakentaminen käynnissä,
            ei rakennuttajaa eikä pääurakoitsijaa
          </span>
        ) : (
          <span className="font-medium text-gray-900">
            Kaikki aktiiviset hankkeet{q?.trim() ? ` haulla "${q.trim()}"` : ""}
          </span>
        )}
        <span className="ml-2 text-gray-500">
          {total} hanketta
          {constructionCount
            ? ` · ${constructionCount} rakentamisvaiheessa (ensin listalla)`
            : ""}
          {total >= FETCH_CAP ? " · katkaistu 1000:een" : ""}
        </span>
      </p>

      <ul className="mt-3 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
        {(projects ?? []).map((p: any) => (
          <li key={p.id} className="px-5 py-3">
            <Link
              href={`/tic/hanke/${p.id}${viewParams}`}
              className="block hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">{p.name}</span>

              <span className="ml-2 text-sm text-gray-500">
                {[p.city, p.phase].filter(Boolean).join(" · ")}
              </span>

              <span className="mt-1 block text-sm text-gray-600">
                {p.developer || p.builder ? (
                  [p.developer, p.builder].filter(Boolean).join(" / ")
                ) : (
                  <span className="text-red-600">osapuolet puuttuvat</span>
                )}
                {p.estimated_cost
                  ? ` · ${Number(p.estimated_cost).toLocaleString("fi-FI")} €`
                  : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {pageCount > 1 ? (
        <nav className="mt-4 flex items-center gap-3 text-sm">
          {current > 1 ? (
            <Link
              href={pageHref(current - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
            >
              ← Edellinen
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">
              ← Edellinen
            </span>
          )}

          <span className="text-gray-600">
            Sivu {current} / {pageCount}
          </span>

          {current < pageCount ? (
            <Link
              href={pageHref(current + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
            >
              Seuraava →
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">
              Seuraava →
            </span>
          )}
        </nav>
      ) : null}
    </main>
  )
}
