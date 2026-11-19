'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'

/** Fits every pin once on mount — MapContainer's center/zoom props stop applying after the first render. */
export function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], 14)
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

/** Hands the Leaflet instance to the parent, from an effect rather than during render. */
export function MapRefBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}
