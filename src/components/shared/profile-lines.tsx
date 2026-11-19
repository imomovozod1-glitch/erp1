'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Leaflet touches `window` at import time, so the map only loads in the browser.
const LocationPreviewMap = dynamic(() => import('@/components/shared/location-preview-map').then((m) => m.LocationPreviewMap), {
  ssr: false,
})

export function ProfileCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="self-start border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">{children}</CardContent>
    </Card>
  )
}

export function ProfileLine({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <div className="font-medium break-words text-foreground">{children}</div>
      </div>
    </div>
  )
}

interface Located {
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

export const hasLocation = (row: Located) => !!row.address || (typeof row.latitude === 'number' && typeof row.longitude === 'number')

export function LocationLine({ row, label, openLabel, onOpen }: { row: Located; label: string; openLabel: string; onOpen: () => void }) {
  if (!hasLocation(row)) return null
  return (
    <ProfileLine icon={MapPin} label={label}>
      <div className="space-y-2">
        <span>{row.address || '—'}</span>
        <LocationPreviewMap address={row.address} latitude={row.latitude} longitude={row.longitude} onClick={onOpen} />
        <button type="button" onClick={onOpen} className="block py-2 text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400">
          {openLabel}
        </button>
      </div>
    </ProfileLine>
  )
}
