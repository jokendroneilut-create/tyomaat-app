'use client'

import Lataus from "@/app/components/Lataus"
import dynamic from 'next/dynamic'
import type { MapBounds } from './Map'
import type React from 'react'

export type ZoomTarget = { lat: number; lng: number } | null

export type MapClientProps = {
  projects: any[]
  onBoundsChange?: (b: MapBounds) => void
  zoomTo?: ZoomTarget
  currentUserId?: string | null
  teamModeEnabled?: boolean
}

const DynamicMap = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => <Lataus teksti="Ladataan karttaa…" leveys={140} />,
}) as React.ComponentType<MapClientProps>

export default function MapClient(props: MapClientProps) {
  return <DynamicMap {...props} />
}