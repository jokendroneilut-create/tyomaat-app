"use client"

import type { CSSProperties, ReactNode } from "react"
import { openFeedback, type FeedbackContextDetail } from "./FeedbackModal"

/*
 * Palautenappi joka avaa sovelluksen sisäisen palauteluukun (FeedbackModal).
 * Korvaa aiemman mailto:info@tyomaat.fi-linkin. Ottaa vastaan kontekstin
 * (esim. "Tänään-näkymän palaute") ja valinnaisen hankkeen tiedot.
 */

type Props = FeedbackContextDetail & {
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export default function FeedbackButton({
  context,
  projectId,
  projectName,
  className,
  style,
  children,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => openFeedback({ context, projectId, projectName })}
      className={className}
      style={style}
    >
      {children ?? "Anna palautetta"}
    </button>
  )
}
