import Link from "next/link"
import { redirect } from "next/navigation"

import { haeYritysverkosto } from "@/lib/admin/yritysverkostoData"
import { tarkistaAdminSivu } from "@/lib/auth/onAdmin"
import { suodataYritykset } from "@/lib/metrics/yritysverkosto"

export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{ q?: string; sivu?: string }>
}

const PAGE_SIZE = 50

/*
 * YRITYSREKISTERI ADMINILLE (D-253).
 *
 * Johannes 8.10.2026: *"tee tuo rekisteri myos nakyvaksi admin
 * tunnuksilla admin kohtaan."*
 *
 * Lista kattaa rekisterin JA kaikki hankkeiden yritykset (rakennuttaja,
 * paaurakoitsija, osapuoli), koska kysymys on verkostosta eika vain
 * siita kenesta rekisterissa jo on rivi. Haku ja sivutus tehdaan
 * muistissa valmiiksi kootusta listasta; ks. yritysverkostoData.
 */
export default async function YritysrekisteriPage({ searchParams }: Props) {
  const oikeus = await tarkistaAdminSivu()
  if (!oikeus.ok) redirect(oikeus.syy === "ei-istuntoa" ? "/login" : "/today")

  const { q, sivu } = await searchParams
  const haku = q?.trim() ?? ""
  const page = Math.max(1, Number(sivu) || 1)

  let virhe: string | null = null
  let kaikki: ReturnType<typeof suodataYritykset> = []
  let yrityksiaYhteensa = 0
  try {
    const verkosto = await haeYritysverkosto()
    yrityksiaYhteensa = verkosto.size
    kaikki = suodataYritykset(verkosto.values(), haku)
  } catch (err) {
    virhe = err instanceof Error ? err.message : String(err)
  }

  const rekisterissa = kaikki.filter((y) => y.rekisteri.length > 0).length
  const total = kaikki.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rivit = kaikki.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    if (haku) params.set("q", haku)
    if (target > 1) params.set("sivu", String(target))
    const query = params.toString()
    return query ? `/dashboard/yritysrekisteri?${query}` : "/dashboard/yritysrekisteri"
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Yritysrekisteri</h1>
      <p className="mt-2 text-sm text-gray-600 sm:text-base">
        Yritykset rekisteristä ja hankkeilta: rakennuttajat, pääurakoitsijat ja
        muut osapuolet. Avaa yritys nähdäksesi ihmiset ja hankkeet.
      </p>

      <form className="mt-5 flex flex-wrap items-center gap-3" action="/dashboard/yritysrekisteri">
        <input
          name="q"
          type="search"
          defaultValue={haku}
          placeholder="Yrityksen nimi…"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base sm:max-w-sm sm:text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Hae
        </button>
      </form>

      {virhe && <p className="mt-6 text-sm text-red-600">Haku epäonnistui: {virhe}</p>}

      <p className="mt-6 text-sm">
        <span className="font-medium text-gray-900">
          {haku ? `Haku "${haku}"` : "Kaikki yritykset"}
        </span>
        <span className="ml-2 text-gray-500">
          {total} yritystä
          {haku ? ` / ${yrityksiaYhteensa}` : ""} · {rekisterissa} rekisterissä
        </span>
      </p>

      <ul className="mt-3 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
        {rivit.map((y) => (
          <li key={y.avain}>
            <Link
              href={`/dashboard/yritysrekisteri/${encodeURIComponent(y.avain)}`}
              className="block px-4 py-3 hover:bg-gray-50 sm:px-5"
            >
              <span className="break-words font-medium text-gray-900">{y.nimi}</span>
              {y.rekisteri.length > 0 ? (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  rekisterissä
                </span>
              ) : null}
              <span className="mt-1 block text-sm text-gray-600">
                {[
                  `${y.henkiloita} henkilöä`,
                  `${y.hankkeita} hanketta`,
                  y.rooleittain.rakennuttaja ? `${y.rooleittain.rakennuttaja} rakennuttajana` : null,
                  y.rooleittain.paaurakoitsija
                    ? `${y.rooleittain.paaurakoitsija} pääurakoitsijana`
                    : null,
                  y.rooleittain.osapuoli ? `${y.rooleittain.osapuoli} osapuolena` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
        {!virhe && rivit.length === 0 ? (
          <li className="px-5 py-4 text-sm text-gray-500">Ei osumia.</li>
        ) : null}
      </ul>

      {pageCount > 1 ? (
        <nav className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {current > 1 ? (
            <Link
              href={pageHref(current - 1)}
              className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50"
            >
              ← Edellinen
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-200 px-3 py-2 text-gray-400">
              ← Edellinen
            </span>
          )}

          <span className="text-gray-600">
            Sivu {current} / {pageCount}
          </span>

          {current < pageCount ? (
            <Link
              href={pageHref(current + 1)}
              className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50"
            >
              Seuraava →
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-200 px-3 py-2 text-gray-400">
              Seuraava →
            </span>
          )}
        </nav>
      ) : null}
    </main>
  )
}
