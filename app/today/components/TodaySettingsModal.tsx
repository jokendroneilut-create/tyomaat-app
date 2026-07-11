"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

import StepCompanyProfile from "./settings/StepCompanyProfile"
import StepFinished from "./settings/StepFinished"
import StepMaxProjects from "./settings/StepMaxProjects"
import StepRegion from "./settings/StepRegion"
import StepSalesMoment from "./settings/StepSalesMoment"
import StepSources from "./settings/StepSources"
import StepWelcome from "./settings/StepWelcome"

import {
  regions,
  todaySources,
} from "./settings/todaySettingsConfig"

export default function TodaySettingsModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  const [companyProfile, setCompanyProfile] = useState<string | null>(null)

  const [wholeFinland, setWholeFinland] = useState(true)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([
    ...regions,
  ])

  const [selectedSalesMoments, setSelectedSalesMoments] = useState<string[]>([])

  const [selectedSources, setSelectedSources] = useState<string[]>([
    ...todaySources,
  ])

  const [maxProjects, setMaxProjects] = useState(40)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalSteps = 6

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!user) {
          throw new Error("Kirjautunutta käyttäjää ei löytynyt.")
        }

        const response = await fetch(
          `/api/today/preferences?userId=${encodeURIComponent(user.id)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        )

        const result = await response.json()

        if (!response.ok || !result.ok) {
          throw new Error(
            result.error ?? "Asetusten lataaminen epäonnistui."
          )
        }

        if (cancelled || !result.settings) {
          return
        }

        const settings = result.settings

        setCompanyProfile(settings.companyProfile ?? null)

        const savedRegions = Array.isArray(settings.regions)
          ? settings.regions
          : []

        const hasWholeFinland = savedRegions.includes("Koko Suomi")

        setWholeFinland(hasWholeFinland)

        setSelectedRegions(
          hasWholeFinland
            ? [...regions]
            : savedRegions.filter((region: string) =>
                regions.includes(
                  region as (typeof regions)[number]
                )
              )
        )

        setSelectedSalesMoments(
          Array.isArray(settings.bestSalesMoments)
            ? settings.bestSalesMoments
            : []
        )

        setSelectedSources(
          Array.isArray(settings.sources)
            ? settings.sources
            : [...todaySources]
        )

        setMaxProjects(Number(settings.maxProjects ?? 40))
      } catch (loadError: any) {
        if (!cancelled) {
          console.error("TODAY SETTINGS LOAD ERROR:", loadError)

          setError(
            loadError?.message ?? "Asetusten lataaminen epäonnistui."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  function openModal() {
    setError(null)
    setStep(0)
    setOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setOpen(false)
    setStep(0)
    setError(null)
  }

  function nextStep() {
    setError(null)
    setStep((current) => Math.min(current + 1, totalSteps))
  }

  function previousStep() {
    setError(null)
    setStep((current) => Math.max(current - 1, 0))
  }

  async function saveSettings() {
    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error("Kirjautunutta käyttäjää ei löytynyt.")
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

            regions: wholeFinland
              ? ["Koko Suomi"]
              : selectedRegions,

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
        throw new Error(
          result.error ?? "Asetusten tallennus epäonnistui."
        )
      }

      setOpen(false)
      setStep(0)

      window.location.reload()
    } catch (saveError: any) {
      setError(
        saveError?.message ?? "Asetusten tallennus epäonnistui."
      )
    } finally {
      setSaving(false)
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return <StepWelcome />

      case 1:
        return (
          <StepCompanyProfile
            selectedProfile={companyProfile}
            onChange={setCompanyProfile}
          />
        )

      case 2:
        return (
          <StepRegion
            wholeFinland={wholeFinland}
            selectedRegions={selectedRegions}
            onWholeFinlandChange={setWholeFinland}
            onRegionsChange={setSelectedRegions}
          />
        )

      case 3:
        return (
          <StepSalesMoment
            selectedMoments={selectedSalesMoments}
            onChange={setSelectedSalesMoments}
          />
        )

      case 4:
        return (
          <StepSources
            selectedSources={selectedSources}
            onChange={setSelectedSources}
          />
        )

      case 5:
        return (
          <StepMaxProjects
            selectedValue={maxProjects}
            onChange={setMaxProjects}
          />
        )

      case 6:
        return <StepFinished />

      default:
        return <StepWelcome />
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
      >
        Mukauta näkymää
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="today-settings-title"
        >
          <div className="flex h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="shrink-0 border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-gray-500">
                    Vaihe {step + 1} / {totalSteps + 1}
                  </div>

                  <h2
                    id="today-settings-title"
                    className="mt-1 text-2xl font-bold text-gray-900"
                  >
                    Mukauta näkymää
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Sulje
                </button>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gray-900 transition-all"
                  style={{
                    width: `${((step + 1) / (totalSteps + 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {loading ? (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
                  Ladataan asetuksia...
                </div>
              ) : (
                renderStep()
              )}

              {error && (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-white px-6 py-5">
              <button
                type="button"
                onClick={previousStep}
                disabled={step === 0 || saving || loading}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"
              >
                Takaisin
              </button>

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={saving || loading}
                  className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {step === 0 ? "Aloitetaan" : "Seuraava"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving || loading}
                  className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Tallennetaan..."
                    : "Aloita Tänään-näkymän käyttö"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}