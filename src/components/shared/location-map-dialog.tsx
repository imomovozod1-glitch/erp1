'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, ExternalLink, AlertCircle } from 'lucide-react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const pinIcon = L.divIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 shadow-lg border-2 border-white">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

interface LocationMapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  /** Precise saved coordinates. When present, the pin renders exactly here — no re-geocoding. */
  latitude?: number | null
  longitude?: number | null
  title: string
  lang: string
}

/**
 * Read-only "view on map" dialog, shared across customers/suppliers/any entity with a location.
 * Prefers the exact saved lat/lng; only falls back to text-address geocoding for legacy
 * records saved before coordinates were captured.
 */
export function LocationMapDialog({ open, onOpenChange, address, latitude, longitude, title, lang }: LocationMapDialogProps) {
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number'
  const [resolved, setResolved] = useState<{ lat: number; lng: number } | null>(hasCoords ? { lat: latitude, lng: longitude } : null)
  const [isResolving, setIsResolving] = useState(!hasCoords)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!open) return

    const timer = setTimeout(() => {
      setNotFound(false)

      if (hasCoords) {
        setResolved({ lat: latitude, lng: longitude })
        setIsResolving(false)
        return
      }

      if (!address) {
        setNotFound(true)
        setIsResolving(false)
        return
      }

      setIsResolving(true)
      setResolved(null)
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`)
        .then((r) => r.json())
        .then((data) => {
          if (!data || data.length === 0) {
            setNotFound(true)
            return
          }
          setResolved({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
        })
        .catch((err) => {
          console.error('Geocoding failed', err)
          setNotFound(true)
        })
        .finally(() => setIsResolving(false))
    }, 0)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address, hasCoords, latitude, longitude])

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white p-6 rounded-xl border border-slate-200 shadow-lg">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="font-bold text-slate-800 text-base flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-sans mt-1">
            {address}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-slate-200/80 shadow-sm bg-slate-100">
            {(isResolving) && !notFound && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 z-10 space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="text-xs font-semibold text-slate-600">
                  {lang === 'uz' ? 'Manzil aniqlanmoqda...' : lang === 'ru' ? 'Определение адреса...' : 'Locating address...'}
                </span>
              </div>
            )}
            {notFound && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/95 z-10 space-y-2 text-center px-6">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <span className="text-xs font-semibold text-slate-600">
                  {lang === 'uz' ? 'Manzil xaritada topilmadi' : lang === 'ru' ? 'Адрес не найден на карте' : 'Address could not be located on the map'}
                </span>
              </div>
            )}
            {resolved && (
              <MapContainer
                center={[resolved.lat, resolved.lng]}
                zoom={15}
                zoomControl
                attributionControl={false}
                className="w-full h-80"
                style={{ zIndex: 1 }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
                />
                <Marker position={[resolved.lat, resolved.lng]} icon={pinIcon} />
              </MapContainer>
            )}
            {!resolved && !isResolving && !notFound && <div className="w-full h-80" />}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(googleMapsUrl, '_blank')}
            className="w-full h-10 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="h-4 w-4" />
            {lang === 'uz' ? 'Google Xaritada ochish' : lang === 'ru' ? 'Открыть в Google Картах' : 'Open in Google Maps'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
