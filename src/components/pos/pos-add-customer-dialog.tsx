'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { MapPin } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { isValidPhone } from '@/lib/phone-validation'

// react-leaflet touches `window` at module-evaluation time, so the picker can
// only be loaded once this Client Component is running in the browser.
const MapPicker = dynamic(() => import('@/components/sales/map-picker').then((m) => m.MapPicker), {
  ssr: false,
})

/**
 * "New customer" straight from the till.
 *
 * Owns the whole form — six fields, the map picker and the insert — because
 * none of it outlives the dialog. `pos-client.tsx` was holding those six
 * `useState`s among its own, where they read as part of the till's state even
 * though the till only ever needs the finished customer, which arrives through
 * `onCreated`.
 */
export function PosAddCustomerDialog({
  open,
  onOpenChange,
  onCreated,
  lang,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The saved row, so the caller can add it to its list and select it. */
  onCreated: (customer: any) => void
  lang: string
}) {
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const t = useTranslations('pos')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const reset = () => {
    setName('')
    setPhone('')
    setAddress('')
    setLat(null)
    setLng(null)
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (phone.trim() && !isValidPhone(phone)) {
      toast.error(tAuth('invalidPhone'))
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient() as any
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          latitude: lat,
          longitude: lng,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success(tCommon('success'))
      onCreated(data)
      onOpenChange(false)
      reset()
      await invalidateCustomers()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border-0 shadow-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t('quickAddCustomer')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="custName">{t('customerName')} *</Label>
              <Input
                id="custName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sherzod Karimov"
                required
                className="border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custPhone">{t('customerPhone')}</Label>
              <PhoneInput
                id="custPhone"
                value={phone}
                onChange={setPhone}
                inputClassName="border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custAddress" className="flex items-center gap-1.5">
                {t('customerAddress')}
                {typeof lat === 'number' && typeof lng === 'number' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full">
                    <MapPin className="h-2.5 w-2.5" />
                    {lang === 'uz'
                      ? 'Xaritada belgilangan'
                      : lang === 'ru'
                        ? 'Отмечено на карте'
                        : 'Pinned'}
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="custAddress"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Toshkent sh., Chilonzor t."
                  className="border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMapOpen(true)}
                  className="h-9 w-9 p-0 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg shrink-0"
                  title={
                    lang === 'uz'
                      ? 'Xaritadan belgilash'
                      : lang === 'ru'
                        ? 'Отметить на карте'
                        : 'Pick on map'
                  }
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
              >
                {isSaving ? tCommon('saving') : tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isMapOpen && (
        <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
          <DialogContent className="max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border-0 shadow-xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                {lang === 'uz'
                  ? 'Manzilni xaritadan belgilang'
                  : lang === 'ru'
                    ? 'Отметьте адрес на карте'
                    : 'Pick address on map'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <MapPicker
                onLocationSelect={(address: string, latitude: number, longitude: number) => {
                  setAddress(address)
                  setLat(latitude)
                  setLng(longitude)
                }}
                initialAddress={address}
                initialLat={lat}
                initialLng={lng}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={() => setIsMapOpen(false)}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
              >
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
