'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pinIcon = L.divIcon({
  html: `<div class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 shadow-lg border-2 border-white">
           <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
         </div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
})

interface LocationPreviewMapProps {
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  onClick?: () => void
}

/**
 * Small, always-on, read-only map preview for a detail page's info card —
 * unlike LocationMapDialog (a full interactive dialog opened on demand),
 * this renders inline so the location is visible without an extra click.
 * Prefers saved coordinates; falls back to geocoding the address text for
 * records saved before coordinates were captured. Renders nothing while
 * there's no address/coordinates to show at all.
 */
export function LocationPreviewMap({ address, latitude, longitude, onClick }: LocationPreviewMapProps) {
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number'
  const [resolved, setResolved] = useState<{ lat: number; lng: number } | null>(
    hasCoords ? { lat: latitude, lng: longitude } : null
  )

  useEffect(() => {
    if (hasCoords || !address) return
    let cancelled = false
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.[0]) return
        setResolved({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [hasCoords, address, latitude, longitude])

  if (!resolved) return null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="block w-full rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700 disabled:cursor-default"
    >
      <MapContainer
        center={[resolved.lat, resolved.lng]}
        zoom={14}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
        className="w-full h-36 pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[resolved.lat, resolved.lng]} icon={pinIcon} />
      </MapContainer>
    </button>
  )
}
