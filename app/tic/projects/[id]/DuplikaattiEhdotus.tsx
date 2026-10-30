"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

/*
 * SAMA PAIKKA, ERI NIMI (D-365).
 *
 * Tämä näkyy ilman klikkausta, toisin kuin "Etsi olemassa oleva hanke".
 * Syy: täsmäytin ei löydä näitä osumia lainkaan, joten katselmoija ei
 * tiedä että kannattaisi etsiä. Mitattu 30.10.2026 datakeskusrekisterin
 * riveistä: koordinaatti löysi 32 osumaa 150:stä, täsmäytin nimen
 * perusteella 0 — nimet ovat eri lähteiden omia ("Hyperco Lohja,
 * Virkkala" vs. "Lohjan datakeskus").
 *
 * ETÄISYYS NÄYTETÄÄN AINA. Se on vihjeen koko peruste, ja kolmen
 * kilometrin säde tuottaa myös vääriä pareja saman kunnan sisällä. Ilman
 * lukua katselmoija ei voi erottaa 0,0 km:n osumaa 2,9 km:n osumasta.
 *
 * Vihje ei väitä duplikaattia eikä yhdistä mitään itse. Liittäminen
 * käyttää samaa reittiä kuin `MergeIntoProject`, joten kentät
 * täydentyvät samalla logiikalla: tyhjät täyttyvät, olemassa olevia ei
 * ylikirjoiteta.
 */
type Osuma = {
  hanke_id: string
  nimi: string
  kunta: string | null
  vaihe: string | null
  tilaaja: string | null
  etaisyys_km: number
}

export default function DuplikaattiEhdotus({
  candidateId,
  ehdotus,
}: {
  candidateId: string
  ehdotus: { osumat?: Osuma[]; sade_km?: number } | null
}) {
  const router = useRouter()
  const [kesken, setKesken] = useState<string | null>(null)
  const [virhe, setVirhe] = useState<string | null>(null)

  const osumat = (ehdotus?.osumat ?? []).filter((o) => o && o.hanke_id)
  if (!osumat.length) return null

  async function liita(osuma: Osuma) {
    const varmistus = window.confirm(
      `Liitetäänkö tämä ehdokas hankkeeseen "${osuma.nimi}"?\n\n` +
        `Etäisyys ${osuma.etaisyys_km} km. Ehdokkaan tiedot täydentävät ` +
        "hankkeen tyhjiä kenttiä. Olemassa olevia arvoja ei ylikirjoiteta."
    )
    if (!varmistus) return

    setKesken(osuma.hanke_id)
    setVirhe(null)

    try {
      const vastaus = await fetch("/api/tic/projects/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          potentialProjectId: candidateId,
          mergeIntoProjectId: osuma.hanke_id,
        }),
      })
      const tulos = await vastaus.json()
      if (!vastaus.ok || !tulos.ok) {
        throw new Error(tulos.error ?? "Liittäminen epäonnistui")
      }
      router.push("/tic")
      router.refresh()
    } catch (e: any) {
      setVirhe(e.message ?? "Tuntematon virhe")
      setKesken(null)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">
        📍 Samassa paikassa on jo hanke ({osumat.length})
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Löytyi koordinaatista, ei nimestä — täsmäytin ei näitä löydä. Säde{" "}
        {ehdotus?.sade_km ?? 3} km ja sama laji, joten sama kortteli voi
        tarkoittaa myös eri hanketta. Tarkista etäisyys.
      </p>

      <div className="mt-3 space-y-2">
        {osumat.map((o) => (
          <div
            key={o.hanke_id}
            className="rounded-lg border border-amber-200 bg-white p-3"
          >
            {/* Ei `flex-wrap`: pitkalla otsikolla etaisyysmerkki putosi
                keskelle korttia, ja se on juuri se luku joka pitaa nakya
                samalla rivilla nimen kanssa. */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tic/hanke/${o.hanke_id}`}
                  className="font-semibold text-gray-900 underline"
                >
                  {o.nimi}
                </Link>
                <p className="mt-0.5 text-sm text-gray-600">
                  {[o.kunta, o.vaihe].filter(Boolean).join(" · ") || "—"}
                  {o.tilaaja ? ` · Rakennuttaja: ${o.tilaaja}` : ""}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                {o.etaisyys_km} km
              </span>
            </div>

            <button
              type="button"
              onClick={() => liita(o)}
              disabled={kesken !== null}
              className="mt-3 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {kesken === o.hanke_id ? "Liitetään…" : "Liitä tähän hankkeeseen"}
            </button>
          </div>
        ))}
      </div>

      {virhe && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {virhe}
        </div>
      )}
    </div>
  )
}
