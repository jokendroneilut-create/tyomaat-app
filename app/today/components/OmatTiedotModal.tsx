"use client"

import { useState } from "react"

/*
 * OMAT TIEDOT — PAKOLLINEN KERRAN (D-238).
 *
 * Johannes 6.10.2026: *"Koska kellään ei vielä ole noita tietoja niin
 * meidän täytyy kerran pakottaa asiakkaan syöttämään ne kun kirjautuu."*
 *
 * MIKSI PAKKO. `profiles.full_name` oli kyllä täytetty kaikille 112
 * tunnukselle, mutta jokainen arvo on johdettu sähköpostiosoitteesta.
 * 76:lla siitä tuli "Etunimi Sukunimi", lopuilla 36:lla jotain muuta
 * ("sladidasdriftteam", "testi"). Tervehdys arvatulla nimellä on
 * pahempi kuin ei tervehdystä, joten nimi kysytään kerran.
 *
 * ESITÄYTETTY ARVAUS. Nykyinen nimi tarjotaan valmiiksi kenttiin, jolloin
 * useimmilta tämä on yhden klikkauksen työ — mutta se on heidän
 * vahvistuksensa, ei meidän päätelmämme.
 *
 * YRITYSTÄ EI KYSYTÄ. Se on adminin asettama ja laskutuksen avain; tässä
 * se vain näytetään. Sama sääntö kuin `/settings/omat-tiedot`-sivulla.
 *
 * EI PERUSTELUA KÄYTTÄJÄLLE. Ensimmäinen versio selitti että "tervehdimme
 * sinua nimelläsi". Johannes 6.10.2026: *"En tiedä tarvitseeko asiakkaalle
 * kertoa miksi tai mihin sitä käytämme ... sitä tarvitaan myös esimerkiksi
 * tiiminäkymään."* Hän on oikeassa kahdesti: nimi näkyy myös tiimilistassa
 * (`app/team/page.tsx` rivi 135), joten yhden käytön nimeäminen olisi
 * harhaanjohtavaa — ja omaa nimeä ei tarvitse perustella lainkaan.
 */

type Props = {
  etunimi: string
  sukunimi: string
  puhelin: string
  yritys: string | null
}

export default function OmatTiedotModal({ etunimi, sukunimi, puhelin, yritys }: Props) {
  const [etu, setEtu] = useState(etunimi)
  const [suku, setSuku] = useState(sukunimi)
  const [puh, setPuh] = useState(puhelin)
  const [tallentaa, setTallentaa] = useState(false)
  const [virhe, setVirhe] = useState<string | null>(null)

  const voiTallentaa = etu.trim().length > 0

  async function tallenna() {
    if (!voiTallentaa) return
    setTallentaa(true)
    setVirhe(null)

    try {
      const vastaus = await fetch("/api/profiili", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etunimi: etu, sukunimi: suku, puhelin: puh }),
      })
      const tulos = await vastaus.json()
      if (!vastaus.ok || !tulos?.ok) {
        setVirhe(tulos?.error ?? "Tallennus epäonnistui")
        setTallentaa(false)
        return
      }
      /* Uudelleenlataus, jotta tervehdys päivittyy ja modaali katoaa. */
      window.location.reload()
    } catch (err: any) {
      setVirhe(String(err?.message ?? err))
      setTallentaa(false)
    }
  }

  const kentta =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">Tarkista omat tietosi</h2>
        <p className="mt-2 text-sm text-gray-600">
          Voit muuttaa tietoja myöhemmin kohdassa Asetukset → Omat tiedot.
        </p>

        {virhe && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{virhe}</p>
        )}

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-gray-700">Etunimi</span>
            <input
              className={kentta}
              value={etu}
              onChange={(e) => setEtu(e.target.value)}
              autoFocus
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-gray-700">Sukunimi</span>
            <input className={kentta} value={suku} onChange={(e) => setSuku(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-gray-700">
              Puhelin <span className="font-normal text-gray-400">(valinnainen)</span>
            </span>
            <input
              className={kentta}
              value={puh}
              onChange={(e) => setPuh(e.target.value)}
              inputMode="tel"
            />
          </label>

          {yritys && (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Yritys: <strong className="text-gray-900">{yritys}</strong>
            </div>
          )}
        </div>

        <button
          onClick={tallenna}
          disabled={!voiTallentaa || tallentaa}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {tallentaa ? "Tallennetaan…" : "Tallenna"}
        </button>
      </div>
    </div>
  )
}
