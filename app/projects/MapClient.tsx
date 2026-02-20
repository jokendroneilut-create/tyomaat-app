'use client'

import dynamic from 'next/dynamic'

const MapClient = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => <p style={{ padding: 12 }}>Ladataan karttaa…</p>,
})

export default MapClient