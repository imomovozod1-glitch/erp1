'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LabeledField } from '@/components/shared/labeled-field'
import { isPinned, LocationPickerDialog, type PickedLocation } from '@/components/shared/location-picker-dialog'

interface AddressValues {
  address?: string
  latitude?: number | null
  longitude?: number | null
}

interface AddressFieldProps {
  form: UseFormReturn<any>
  label: string
  placeholder?: string
  className?: string
}

/** The address input, its "pick on map" button and dialog, bound to `address` / `latitude` / `longitude`. */
export function AddressField({ form, label, placeholder, className }: AddressFieldProps) {
  const t = useTranslations('sales')
  const [open, setOpen] = useState(false)
  const current = (): PickedLocation => {
    const values = form.getValues() as AddressValues
    return { address: values.address ?? '', latitude: values.latitude ?? null, longitude: values.longitude ?? null }
  }
  const [pinned, setPinned] = useState(() => isPinned(current()))

  const confirm = (location: PickedLocation) => {
    form.setValue('address', location.address, { shouldDirty: true, shouldValidate: true })
    form.setValue('latitude', location.latitude, { shouldDirty: true })
    form.setValue('longitude', location.longitude, { shouldDirty: true })
    setPinned(isPinned(location))
    setOpen(false)
  }

  const badge = pinned && (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
      <MapPin className="size-2.5" />
      {t('pinnedOnMap')}
    </span>
  )

  return (
    <LabeledField id="address" label={label} icon={MapPin} badge={badge} className={className}>
      <div className="flex gap-2">
        <Input id="address" {...form.register('address')} placeholder={placeholder} className="flex-1" />
        <Button type="button" variant="outline" onClick={() => setOpen(true)} className="shrink-0 gap-1.5">
          <MapPin className="size-4" />
          {t('locationPicker.button')}
        </Button>
      </div>
      {open && <LocationPickerDialog initial={current()} onConfirm={confirm} onClose={() => setOpen(false)} />}
    </LabeledField>
  )
}
