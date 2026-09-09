'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Phone, ArrowRight, Navigation, LocateFixed } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const DEFAULT_CENTER: [number, number] = [41.2995, 69.2401] // Tashkent

const pinIcon = L.divIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-violet-600 shadow-lg border-2 border-white">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

/** Deliberately a different shape and colour from the customer pins — the
 *  user's own position has to be tellable apart at a glance. */
const meIcon = L.divIcon({
  html: `<div class="relative flex items-center justify-center w-5 h-5">
           <span class="absolute inline-flex w-5 h-5 rounded-full bg-sky-500/30"></span>
           <span class="relative inline-flex w-3.5 h-3.5 rounded-full bg-sky-600 border-2 border-white shadow"></span>
         </div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

interface MappableCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  assigned_to?: string | null
  total_debt?: number
}

/** Pans/zooms the map to fit every pin once, on mount — MapContainer's own
 * center/zoom props are uncontrolled after the first render (a well-known
 * react-leaflet limitation), so fitting bounds has to happen imperatively. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

/** Hands the Leaflet instance to the parent so the "locate me" button can pan.
 *  The assignment happens in an effect, not during render — same bridge pattern
 *  `MapController` in map-picker.tsx uses. */
function MapRefBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

export function AllCustomersMapInner({
  customers,
  currentUserId,
  lang,
}: {
  customers: MappableCustomer[]
  currentUserId: string | null
  lang: string
}) {
  const t = useTranslations('sales')
  const tPicker = useTranslations('sales.locationPicker')
  const tCommon = useTranslations('common')

  const mapRef = useRef<L.Map | null>(null)
  const [myPosition, setMyPosition] = useState<[number, number] | null>(null)
  const [geoError, setGeoError] = useState(false)
  // This component is only ever rendered client-side (`ssr: false` in
  // all-customers-map.tsx), so `navigator` is always there to read.
  const geoSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  // Salespeople care about their own round first, so the map opens on the
  // customers they are responsible for; "all" is still one click away for
  // whoever the data scope lets see more than their own. Without a known user
  // there is no "mine" to show, so that case starts on the full set.
  const [onlyMine, setOnlyMine] = useState(currentUserId !== null)

  const mine = useMemo(
    () => (currentUserId ? customers.filter((c) => c.assigned_to === currentUserId) : []),
    [customers, currentUserId]
  )
  const visible = onlyMine ? mine : customers

  const located = useMemo(
    () => visible.filter((c) => typeof c.latitude === 'number' && typeof c.longitude === 'number'),
    [visible]
  )
  const points = useMemo<[number, number][]>(
    () => located.map((c) => [c.latitude as number, c.longitude as number]),
    [located]
  )
  const missingCount = visible.length - located.length

  // Ask for the position once the map is on screen. The state is set from the
  // browser's async callback, never synchronously inside the effect, so this
  // stays clear of `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (!geoSupported) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return
        setMyPosition([position.coords.latitude, position.coords.longitude])
        setGeoError(false)
      },
      () => {
        if (!cancelled) setGeoError(true)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
    return () => {
      cancelled = true
    }
  }, [geoSupported])

  const handleLocateMe = () => {
    if (myPosition) {
      mapRef.current?.setView(myPosition, 15)
      return
    }
    if (!geoSupported) {
      setGeoError(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: [number, number] = [position.coords.latitude, position.coords.longitude]
        setMyPosition(next)
        setGeoError(false)
        mapRef.current?.setView(next, 15)
      },
      () => setGeoError(true),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
      active
        ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
    }`

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border shadow-inner">
              <button
                type="button"
                onClick={() => setOnlyMine(true)}
                disabled={currentUserId === null}
                className={tabClass(onlyMine)}
              >
                {t('customersMapMine')} ({mine.length})
              </button>
              <button type="button" onClick={() => setOnlyMine(false)} className={tabClass(!onlyMine)}>
                {t('customersMapAll')} ({customers.length})
              </button>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('customersMapCount', { shown: located.length, total: visible.length })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {missingCount > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 px-2.5 py-1 rounded-full">
                {t('customersMapMissing', { count: missingCount })}
              </span>
            )}
            <button
              type="button"
              onClick={handleLocateMe}
              title={tPicker('locateMe')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {myPosition ? (
                <LocateFixed className="h-3.5 w-3.5 text-sky-600" />
              ) : (
                <Navigation className="h-3.5 w-3.5 text-slate-500" />
              )}
              {tPicker('locateMe')}
            </button>
          </div>
        </div>

        {(geoError || !geoSupported) && (
          <p className="border-b bg-amber-50/60 dark:bg-amber-950/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            {geoSupported ? tPicker('geoError') : tPicker('geoUnsupported')}
          </p>
        )}

        {located.length === 0 && !myPosition ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-400 dark:text-slate-500">
            <MapPin className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('customersMapEmpty')}</p>
          </div>
        ) : (
          <div className="relative">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={11}
              zoomControl
              attributionControl={false}
              className="w-full h-140"
              style={{ zIndex: 1 }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
              />
              <MapRefBridge onReady={(map) => { mapRef.current = map }} />
              <FitBounds points={points} />
              {myPosition && (
                <Marker position={myPosition} icon={meIcon}>
                  <Popup>
                    <p className="text-sm font-semibold text-slate-800">{t('customersMapYouAreHere')}</p>
                  </Popup>
                </Marker>
              )}
              {located.map((customer) => (
                <Marker
                  key={customer.id}
                  position={[customer.latitude as number, customer.longitude as number]}
                  icon={pinIcon}
                >
                  <Popup>
                    <div className="space-y-1.5 min-w-48">
                      <p className="font-semibold text-slate-800 text-sm">{customer.name}</p>
                      {customer.address && <p className="text-xs text-slate-500">{customer.address}</p>}
                      {customer.phone && (
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="h-3 w-3" /> {customer.phone}
                        </p>
                      )}
                      {!!customer.total_debt && customer.total_debt > 0 && (
                        <p className="text-xs font-semibold text-rose-600">
                          {t('debt')}: {formatCurrency(customer.total_debt)}
                        </p>
                      )}
                      <Link
                        href={`/${lang}/customers/${customer.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 pt-1"
                      >
                        {tCommon('details')} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
