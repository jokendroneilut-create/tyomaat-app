'use client'
import dynamic from 'next/dynamic'
const MapClient = dynamic(() => import('./Map'), { ssr: false })
export default MapClient