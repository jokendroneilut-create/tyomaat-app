import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { haeProjektienTiedot, haeYritysverkosto } from "@/lib/admin/yritysverkostoData"
import { tarkistaAdminSivu } from "@/lib/auth/onAdmin"
import {
  ryhmitteleHankkeet,
  valmistumisKuukausi,
  yrityksenHenkilot,
} from "@/lib/metrics/yritysverkosto"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ avain: string }>
}

/* Montako hankenimea henkilon alla naytetaan ennen "ja N muuta". */
const HENKILON_HANKKEITA = 3

function puraAvain(arvo: string): string {
  try {
    return decodeURIComponent(arvo)
  } catch {
    return arvo
  }
}

/*
 * YKSI YRITYS: IHMISET JA HANKKEET (D-253).
 *
 * Ihmiset kahdesta lahteesta: rekisterin rivit (yrityksen yleiset,
 * D-242) ja hankkeiden omat yhteyshenkilot joiden organisaatio osuu
 * samaan avaimeen ("hankkeelta: <hanke>"). Hankkeet rooleittain;
 * valmistuneet nakyvat mutta himmeampina.
 */
export default async function YritysPage({ params }: Props) {
  const oikeus = await tarkistaAdminSivu()
  if (!oikeus.ok) redirect(oikeus.syy === "ei-istuntoa" ? "/login" : "/today")

  const avain = puraAvain((await params).avain)
  const verkosto = await haeYritysverkosto()
  const yritys = verkosto.get(avain)
  if (!yritys) notFound()

  const henkilot = yrityksenHenkilot(yritys)
  const tiedot = await haeProjektienTiedot([
    ...yritys.hankkeet.map((h) => h.projectId),
    ...henkilot.flatMap((h) => h.hankkeilta),
  ])
  const ryhmat = ryhmitteleHankkeet(yritys.hankkeet, tiedot)
  const hankkeenNimi = (id: string) => tiedot.get(id)?.name ?? "nimetön hanke"

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/dashboard/yritysrekisteri"
        className="inline-block py-1 text-sm text-gray-600 hover:text-gray-900"
      >
        ← Yritysrekisteri
      </Link>

      <h1 className="mt-4 break-words text-2xl font-bold text-gray-900 sm:text-3xl">
        {yritys.nimi}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {henkilot.length} henkilöä · {yritys.hankkeita} hanketta
        {yritys.rekisteri.length > 0 ? " · rekisterissä" : " · ei rekisterissä"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Ihmiset</h2>
          {henkilot.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Ei tiedossa olevia henkilöitä.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
              {henkilot.map((h, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="break-words font-medium text-gray-900">
                    {h.nimi}
                    {h.viranomainen ? (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        viranomainen
                      </span>
                    ) : null}
                  </div>
                  {h.nimike ? (
                    <div className="break-words text-sm text-gray-600">{h.nimike}</div>
                  ) : null}

                  <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
                    {h.puhelin ? (
                      <a
                        href={`tel:${h.puhelin.replace(/\s+/g, "")}`}
                        className="inline-block py-1.5 font-medium text-blue-700 underline"
                      >
                        {h.puhelin}
                      </a>
                    ) : null}
                    {h.email ? (
                      <a
                        href={`mailto:${h.email}`}
                        className="inline-block break-all py-1.5 text-blue-700 underline"
                      >
                        {h.email}
                      </a>
                    ) : null}
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    {h.rekisterissa ? (
                      <div className="break-words">
                        rekisteri
                        {h.lahde ? (
                          /^https?:\/\//.test(h.lahde) ? (
                            <>
                              {": "}
                              <a
                                href={h.lahde}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                lähde
                              </a>
                            </>
                          ) : (
                            `: ${h.lahde}`
                          )
                        ) : null}
                      </div>
                    ) : null}
                    {h.hankkeilta.length > 0 ? (
                      <div className="break-words">
                        hankkeelta:{" "}
                        {h.hankkeilta.slice(0, HENKILON_HANKKEITA).map((id, j) => (
                          <span key={id}>
                            {j > 0 ? ", " : ""}
                            <Link
                              href={`/projects?open=${encodeURIComponent(id)}`}
                              className="underline"
                            >
                              {hankkeenNimi(id)}
                            </Link>
                          </span>
                        ))}
                        {h.hankkeilta.length > HENKILON_HANKKEITA
                          ? ` ja ${h.hankkeilta.length - HENKILON_HANKKEITA} muuta`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Hankkeet</h2>
          {ryhmat.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Ei hankkeita.</p>
          ) : null}

          {ryhmat.map((ryhma) => (
            <div key={ryhma.rooli} className="mt-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {ryhma.otsikko} ({ryhma.rivit.length})
              </h3>
              <ul className="mt-1 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
                {ryhma.rivit.map((p) => (
                  <li key={p.id} className={`px-4 py-3 ${p.valmistunut ? "opacity-60" : ""}`}>
                    <Link
                      href={`/projects?open=${encodeURIComponent(p.id)}`}
                      className="break-words font-medium text-gray-900 underline-offset-2 hover:underline"
                    >
                      {p.name ?? "Nimetön hanke"}
                    </Link>
                    {p.valmistunut ? (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        valmistunut
                      </span>
                    ) : null}
                    {p.is_public === false ? (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                        piilotettu
                      </span>
                    ) : null}
                    {p.status === "expired" ? (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                        vanhentunut
                      </span>
                    ) : null}
                    <div className="mt-0.5 text-sm text-gray-600">
                      {[
                        p.city,
                        p.phase,
                        valmistumisKuukausi(p.estimated_completion)
                          ? `${p.valmistunut ? "valmistui" : "valmistuu"} ${valmistumisKuukausi(p.estimated_completion)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {p.tyo ? (
                      <div className="mt-0.5 break-words text-sm text-gray-700">Työ: {p.tyo}</div>
                    ) : null}
                    <Link
                      href={`/tic/hanke/${encodeURIComponent(p.id)}`}
                      className="mt-0.5 inline-block text-xs text-gray-500 underline"
                    >
                      TIC
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
