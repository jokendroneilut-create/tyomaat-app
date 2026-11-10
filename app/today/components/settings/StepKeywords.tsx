"use client"

import { useState } from "react"

type StepKeywordsProps = {
  keywords: string[]
  onChange: (keywords: string[]) => void
  keywordsOnly: boolean
  onKeywordsOnlyChange: (enabled: boolean) => void
}

const MAX_KEYWORDS = 30

export default function StepKeywords({
  keywords,
  onChange,
  keywordsOnly,
  onKeywordsOnlyChange,
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
        Sanoja omalta erikoisalaltasi, esim. sähköurakoitsija:{" "}
        <em>sähkö, valaistus</em>. Hankkeet joissa ne mainitaan nousevat
        listasi kärkeen.
      </p>

      <div className="mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kirjoita avainsana ja paina Enter"
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
          <div className="mt-3 flex flex-wrap gap-1.5">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800"
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

        <p className="mt-2 text-xs text-gray-400">
          {keywords.length}/{MAX_KEYWORDS} avainsanaa
        </p>

        {/*
          Rasti näkyy vasta kun sanoja on: tyhjällä listalla se ei tee
          mitään, ja tyhjä valinta näyttäisi lupaavan rajauksen jota ei ole.
        */}
        {keywords.length > 0 && (
          <label className="mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              checked={keywordsOnly}
              onChange={(event) => onKeywordsOnlyChange(event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-gray-700">
              <span className="font-semibold text-gray-900">
                Näytä vain nämä hankkeet.
              </span>{" "}
              Muut piilotetaan listalta kokonaan.
            </span>
          </label>
        )}
      </div>

    </div>
  )
}
