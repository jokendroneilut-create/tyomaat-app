"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

/*
 * Sovelluksen sisäinen palauteluukku. Yksi instanssi mountataan layoutissa,
 * ja se aukeaa `open-feedback`-ikkunatapahtumalla. Palautenapit (FeedbackButton
 * ja kartan popup-nappi) laukaisevat tapahtuman kontekstitiedoilla.
 *
 * Tapahtuman detail: { context?, projectId?, projectName? }
 */

export type FeedbackContextDetail = {
  context?: string
  projectId?: string | null
  projectName?: string | null
}

export const FEEDBACK_EVENT = "open-feedback"

export function openFeedback(detail: FeedbackContextDetail = {}) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, { detail }))
}

type Status = "idle" | "sending" | "done" | "error"

export default function FeedbackModal() {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<FeedbackContextDetail>({})
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    function handleOpen(e: Event) {
      const d = (e as CustomEvent<FeedbackContextDetail>).detail ?? {}
      setDetail(d)
      setMessage("")
      setStatus("idle")
      setError(null)
      setOpen(true)
    }

    window.addEventListener(FEEDBACK_EVENT, handleOpen as EventListener)
    return () =>
      window.removeEventListener(FEEDBACK_EVENT, handleOpen as EventListener)
  }, [])

  useEffect(() => {
    if (open) {
      // Kohdista tekstikenttään kun modaali aukeaa.
      const t = setTimeout(() => textareaRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  function close() {
    if (status === "sending") return
    setOpen(false)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    if (open) window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status])

  async function submit() {
    const trimmed = message.trim()
    if (!trimmed) {
      setError("Kirjoita palaute ennen lähettämistä.")
      return
    }

    setStatus("sending")
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id ?? null,
          context: detail.context ?? "",
          projectId: detail.projectId ?? null,
          projectName: detail.projectName ?? null,
          message: trimmed,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Palautteen lähetys epäonnistui.")
      }

      setStatus("done")
    } catch (err: any) {
      setStatus("error")
      setError(err?.message ?? "Palautteen lähetys epäonnistui.")
    }
  }

  if (!open) return null

  const title = detail.projectName
    ? `Palaute kohteesta: ${detail.projectName}`
    : detail.context || "Anna palautetta"

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <h2
              id="feedback-modal-title"
              className="text-xl font-bold text-gray-900"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Kirjoita palautteesi — luemme jokaisen viestin.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={status === "sending"}
            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Sulje
          </button>
        </div>

        <div className="px-6 py-5">
          {status === "done" ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Kiitos palautteesta! Viesti on vastaanotettu.
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Kerro mikä toimii, mikä ei, tai mitä toivoisit..."
                disabled={status === "sending"}
                className="w-full resize-y rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-gray-500 focus:outline-none disabled:opacity-60"
              />

              {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t bg-white px-6 py-4">
          {status === "done" ? (
            <button
              type="button"
              onClick={close}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white"
            >
              Valmis
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={close}
                disabled={status === "sending"}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Peruuta
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={status === "sending"}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {status === "sending" ? "Lähetetään..." : "Lähetä palaute"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
