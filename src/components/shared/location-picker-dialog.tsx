'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Leaflet touches `window` at import time, so the picker only loads in the browser.
const MapPicker = dynamic(() => import('@/components/sales/map-picker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 w-full items-center justify-center rounded-xl border border-dashed bg-muted/40">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

export interface PickedLocation {
  address: string
  latitude: number | null
  longitude: number | null
}

interface LocationPickerDialogProps {
  initial: PickedLocation
  onConfirm: (location: PickedLocation) => void
  onClose: () => void
}

/** Rendered only while open, so each opening starts from `initial`. */
export function LocationPickerDialog({ initial, onConfirm, onClose }: LocationPickerDialogProps) {
  const t = useTranslations()
  const [picked, setPicked] = useState(initial)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-6 sm:max-w-2xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <MapPin className="size-5 text-violet-600 dark:text-violet-400" />
            {t('sales.locationPicker.dialogTitle')}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">{t('sales.locationPicker.dialogSubtitle')}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <MapPicker
            onLocationSelect={(address, latitude, longitude) => setPicked({ address, latitude, longitude })}
            initialAddress={picked.address}
            initialLat={picked.latitude}
            initialLng={picked.longitude}
          />
        </div>
        <DialogFooter className="-mx-6 -mb-6 rounded-b-xl px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => onConfirm(picked)}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const isPinned = (location: Pick<PickedLocation, 'latitude' | 'longitude'>) =>
  typeof location.latitude === 'number' && typeof location.longitude === 'number'
