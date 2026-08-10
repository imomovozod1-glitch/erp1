'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MapPin, Loader2 } from 'lucide-react'

// Load MapPicker dynamically for Next.js SSR compatibility
const MapPicker = dynamic(() => import('@/components/sales/map-picker').then(mod => mod.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="w-full h-70 bg-slate-50 border border-dashed rounded-xl flex flex-col items-center justify-center space-y-2">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )
})

export function CompanyForm() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tSales = useTranslations('sales')
  const [isMounted, setIsMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [tempAddress, setTempAddress] = useState('')
  const [tempLat, setTempLat] = useState<number | null>(null)
  const [tempLng, setTempLng] = useState<number | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
  }, [])

  const companySchema = z.object({
    name: z.string().min(1, tCommon('required')),
    email: z.string().email(t('companyEmail') || 'Invalid email').or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  })

  type FormData = z.infer<typeof companySchema>

  const emptySettings: FormData = { name: '', email: '', phone: '', address: '', latitude: null, longitude: null }

  // Load initial values from localStorage (safe on client after mounting)
  const getSavedSettings = (): FormData => {
    if (typeof window === 'undefined') return emptySettings
    try {
      const saved = localStorage.getItem('company_settings')
      if (saved) {
        return { ...emptySettings, ...JSON.parse(saved) }
      }
    } catch (e) {
      console.error(e)
    }
    return emptySettings
  }

  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(companySchema),
    values: isMounted ? getSavedSettings() : undefined, // only load values once mounted on client
  })

  const hasPreciseLocation = typeof getValues('latitude') === 'number' && typeof getValues('longitude') === 'number'

  const handleOpenMap = () => {
    setTempAddress(getValues('address') || '')
    setTempLat(getValues('latitude') ?? null)
    setTempLng(getValues('longitude') ?? null)
    setIsMapOpen(true)
  }

  const handleConfirmLocation = () => {
    setValue('address', tempAddress, { shouldDirty: true })
    setValue('latitude', tempLat, { shouldDirty: true })
    setValue('longitude', tempLng, { shouldDirty: true })
    setIsMapOpen(false)
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 600))
      localStorage.setItem('company_settings', JSON.stringify(data))
      toast.success(tCommon('success'))
    } catch {
      toast.error(tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isMounted) {
    return (
      <Card className="max-w-2xl border-slate-200/60 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card className="max-w-2xl border-slate-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-800">{t('company')}</CardTitle>
        <CardDescription>{t('company') || 'Configure your company details'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t('companyName')} *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g. Acme Corp"
              className="border-slate-200 focus-visible:ring-indigo-500"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t('companyEmail')}</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="info@company.com"
                className="border-slate-200 focus-visible:ring-indigo-500"
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('companyPhone')}</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+998901234567"
                className="border-slate-200 focus-visible:ring-indigo-500"
              />
              {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-1.5">
              {t('companyAddress')}
              {hasPreciseLocation && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full normal-case">
                  <MapPin className="h-2.5 w-2.5" />
                  {tSales('locationPicker.selectedLocation')}
                </span>
              )}
            </Label>
            <div className="flex gap-2">
              <Textarea
                id="address"
                {...register('address')}
                placeholder="123 Main St, City"
                rows={3}
                className="border-slate-200 focus-visible:ring-indigo-500 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenMap}
                className="h-10 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg shrink-0 self-start"
                title={tSales('locationPicker.button')}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
            {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors px-6 shadow-sm"
            >
              {isSubmitting ? tCommon('loading') : tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    {isMapOpen && (
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent className="sm:max-w-2xl bg-white p-6 rounded-xl border border-slate-200 shadow-lg">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="font-bold text-slate-800 text-base flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              {tSales('locationPicker.dialogTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <MapPicker
              onLocationSelect={(address, lat, lng) => {
                setTempAddress(address)
                setTempLat(lat)
                setTempLng(lng)
              }}
              initialAddress={tempAddress || getValues('address')}
              initialLat={tempLat}
              initialLng={tempLng}
            />
          </div>
          <DialogFooter className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMapOpen(false)}
              className="h-10 px-4 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmLocation}
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
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
