"use client"

/*
 * VIRHERAJA KOKO SOVELLUKSELLE (D-246).
 *
 * Ennen tata yhtaan error.tsx:aa ei ollut, joten mika tahansa
 * palvelinpuolen poikkeus nayttui asiakkaalle Next.js:n omana ruutuna:
 * "Application error: a server-side exception has occurred." Englanniksi,
 * ilman ulospaasya. Johannes osui siihen 7.10.2026 `/today`-sivulla, ja
 * SIVUN PAIVITYS korjasi tilanteen — eli ainoa tarvittava toimenpide oli
 * se, jota ruutu ei kertonut.
 *
 * TAMA EI PIILOTA VIKAA. Jos kanta on alhaalla, virhe tulee edelleen —
 * mutta suomeksi ja napin kanssa. Virhetunnus naytetaan, koska se on
 * ainoa kahva Vercelin lokiin: ilman sita tukipyynto on "sivu ei toimi".
 *
 * Tama raja ei kata juurilayoutin virheita; ne menevat
 * `app/global-error.tsx`:aan.
 */

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    /* Palvelimen poikkeus on jo lokissa; tama kirjaa myos selainpuolen. */
    console.error("Sivun renderointi epaonnistui", error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 py-12 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Sivun lataaminen ei onnistunut</h1>

      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        Tämä on yleensä hetkellinen häiriö. Yritä uudelleen — useimmiten sivu
        aukeaa heti toisella kerralla.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={reset}
          className="w-full max-w-xs rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Yritä uudelleen
        </button>

        <a href="/today" className="text-sm text-blue-700 underline">
          Siirry etusivulle
        </a>
      </div>

      {error.digest && (
        <p className="mt-8 text-xs text-gray-400">
          Jos vika toistuu, kerro tämä tunnus: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </main>
  )
}
