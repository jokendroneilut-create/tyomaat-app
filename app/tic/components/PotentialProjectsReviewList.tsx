"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { resolveRegion } from "@/lib/projects/resolveRegion"

function formatArea(value: number) {
  return `${Math.round(value).toLocaleString("fi-FI")} m²`
}

const PAGE_SIZE = 50

type ReviewContact = {
  name?: string | null
  title?: string | null
  phone?: string | null
  email?: string | null
  /* "authority" = viranomainen, ei hankkeen osapuoli. */
  role?: string | null
}

/* Nimetyt ensin: myyjälle nimetty kontakti on arvokkaampi kuin kirjaamo. */
function contactsOf(metadata: any): ReviewContact[] {
  const lista: ReviewContact[] = Array.isArray(metadata?.contact_persons)
    ? metadata.contact_persons
    : []

  return [...lista].sort((a, b) => {
    const an = String(a?.name ?? "").trim() ? 0 : 1
    const bn = String(b?.name ?? "").trim() ? 0 : 1
    return an - bn
  })
}

export default function PotentialProjectsReviewList({
  projects,
  totalCount,
  page = 1,
}: {
  projects: any[]
  totalCount?: number
  page?: number
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingRejectId, setConfirmingRejectId] = useState<string | null>(null)
  const [confirmingApproveId, setConfirmingApproveId] = useState<string | null>(null)

  async function approveProject(projectId: string) {
    setConfirmingApproveId(null)
    setLoadingId(projectId)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          potentialProjectId: projectId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Hyväksyntä epäonnistui")
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoadingId(null)
    }
  }

 async function rejectProject(projectId: string) {
    setConfirmingRejectId(null)
    setLoadingId(projectId)
    setError(null)

    try {
      const response = await fetch("/api/tic/projects/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          potentialProjectId: projectId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Hylkäys epäonnistui")
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message ?? "Tuntematon virhe")
    } finally {
      setLoadingId(null)
    }
  }

  if (!projects.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Ehdokkaat</h2>
        <p className="mt-2 text-gray-600">
          {page > 1
            ? "Ei ehdokkaita tällä sivulla."
            : "Ei uusia hyväksyntää odottavia hankkeita."}
        </p>
        {page > 1 && (
          <Link
            href="/tic"
            className="mt-3 inline-block rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            ← Takaisin sivulle 1
          </Link>
        )}
      </div>
    )
  }

  const totalPages = typeof totalCount === "number" ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null

  /*
   * Maakunta paatellaan kunnasta samalla saannolla kuin hyvaksynnassa
   * (D-156). Pelkka metadata.region naytti "puuttuu" niille lahteille
   * jotka eivat sita kirjoita, vaikka hyvaksynta taytti sen oikein.
   */
  const missingRegionCount = projects.filter(
    (project) =>
      !resolveRegion({
        metadataRegion: (project.metadata ?? {}).region,
        city: project.municipality,
        buyerName: (project.metadata ?? {}).developer,
      })
  ).length

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">
        Ehdokkaat{" "}
        {typeof totalCount === "number" && totalCount > projects.length
          ? `(sivu ${page}${totalPages ? ` / ${totalPages}` : ""}, yhteensä ${totalCount})`
          : `(${projects.length})`}
      </h2>

      {missingRegionCount > 0 && (
        <p className="mt-1 text-sm text-amber-700">
          {missingRegionCount} tällä sivulla ilman maakuntaa — täydennä se
          hyväksynnän yhteydessä.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {projects.map((project) => {
          const metadata = project.metadata ?? {}
          const isZoning = metadata.phase_hint === "Kaavoitus"

          return (
            <article
              key={project.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-500">
                    {metadata.business_value === "high"
                      ? "★★★★★ High"
                      : metadata.business_value === "medium"
                        ? "★★★★☆ Medium"
                        : "★★★☆☆ Review"}
                  </div>

                  <h3 className="mt-1 text-lg font-bold text-gray-900">
                    {metadata.operation ?? project.title}
                  </h3>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-gray-600">
                      {[project.address, project.municipality]
                        .filter(Boolean)
                        .join(", ")}
                    </p>

                    {/*
                      * Maakunta ohjaa sitä kenen syötteeseen hanke päätyy, ja
                      * se jää tyhjäksi kun ilmoitus ei kerro sijaintia
                      * rakenteisesti. Merkintä tekee näistä työlistan: ne
                      * korjataan tarkistuksessa käsin, koska hyväksyjä näkee
                      * alkuperäisen ilmoituksen eikä joudu arvaamaan.
                      */}
                    {!resolveRegion({ metadataRegion: metadata.region, city: project.municipality, buyerName: metadata.developer }) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Maakunta puuttuu
                      </span>
                    )}
                  </div>

                  {isZoning ? (
                    <div className="mt-3 text-sm text-gray-700">
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <strong>Kaava-alue:</strong>{" "}
                          {typeof metadata.site_area_m2 === "number"
                            ? formatArea(metadata.site_area_m2)
                            : "-"}
                        </div>
                        <div>
                          <strong>Kaupunginosa:</strong>{" "}
                          {metadata.district_name ?? "-"}
                        </div>
                      </div>

                      <p className="mt-2 text-gray-600">
                        {metadata.description
                          ? `${metadata.description.slice(0, 180).trim()}…`
                          : "Kuvausta ei vielä saatavilla — kaava on liian varhaisessa vaiheessa."}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                      <div>
                        <strong>Rakennustyyppi:</strong>{" "}
                        {metadata.building_type ?? "-"}
                      </div>
                      <div>
                        <strong>Toimenpide:</strong>{" "}
                        {metadata.construction_type ?? "-"}
                      </div>
                      <div>
                        <strong>Lupa:</strong> {project.permit_number ?? "-"}
                      </div>
                      <div>
                        <strong>Kiinteistö:</strong>{" "}
                        {project.property_id ?? "-"}
                      </div>
                    </div>
                  )}

                  {/*
                    * YHTEYSHENKILÖT NÄKYVIIN JO HYVÄKSYNNÄSSÄ.
                    *
                    * Ne näkyivät vain hankkeen omalla sivulla, joten
                    * hyväksyjä ei nähnyt listasta onko ehdokkaalla ketään
                    * kenelle soittaa. Yhteystiedot ovat yksi kolmesta
                    * syystä joiden takia testiasiakkaat eivät jääneet
                    * (docs/00_PRODUCT_BLUEPRINT.md 1.1), joten se on
                    * hyväksyntäpäätöksen kannalta olennainen tieto.
                    *
                    * Nimetty henkilö erotellaan laatikosta: kirjaamo ei
                    * ole sama asia kuin rakennuttajapäällikkö.
                    */}
                  {contactsOf(metadata).length > 0 ? (
                    <div className="mt-2 text-sm text-gray-700">
                      <strong>Yhteyshenkilöt:</strong>{" "}
                      {contactsOf(metadata)
                        .slice(0, 3)
                        .map((c) =>
                          [
                            c.name,
                            c.title,
                            c.phone,
                            c.email,
                            /*
                              * Viranomainen merkitaan nakyviin: han tuntee
                              * hankkeen muttei osta mitaan.
                              */
                            c.role === "authority" ? "(viranomainen)" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        )
                        .join("   |   ")}
                      {contactsOf(metadata).length > 3
                        ? `   (+${contactsOf(metadata).length - 3})`
                        : ""}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-amber-700">
                      Ei yhteystietoa
                    </div>
                  )}
                </div>

                <div className="flex flex-row flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:flex-col">
                  <Link
                    href={`/tic/projects/${project.id}`}
                    className="rounded-lg border px-3 py-2 text-center text-sm font-semibold hover:bg-gray-50"
                  >
                    Näytä
                  </Link>

                  {confirmingApproveId === project.id ? (
                    <div className="flex flex-row gap-1">
                      <button
                        type="button"
                        onClick={() => approveProject(project.id)}
                        disabled={loadingId === project.id}
                        autoFocus
                        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {loadingId === project.id ? "Hyväksytään..." : "Vahvista hyväksyntä"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmingApproveId(null)}
                        disabled={loadingId === project.id}
                        className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Peruuta
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingRejectId(null)
                        setConfirmingApproveId(project.id)
                      }}
                      disabled={loadingId === project.id}
                      className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Hyväksy
                    </button>
                  )}

                  {confirmingRejectId === project.id ? (
                    <div className="flex flex-row gap-1">
                      <button
                        type="button"
                        onClick={() => rejectProject(project.id)}
                        disabled={loadingId === project.id}
                        autoFocus
                        className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                      >
                        {loadingId === project.id ? "Käsitellään..." : "Vahvista hylkäys"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmingRejectId(null)}
                        disabled={loadingId === project.id}
                        className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Peruuta
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingApproveId(null)
                        setConfirmingRejectId(project.id)
                      }}
                      disabled={loadingId === project.id}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Hylkää
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {totalPages !== null && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-2 border-t pt-4">
          {page > 1 ? (
            <Link
              href={page - 1 === 1 ? "/tic" : `/tic?page=${page - 1}`}
              className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              ← Edellinen
            </Link>
          ) : (
            <span />
          )}

          <span className="text-sm text-gray-500">
            Sivu {page} / {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={`/tic?page=${page + 1}`}
              className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Seuraava →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  )
}