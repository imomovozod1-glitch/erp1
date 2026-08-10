'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, MapPin, Loader2, Navigation } from 'lucide-react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const DEFAULT_CENTER: [number, number] = [41.2995, 69.2401] // Tashkent

const pinIcon = L.divIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 shadow-lg border-2 border-white transform transition-transform duration-200 hover:scale-110">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

interface MapPickerProps {
  onLocationSelect: (address: string, lat: number, lng: number) => void
  initialAddress?: string
  /** Precise saved coordinates — when present, the map centers exactly here instead of the default city view. */
  initialLat?: number | null
  initialLng?: number | null
}

/** Bridges imperative Leaflet map events (click, programmatic pan) into the parent's React state. */
function MapController({
  onMove,
  onMapClick,
}: {
  onMove: (map: L.Map) => void
  onMapClick: (lat: number, lng: number) => void
}) {
  const map = useMap()

  useEffect(() => {
    onMove(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })

  return null
}

export function MapPicker({ onLocationSelect, initialAddress, initialLat, initialLng }: MapPickerProps) {
  const t = useTranslations('sales.locationPicker')
  const mapRef = useRef<L.Map | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const hasInitialCoords = typeof initialLat === 'number' && typeof initialLng === 'number'
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(
    hasInitialCoords ? { lat: initialLat as number, lng: initialLng as number } : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }
  )
  const [resolvedAddress, setResolvedAddress] = useState(initialAddress || '')

  // Reverse geocoding (coordinates to address)
  const reverseGeocode = async (lat: number, lng: number) => {
    setIsResolving(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      )
      const data = await response.json()
      if (data && data.display_name) {
        setResolvedAddress(data.display_name)
        onLocationSelect(data.display_name, lat, lng)
      }
    } catch (err) {
      console.error('Reverse geocoding failed', err)
    } finally {
      setIsResolving(false)
    }
  }

  // Resolve an address label for the initial saved coordinates once, on mount
  useEffect(() => {
    if (!hasInitialCoords || initialAddress) return
    const timer = setTimeout(() => {
      reverseGeocode(initialLat as number, initialLng as number)
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMapClick = (lat: number, lng: number) => {
    setCoords({ lat, lng })
    reverseGeocode(lat, lng)
  }

  const handleMarkerDragEnd = (e: L.DragEndEvent) => {
    const latLng = (e.target as L.Marker).getLatLng()
    setCoords({ lat: latLng.lat, lng: latLng.lng })
    reverseGeocode(latLng.lat, latLng.lng)
  }

  // Geocode address search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      )
      const data = await response.json()
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0]
        const latitude = parseFloat(lat)
        const longitude = parseFloat(lon)

        mapRef.current?.setView([latitude, longitude], 15)
        setCoords({ lat: latitude, lng: longitude })
        setResolvedAddress(display_name)
        onLocationSelect(display_name, latitude, longitude)
      } else {
        alert(t('notFound'))
      }
    } catch (err) {
      console.error('Geocoding failed', err)
    } finally {
      setIsSearching(false)
    }
  }

  // Locate current position
  const handleLocateMe = () => {
    if (navigator.geolocation) {
      setIsResolving(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          mapRef.current?.setView([latitude, longitude], 16)
          setCoords({ lat: latitude, lng: longitude })
          reverseGeocode(latitude, longitude)
        },
        (error) => {
          console.error('Geolocation failed', error)
          setIsResolving(false)
          alert(t('geoError'))
        },
        { enableHighAccuracy: true }
      )
    } else {
      alert(t('geoUnsupported'))
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Locate row */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9 h-10 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all focus:bg-white"
          />
        </div>
        <Button
          type="submit"
          disabled={isSearching}
          className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-1.5"
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t('search')}
        </Button>
        <Button
          type="button"
          onClick={handleLocateMe}
          variant="outline"
          className="h-10 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center shadow-xs"
          title={t('locateMe')}
        >
          <Navigation className="h-4 w-4 text-slate-600" />
        </Button>
      </form>

      {/* Map display */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200/80 shadow-sm bg-slate-100">
        <MapContainer
          center={[coords.lat, coords.lng]}
          zoom={hasInitialCoords ? 15 : 13}
          zoomControl
          attributionControl={false}
          className="w-full h-70"
          style={{ zIndex: 1 }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          />
          <Marker
            position={[coords.lat, coords.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{ dragend: handleMarkerDragEnd }}
          />
          <MapController onMove={(map) => { mapRef.current = map }} onMapClick={handleMapClick} />
        </MapContainer>
      </div>

      {/* Geolocation info display */}
      <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <MapPin className="h-3.5 w-3.5 text-indigo-500" />
          {t('selectedLocation')}
        </div>
        {isResolving ? (
          <div className="flex items-center gap-2 py-1 text-slate-600 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            <span>{t('resolvingAddress')}</span>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-slate-700 font-medium text-xs leading-relaxed line-clamp-2">
              {resolvedAddress || t('noAddress')}
            </p>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
              <span>LAT: {coords.lat.toFixed(6)}</span>
              <span>LNG: {coords.lng.toFixed(6)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
