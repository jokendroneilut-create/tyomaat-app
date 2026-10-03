"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

/*
 * TEKSTISTA POIMITTU OSAPUOLI — ROOLI IHMISELLE (D-235).
 *
 * Poimija tunnistaa hankkeen omasta tekstista yrityksen joka on kannassa
 * jo osapuolena (`lib/agent/osapuoliTekstista.ts`), mutta EI paattele
 * roolia: "NCC kaynnistaa" ei erota urakoitsijaa rakennuttajasta.
 * Mitattu 3.10.2026: roolin saattoi lukea tekstista vain yhdesta nimesta
 * 67:sta.
 *
 * TODISTE NAYTETAAN AINA. Napin vieressa on se lause josta nimi loytyi,
 * koska paatos tehdaan lauseesta eika nimesta. Mitattu samasta ajosta:
 * noin joka viides osuma on lahdeluettelon viite tai tien nimi, ja ne
 * erottaa vain lukemalla lauseen.
 */

type Loydos = {
  nimi: string
  rooli: "developer" | "builder" | null
  lause: string
}

export default function OsapuoliEhdotus({
  projectId,
  ehdotus,
  current,
}: {
  projectId: string
  ehdotus: { nimet: Loydos[]; luotu?: string }
  current: { developer: string; builder: string }
}) {
  const router = useRouter()
  const [kesken, setKesken] = useState<string | null>(null)
  const [virhe, setVirhe] = useState<string | null>(null)

  const nimet = (ehdotus?.nimet ?? []).filter((n) => n && n.nimi)
  if (!nimet.length) return null

  async function paata(loydos: Loydos, rooli: "developer" | "builder" | null) {
    setKesken(`${loydos.nimi}:${rooli ?? "ei"}`)
    setVirhe(null)

    try {
      if (rooli) {
        const vastaus = await fetch("/api/tic/projects/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, fields: { [rooli]: loydos.nimi } }),
        })
        const tulos = await vastaus.json()
        if (!vastaus.ok || !tulos?.ok) {
          setVirhe(tulos?.error ?? "Tallennus epaonnistui")
          return
        }
      }

      /*
       * Nimi poistetaan ehdotuksesta kummassakin tapauksessa: hyvaksytty
       * on jo kentassa, hylatty on katsottu. Muuten sama rivi palaisi
       * jonoon huomenna.
       */
      const siivous = await fetch("/api/tic/projects/osapuoliehdotus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, nimi: loydos.nimi }),
      })
      const siivousTulos = await siivous.json()
      if (!siivous.ok || !siivousTulos?.ok) {
        setVirhe(siivousTulos?.error ?? "Ehdotuksen siivous epaonnistui")
        return
      }

      router.refresh()
    } catch (err: any) {
      setVirhe(String(err?.message ?? err))
    } finally {
      setKesken(null)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <h2 className="text-lg font-semibold text-gray-900">
        Osapuoli hankkeen omassa tekstissä
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Nimi on tunnistettu hankkeen omasta kuvauksesta.{" "}
        <strong>Rooli ei ole luettavissa tekstistä</strong>, joten valitse se
        alla olevan lauseen perusteella — tai hylkää nimi jos se ei ole
        hankkeen osapuoli.
      </p>

      {virhe && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {virhe}
        </p>
      )}

      <ul className="mt-4 space-y-4">
        {nimet.map((loydos) => (
          <li
            key={loydos.nimi}
            className="rounded-xl border border-emerald-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-gray-900">
                {loydos.nimi}
              </span>
              {loydos.rooli && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  teksti sanoo:{" "}
                  {loydos.rooli === "builder" ? "urakoitsija" : "rakennuttaja"}
                </span>
              )}
            </div>

            <p className="mt-2 border-l-2 border-gray-200 pl-3 text-sm italic text-gray-600">
              {loydos.lause}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => paata(loydos, "developer")}
                disabled={Boolean(kesken)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {kesken === `${loydos.nimi}:developer`
                  ? "Tallennetaan…"
                  : "Rakennuttajaksi"}
                {current.developer ? ` (korvaa: ${current.developer})` : ""}
              </button>

              <button
                onClick={() => paata(loydos, "builder")}
                disabled={Boolean(kesken)}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {kesken === `${loydos.nimi}:builder`
                  ? "Tallennetaan…"
                  : "Pääurakoitsijaksi"}
                {current.builder ? ` (korvaa: ${current.builder})` : ""}
              </button>

              <button
                onClick={() => paata(loydos, null)}
                disabled={Boolean(kesken)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                {kesken === `${loydos.nimi}:ei` ? "Poistetaan…" : "Ei osapuoli"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
