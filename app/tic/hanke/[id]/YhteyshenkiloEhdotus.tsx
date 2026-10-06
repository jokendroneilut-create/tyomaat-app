"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

/*
 * VERKOSTA HAETTU YHTEYSHENKILO - IHMISEN HYVAKSYTTAVAKSI (D-244).
 *
 * Ehdotus elaa `metadata.yhteyshenkiloehdotus`issa eika ole asiakkaalle
 * nakyvaa dataa. Hyvaksynta lisaa sen hankkeen yhteyshenkiloihin
 * TAYDENTAEN, ei korvaten: yhteystietokentasta ei poisteta mitaan.
 *
 * LAHTEET NAYTETAAN KLIKATTAVINA, koska tarkistaminen on koko pointti.
 * Malli on voinut lukea oikean sivun vaarin, ja vaara numero on
 * asiakkaalle pahempi kuin puuttuva - han soittaa sen.
 */

type Ehdotus = {
  nimi: string
  nimike: string | null
  organisaatio: string | null
  email: string | null
  puhelin: string | null
  varmuus: "high" | "medium" | "low"
  lahteet: string[]
  perustelu: string
  model: string
  luotu?: string
}

const VARMUUS_TYYLI: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
}

export default function YhteyshenkiloEhdotus({
  projectId,
  ehdotus,
}: {
  projectId: string
  ehdotus: Ehdotus
}) {
  const router = useRouter()
  const [kesken, setKesken] = useState<"hyvaksy" | "hylkaa" | null>(null)
  const [virhe, setVirhe] = useState<string | null>(null)

  async function paata(hyvaksy: boolean) {
    setKesken(hyvaksy ? "hyvaksy" : "hylkaa")
    setVirhe(null)

    try {
      const vastaus = await fetch("/api/tic/projects/yhteyshenkiloehdotus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, hyvaksy }),
      })
      const tulos = await vastaus.json()
      if (!vastaus.ok || !tulos?.ok) {
        setVirhe(tulos?.error ?? "Tallennus epaonnistui")
        setKesken(null)
        return
      }
      router.refresh()
    } catch (err: any) {
      setVirhe(String(err?.message ?? err))
      setKesken(null)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-purple-200 bg-purple-50 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Verkosta haettu yhteyshenkilo
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            VARMUUS_TYYLI[ehdotus.varmuus] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {ehdotus.varmuus}
        </span>
        <span className="text-xs text-gray-500">{ehdotus.model}</span>
      </div>

      <p className="mt-1 text-sm text-gray-600">
        <strong>Tarkista lahteesta ennen hyvaksyntaa</strong> - hyvaksynta lisaa
        yhteystiedon asiakkaalle nakyviin.
      </p>

      {virhe ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{virhe}</p>
      ) : null}

      <div className="mt-4 rounded-xl border border-purple-200 bg-white p-4">
        <p className="text-base font-semibold text-gray-900">{ehdotus.nimi}</p>
        <p className="text-sm text-gray-600">
          {[ehdotus.nimike, ehdotus.organisaatio].filter(Boolean).join(", ") || "-"}
        </p>
        <p className="mt-2 text-sm">
          {ehdotus.email ? (
            <a href={`mailto:${ehdotus.email}`} className="text-blue-700 underline">
              {ehdotus.email}
            </a>
          ) : null}
          {ehdotus.email && ehdotus.puhelin ? " - " : null}
          {ehdotus.puhelin ? (
            <a href={`tel:${ehdotus.puhelin}`} className="text-blue-700 underline">
              {ehdotus.puhelin}
            </a>
          ) : null}
        </p>
      </div>

      {ehdotus.perustelu ? (
        <p className="mt-3 text-sm italic text-gray-600">{ehdotus.perustelu}</p>
      ) : null}

      <ul className="mt-3 space-y-1 text-sm">
        {ehdotus.lahteet.map((lahde) => (
          <li key={lahde}>
            <a
              href={lahde}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >
              {lahde.length > 86 ? `${lahde.slice(0, 86)}...` : lahde}
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => paata(true)}
          disabled={Boolean(kesken)}
          className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {kesken === "hyvaksy" ? "Tallennetaan..." : "Hyvaksy yhteyshenkiloksi"}
        </button>
        <button
          onClick={() => paata(false)}
          disabled={Boolean(kesken)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
        >
          {kesken === "hylkaa" ? "Poistetaan..." : "Hylkaa"}
        </button>
      </div>
    </section>
  )
}
