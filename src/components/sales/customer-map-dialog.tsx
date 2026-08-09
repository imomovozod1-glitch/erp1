'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, ExternalLink, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

declare global {
  interface Window {
    L: any
  }
}

function loadLeaflet(callback: () => void) {
  if (typeof window === 'undefined') return

  if (window.L) {
    callback()
    return
  }

  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }

  if (!document.getElementById('leaflet-js')) {
    const script = document.createElement('script')
    script.id = 'leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setTimeout(callback, 100)
    document.head.appendChild(script)
  } else {
    const checkL = setInterval(() => {
      if (window.L) {
        clearInterval(checkL)
        callback()
      }
    }, 100)
  }
}

interface CustomerMapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  customerName: string
  lang: string
}

export function CustomerMapDialog({ open, onOpenChange, address, customerName, lang }: CustomerMapDialogProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isResolving, setIsResolving] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!open) return
    setIsResolving(true)
    setNotFound(false)

    loadLeaflet(() => setIsLoaded(true))
  }, [open])

  useEffect(() => {
    if (!open || !isLoaded || !mapContainerRef.current || !address) return

    const L = window.L

    const init = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        )
        const data = await response.json()

        if (!data || data.length === 0) {
          setNotFound(true)
          setIsResolving(false)
          return
        }

        const { lat, lon } = data[0]
        const latitude = parseFloat(lat)
        const longitude = parseFloat(lon)

        if (mapRef.current) {
          mapRef.current.remove()
          mapRef.current = null
        }

        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: false,
        }).setView([latitude, longitude], 15)
        mapRef.current = map

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        }).addTo(map)

        const pinIcon = L.divIcon({
          html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 shadow-lg border-2 border-white">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                 </div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        })

        L.marker([latitude, longitude], { icon: pinIcon }).addTo(map)
        setIsResolving(false)
      } catch (err) {
        console.error('Geocoding failed', err)
        setNotFound(true)
        setIsResolving(false)
      }
    }

    init()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [open, isLoaded, address])

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white p-6 rounded-xl border border-slate-200 shadow-lg">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="font-bold text-slate-800 text-base flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            {customerName}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-sans mt-1">
            {address}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-slate-200/80 shadow-sm bg-slate-100">
            {(isResolving || !isLoaded) && !notFound && (
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
                  {lang === 'uz' ? "Manzil xaritada topilmadi" : lang === 'ru' ? 'Адрес не найден на карте' : 'Address could not be located on the map'}
                </span>
              </div>
            )}
            <div ref={mapContainerRef} className="w-full h-[320px]" style={{ zIndex: 1 }} />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(googleMapsUrl, '_blank')}
            className="w-full h-10 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="h-4 w-4" />
            {lang === 'uz' ? "Google Xaritada ochish" : lang === 'ru' ? 'Открыть в Google Картах' : 'Open in Google Maps'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
