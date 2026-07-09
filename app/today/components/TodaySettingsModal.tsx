"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

const companyProfiles = [
  "Rakennusliike",
  "Talotekniikka",
  "Sähköurakoitsija",
  "Rakennustuotteet",
  "Arkkitehti",
  "Rakennesuunnittelu",
  "Infra",
  "Kiinteistönomistaja",
  "Muu",
]

const salesMoments = [
  "Kaavoitus",
  "Ideointi",
  "Suunnittelu",
  "Rakennuslupa",
  "Kilpailutus",
  "Rakenteilla",
  "Valmistumassa",
]

const sources = [
  "Rakennusluvat",
  "Hilma",
  "Kaavoitus",
  "Kuntapäätökset",
  "Yritysuutiset",
]

const maxProjectOptions = [20, 40, 60, 100]

export default function TodaySettingsModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  const [companyProfile, setCompanyProfile] = useState<string | null>(null)
  const [wholeFinland, setWholeFinland] = useState(true)
  const [selectedSalesMoments, setSelectedSalesMoments] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([
    "Rakennusluvat",
    "Hilma",
  ])
  const [maxProjects, setMaxProjects] = useState(40)

  const totalSteps = 6

  function toggleValue(
    value: string,
    values: string[],
    setter: (nextValues: string[]) => void
  ) {
    setter(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]
    )
  }

  function closeModal() {
    setOpen(false)
    setStep(0)
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, totalSteps))
  }

  function previousStep() {
    setStep((current) => Math.max(current - 1, 0))
  }

  async function saveSettings() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    alert("Kirjautunutta käyttäjää ei löytynyt.")
    return
  }

  const response = await fetch("/api/today/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: user.id,
      settings: {
        companyProfile,
        regions: wholeFinland ? ["Koko Suomi"] : [],
        municipalities: [],
        projectStages: [],
        constructionTypes: [],
        buildingTypes: [],
        bestSalesMoments: selectedSalesMoments,
        sources: selectedSources,
        maxProjects,
        showRejected: false,
        showArchived: false,
      },
    }),
  })

  const result = await response.json()

  if (!response.ok || !result.ok) {
    alert(result.error ?? "Asetusten tallennus epäonnistui.")
    return
  }

  closeModal()
}

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
      >
        Mukauta näkymää
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="border-b px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">
                    Vaihe {step + 1} / {totalSteps + 1}
                  </div>

                  <h2 className="text-2xl font-bold">
                    Mukauta Tänään-näkymää
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                >
                  Sulje
                </button>
              </div>
            </div>

            <div className="min-h-[420px] px-6 py-6">
              {step === 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Tervetuloa Tänään-näkymään
                  </h3>

                  <p className="mt-4 text-gray-600">
                    Rakennamme juuri sinun yrityksellesi sopivan näkymän.
                  </p>

                  <p className="mt-3 text-gray-600">
                    Tämä vie alle minuutin. Voit muuttaa asetuksia myöhemmin.
                  </p>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Mikä kuvaa yritystäsi parhaiten?
                  </h3>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {companyProfiles.map((profile) => (
                      <button
                        key={profile}
                        type="button"
                        onClick={() => setCompanyProfile(profile)}
                        className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold ${
                          companyProfile === profile
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {profile}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Missä toimit?
                  </h3>

                  <label className="mt-5 flex items-center gap-3 rounded-lg border p-4">
                    <input
                      type="checkbox"
                      checked={wholeFinland}
                      onChange={(event) => setWholeFinland(event.target.checked)}
                    />
                    <span className="font-semibold">Koko Suomi</span>
                  </label>

                  <p className="mt-3 text-sm text-gray-600">
                    Maakunta- ja kuntavalinnat lisätään seuraavaksi.
                  </p>
                </div>
              )}

              {step === 3 && (
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      Paras myyntihetki
                    </h3>

                    <span
                      title="Valitse missä hankkeen vaiheessa haluat nähdä sen Tänään-näkymässä."
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold text-gray-600"
                    >
                      ?
                    </span>
                  </div>

                  <p className="mt-2 text-gray-600">
                    Voit valita useamman vaiheen.
                  </p>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {salesMoments.map((moment) => (
                      <label
                        key={moment}
                        className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSalesMoments.includes(moment)}
                          onChange={() =>
                            toggleValue(
                              moment,
                              selectedSalesMoments,
                              setSelectedSalesMoments
                            )
                          }
                        />
                        {moment}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Mistä lähteistä Tänään saa etsiä hankkeita?
                  </h3>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {sources.map((source) => (
                      <label
                        key={source}
                        className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSources.includes(source)}
                          onChange={() =>
                            toggleValue(source, selectedSources, setSelectedSources)
                          }
                        />
                        {source}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Kuinka paljon haluat nähdä?
                  </h3>

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    {maxProjectOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMaxProjects(value)}
                        className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
                          maxProjects === value
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 6 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Tänään-näkymä on valmis!
                  </h3>

                  <p className="mt-4 text-gray-600">
                    Näytämme tästä lähtien juuri sinulle sopivat hankkeet.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between border-t px-6 py-5">
              <button
                type="button"
                onClick={previousStep}
                disabled={step === 0}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"
              >
                Takaisin
              </button>

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white"
                >
                  {step === 0 ? "Aloitetaan" : "Seuraava"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveSettings}
                  className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white"
                >
                  Aloita Tänään-näkymän käyttö
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}