'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Card, CardContent } from '@/components/ui/card'
import { useTileConfig } from '@/lib/map-tiles'
import { toLeafletPath } from '@/lib/route-plan'
import { formatCurrency } from '@/lib/utils'
import { CustomersMapToolbar, RoundSummary } from './customers-map-toolbar'
import { FitBounds, MapRefBridge } from './map-bridges'
import { customerPin, DEFAULT_CENTER, isLocated, myPositionPin, numberedPin, pointOf, type MappableCustomer } from './map-pins'
import { useGeolocation } from './use-geolocation'
import { useRoundPlan } from './use-round-plan'

interface AllCustomersMapInnerProps {
  customers: MappableCustomer[]
  currentUserId: string | null
  lang: string
}

export function AllCustomersMapInner({ customers, currentUserId, lang }: AllCustomersMapInnerProps) {
  const t = useTranslations()
  const tiles = useTileConfig()
  const mapRef = useRef<L.Map | null>(null)
  const geo = useGeolocation()
  const planner = useRoundPlan()
  const [onlyMine, setOnlyMine] = useState(currentUserId !== null)

  const mine = currentUserId ? customers.filter((c) => c.assigned_to === currentUserId) : []
  const visible = onlyMine ? mine : customers
  const located = visible.filter(isLocated)
  const pinned = planner.plan?.stops ?? located
  const routePath = planner.plan ? toLeafletPath(planner.plan.geometry) : []

  const changeScope = (next: boolean) => {
    planner.clear()
    setOnlyMine(next)
  }

  return (
    <Card className="border-0 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardContent className="p-0">
        <CustomersMapToolbar
          onlyMine={onlyMine}
          onScopeChange={changeScope}
          canFilterMine={currentUserId !== null}
          mineCount={mine.length}
          allCount={customers.length}
          shown={located.length}
          visible={visible.length}
          located={!!geo.position}
          onLocate={() => geo.locate((point) => mapRef.current?.setView(point, 15))}
          planner={planner}
          onPlan={() => planner.run(located, geo.position)}
          stopCount={located.length}
        />
        {planner.plan && <RoundSummary plan={planner.plan} />}
        {(geo.failed || !geo.supported) && (
          <p className="border-b bg-amber-50/60 px-4 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            {t(geo.supported ? 'sales.locationPicker.geoError' : 'sales.locationPicker.geoUnsupported')}
          </p>
        )}
        {!located.length && !geo.position ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
            <MapPin className="size-8 opacity-40" />
            <p className="text-sm">{t('sales.customersMapEmpty')}</p>
          </div>
        ) : (
          <MapContainer center={DEFAULT_CENTER} zoom={11} zoomControl attributionControl={false} className="h-140 w-full" style={{ zIndex: 1 }}>
            <TileLayer url={tiles.url} className={tiles.className} attribution={tiles.attribution} maxZoom={tiles.maxZoom} />
            <MapRefBridge onReady={(map) => (mapRef.current = map)} />
            <FitBounds points={located.map(pointOf)} />
            {geo.position && (
              <Marker position={geo.position} icon={myPositionPin}>
                <Popup>
                  <p className="text-sm font-semibold text-slate-800">{t('sales.customersMapYouAreHere')}</p>
                </Popup>
              </Marker>
            )}
            {routePath.length > 0 && (
              <>
                <Polyline positions={routePath} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.55 }} />
                <Polyline positions={routePath} pathOptions={{ color: '#7c3aed', weight: 4, opacity: 0.95 }} />
              </>
            )}
            {pinned.map((customer, index) => (
              <CustomerMarker key={customer.id} customer={customer} order={planner.plan ? index + 1 : null} lang={lang} />
            ))}
          </MapContainer>
        )}
      </CardContent>
    </Card>
  )
}

function CustomerMarker({ customer, order, lang }: { customer: MappableCustomer; order: number | null; lang: string }) {
  const t = useTranslations()
  return (
    <Marker position={pointOf(customer)} icon={order ? numberedPin(order) : customerPin}>
      <Popup>
        <div className="min-w-48 space-y-1.5">
          <p className="text-sm font-semibold text-slate-800">{order ? `${order}. ${customer.name}` : customer.name}</p>
          {customer.address && <p className="text-xs text-slate-500">{customer.address}</p>}
          {customer.phone && (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <Phone className="size-3" /> {customer.phone}
            </p>
          )}
          {!!customer.total_debt && customer.total_debt > 0 && (
            <p className="text-xs font-semibold text-rose-600">
              {t('sales.debt')}: {formatCurrency(customer.total_debt)}
            </p>
          )}
          <Link href={`/${lang}/customers/${customer.id}`} className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-violet-600 hover:text-violet-800">
            {t('common.details')} <ArrowRight className="size-3" />
          </Link>
        </div>
      </Popup>
    </Marker>
  )
}
