'use client'

import dynamic from 'next/dynamic'
import type { MapBounds } from './Map'
import type React from 'react'

export type ZoomTarget = { lat: number; lng: number } | null

export type MapClientProps = {
  projects: any[]
  onBoundsChange?: (b: MapBounds) => void
  zoomTo?: ZoomTarget
}

const DynamicMap = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => <p style={{ padding: 12 }}>Ladataan karttaa…</p>,
}) as React.ComponentType<MapClientProps>

export default function MapClient(props: MapClientProps) {
  return <DynamicMap {...props} />
}