"use client"

import { useState } from "react"

type StepKeywordsProps = {
  keywords: string[]
  onChange: (keywords: string[]) => void
  opportunityAlerts: boolean
  onAlertsChange: (enabled: boolean) => void
}

const MAX_KEYWORDS = 30

export default function StepKeywords({
  keywords,
  onChange,
  opportunityAlerts,
  onAlertsChange,
}: StepKeywordsProps) {
  const [draft, setDraft] = useState("")

  function addKeyword(raw: string) {
    const value = raw.trim()
    if (!value) return

    const exists = keywords.some(
      (k) => k.toLowerCase() === value.toLowerCase()
    )
    if (exists || keywords.length >= MAX_KEYWORDS) {
      setDraft("")
      return
    }

    onChange([...keywords, value])
    setDraft("")
  }

  function removeKeyword(keyword: string) {
    onChange(keywords.filter((k) => k !== keyword))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Enter tai pilkku lisää avainsanan.
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addKeyword(draft)
    } else if (event.key === "Backspace" && !draft && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1])
    }
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900">
        Oman alasi avainsanat (valinnainen)
      </h3>

      <p className="mt-2 text-gray-600">
        Lisää sanoja, jotka kuvaavat erikoisalaasi. Hankkeet, joiden tiedoissa
        nämä mainitaan, nousevat näkymässäsi ylemmäs. Esim.
        sähköurakoitsija: <em>sähkö, valaistus, sähköistys</em>. Voit jättää
        tyhjäksi.
      </p>

      <div className="mt-5">
        <label className="mb-1 block text-sm font-semibold text-gray-700">
          Avainsana
        </label>

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kirjoita ja paina Enter"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => addKeyword(draft)}
            disabled={!draft.trim() || keywords.length >= MAX_KEYWORDS}
            className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Lisää
          </button>
        </div>

        {keywords.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  aria-label={`Poista ${keyword}`}
                  className="text-gray-500 hover:text-gray-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          {keywords.length}/{MAX_KEYWORDS} avainsanaa
        </p>
      </div>

      <div className="mt-8 border-t pt-6">
        <h4 className="text-base font-bold text-gray-900">
          Sähköpostihälytykset
        </h4>

        <label className="mt-3 flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={opportunityAlerts}
            onChange={(event) => onAlertsChange(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-gray-700">
            <span className="font-semibold text-gray-900">
              Ilmoita kun hanke etenee sinulle otolliseen vaiheeseen.
            </span>{" "}
            Saat sähköpostin kun kiinnostavan alueesi hanke saavuttaa juuri
            roolillesi osuvimman vaiheen (esim. materiaalitoimittaja, kun
            rakentaminen alkaa). Edellyttää valittua yritysprofiilia.
          </span>
        </label>
      </div>
    </div>
  )
}
