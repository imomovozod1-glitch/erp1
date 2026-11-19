'use client'

import type { ReactNode } from 'react'
import { Landmark, Mail, MapPin, Phone, Tags, type LucideIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Leaflet touches `window` at import time, so the map only loads in the browser.
const LocationPreviewMap = dynamic(() => import('@/components/shared/location-preview-map').then((m) => m.LocationPreviewMap), {
  ssr: false,
})

function ProfileLine({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        {children}
      </div>
    </div>
  )
}

const hasCoordinates = (customer: any) => typeof customer.latitude === 'number' && typeof customer.longitude === 'number'

export function CustomerProfileCard({ customer, onOpenMap }: { customer: any; onOpenMap: () => void }) {
  const t = useTranslations()
  const value = 'font-medium text-foreground'
  return (
    <Card className="self-start border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-bold">{t('sales.customerDetail.profile')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {customer.customer_categories?.name && (
          <ProfileLine icon={Tags} label={t('sales.category')}>
            <span className={value}>{customer.customer_categories.name}</span>
          </ProfileLine>
        )}
        {customer.phone && (
          <ProfileLine icon={Phone} label={t('common.phone')}>
            <span className={value}>{customer.phone}</span>
          </ProfileLine>
        )}
        {customer.email && (
          <ProfileLine icon={Mail} label={t('common.email')}>
            <span className={`${value} break-all`}>{customer.email}</span>
          </ProfileLine>
        )}
        {customer.tin && (
          <ProfileLine icon={Landmark} label={t('sales.tin')}>
            <span className={value}>{customer.tin}</span>
          </ProfileLine>
        )}
        {(customer.address || hasCoordinates(customer)) && (
          <ProfileLine icon={MapPin} label={t('common.address')}>
            <div className="space-y-2">
              <span className={value}>{customer.address || '—'}</span>
              <LocationPreviewMap address={customer.address} latitude={customer.latitude} longitude={customer.longitude} onClick={onOpenMap} />
              <button type="button" onClick={onOpenMap} className="block py-2 text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
                {t('sales.customerDetail.viewLargerMap')}
              </button>
            </div>
          </ProfileLine>
        )}
        {customer.notes && (
          <div className="border-t pt-3">
            <span className="mb-1 block text-xs text-muted-foreground">{t('common.description')}</span>
            <p className="text-xs leading-relaxed text-muted-foreground">{customer.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
