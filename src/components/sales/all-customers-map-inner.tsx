'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Phone, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const DEFAULT_CENTER: [number, number] = [41.2995, 69.2401] // Tashkent

const pinIcon = L.divIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 shadow-lg border-2 border-white">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

interface MappableCustomer {
  id: string
  name: string
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
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

export function AllCustomersMapInner({ customers, lang }: { customers: MappableCustomer[]; lang: string }) {
  const t = useTranslations('sales')
  const tCommon = useTranslations('common')

  const located = useMemo(
    () => customers.filter((c) => typeof c.latitude === 'number' && typeof c.longitude === 'number'),
    [customers]
  )
  const points = useMemo<[number, number][]>(
    () => located.map((c) => [c.latitude as number, c.longitude as number]),
    [located]
  )
  const missingCount = customers.length - located.length

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <span className="text-sm text-slate-500">
            {t('customersMapCount', { shown: located.length, total: customers.length })}
          </span>
          {missingCount > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
              {t('customersMapMissing', { count: missingCount })}
            </span>
          )}
        </div>

        {located.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-400">
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
              <FitBounds points={points} />
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
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 pt-1"
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
