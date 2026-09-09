'use client'

import { useState } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { Resolver, Controller } from 'react-hook-form'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import dynamic from 'next/dynamic'
import { User, Mail, Phone, MapPin, FileText, CreditCard, Loader2, Tags } from 'lucide-react'
import { PhoneInput } from '@/components/ui/phone-input'
import { optionalPhoneSchema } from '@/lib/phone-validation'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'

// Load MapPicker dynamically for Next.js SSR compatibility
const MapPicker = dynamic(() => import('./map-picker').then(mod => mod.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] bg-slate-50 dark:bg-slate-800 border border-dashed rounded-xl flex flex-col items-center justify-center space-y-2">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )
})

interface CustomerFormProps {
  /** Active tenant members who can be made responsible for this record. */
  assignableUsers: AssignableUser[]
  initialData?: any
  categories?: { id: string; name: string }[]
  lang: string
}

export function CustomerForm({ initialData, categories = [], lang, assignableUsers }: CustomerFormProps) {
  const tCommon = useTranslations('common')
  const tSales = useTranslations('sales')
  const tAuth = useTranslations('auth')
  const exitForm = useRouteModalExit(`/${lang}/customers`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [tempAddress, setTempAddress] = useState('')
  const [tempLat, setTempLat] = useState<number | null>(null)
  const [tempLng, setTempLng] = useState<number | null>(null)
  const [hasPreciseLocation, setHasPreciseLocation] = useState(
    typeof initialData?.latitude === 'number' && typeof initialData?.longitude === 'number'
  )
  const supabase = createClient() as any

  const innerFormSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    email: z.string().email(tCommon('invalidEmail')).optional().or(z.literal('')),
    phone: optionalPhoneSchema(tAuth('invalidPhone')),
    address: z.string().optional().or(z.literal('')),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    tin: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
    category_id: z.string().optional().nullable(),
  })

  type FormData = z.infer<typeof innerFormSchema>

  const { register, handleSubmit, setValue, getValues, control, formState: { errors } } = usePersistedForm<FormData>('customer-form-v3', {
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      latitude: initialData?.latitude ?? null,
      longitude: initialData?.longitude ?? null,
      tin: initialData?.tin || '',
      notes: initialData?.notes || '',
      category_id: initialData?.category_id || '',
    },
  })

  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      // These forms had no current-user lookup at all; the creator/assignee
      // stamps below need one.
      const { data: userRes } = await supabase.auth.getUser()
      const userId: string | null = userRes?.user?.id ?? null

      const payload = {
        // Responsible person; falls back to the current user so a record is
        // never left unassigned by accident.
        assigned_to: assignedTo ?? initialData?.assigned_to ?? userId,
        created_by: initialData?.created_by ?? userId,
        ...data,
        name: data.name || '',
        category_id: data.category_id || null, // empty string = uncategorized
      }

      if (initialData?.id) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(tCommon('success'))
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([payload])
          if (error) throw error
        toast.success(tCommon('success'))
      }
      
      await invalidateCustomers()
      clearPersistedForm('customer-form-v3')
      exitForm()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLocationSelect = (address: string, lat: number, lng: number) => {
    setTempAddress(address)
    setTempLat(lat)
    setTempLng(lng)
  }

  const handleOpenMap = () => {
    setTempAddress(getValues('address') || '')
    setTempLat(getValues('latitude') ?? null)
    setTempLng(getValues('longitude') ?? null)
    setIsMapOpen(true)
  }

  const handleConfirmLocation = () => {
    setValue('address', tempAddress, { shouldDirty: true, shouldValidate: true })
    setValue('latitude', tempLat, { shouldDirty: true })
    setValue('longitude', tempLng, { shouldDirty: true })
    setHasPreciseLocation(typeof tempLat === 'number' && typeof tempLng === 'number')
    setIsMapOpen(false)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer Details Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-violet-50 dark:bg-violet-950/50 rounded-lg">
              <User className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">{tSales('customer')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">{tSales('customerSubtitle')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                {tSales('customerName')} *
              </Label>
              <Input
              required
                id="name"
                {...register('name')}
                placeholder={tSales('customerNamePlaceholder')}
                className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg text-sm transition-all focus:bg-white dark:focus:bg-slate-800"
              />
              {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                {tSales('phone')}
              </Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    id="phone"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    hasError={!!errors.phone}
                    triggerClassName="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
                    inputClassName="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg text-sm transition-all focus:bg-white dark:focus:bg-slate-800"
                  />
                )}
              />
              {errors.phone && <p className="text-xs text-red-500 font-medium">{errors.phone.message as string}</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {tSales('email')}
              </Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder={tSales('emailPlaceholder')}
                className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg text-sm transition-all focus:bg-white dark:focus:bg-slate-800"
              />
              {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>}
            </div>

            {/* TIN */}
            <div className="space-y-2">
              <Label htmlFor="tin" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                {tSales('tin')}
              </Label>
              <Input
                id="tin"
                {...register('tin')}
                placeholder={tSales('tinPlaceholder')}
                className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg text-sm transition-all focus:bg-white dark:focus:bg-slate-800"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category_id" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Tags className="h-3.5 w-3.5 text-slate-400" />
                {tSales('category')}
              </Label>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value || 'none'} onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}>
                    <SelectTrigger id="category_id" className="w-full">
                      <SelectValue placeholder={tCommon('select')}>
                        {field.value ? categories.find((c) => c.id === field.value)?.name : tCommon('select')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tCommon('select')}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Address Field */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {tSales('address')}
                {hasPreciseLocation && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full normal-case">
                    <MapPin className="h-2.5 w-2.5" />
                    {lang === 'uz' ? 'Xaritada belgilangan' : lang === 'ru' ? 'Отмечено на карте' : 'Pinned on map'}
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="address"
                  {...register('address')}
                  placeholder={tSales('addressPlaceholder')}
                  className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg text-sm transition-all focus:bg-white dark:focus:bg-slate-800 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenMap}
                  className="h-10 px-4 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {tSales('locationPicker.button')}
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                {tSales('notes')}
              </Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder={tSales('notesPlaceholder')}
                rows={3}
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500 rounded-lg text-sm transition-all focus:bg-white dark:focus:bg-slate-800 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
      <div className="max-w-sm">
        <AssigneeSelect
          value={assignedTo}
          onChange={setAssignedTo}
          users={assignableUsers}
        />
      </div>

        <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => exitForm()}
            disabled={isSubmitting}
          >
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      </form>

      {/* Dynamic Map Dialog */}
      {isMapOpen && (
        <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
          <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <DialogTitle className="font-bold text-slate-800 dark:text-slate-200 text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                {tSales('locationPicker.dialogTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
                {tSales('locationPicker.dialogSubtitle')}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <MapPicker
                onLocationSelect={handleLocationSelect}
                initialAddress={tempAddress || getValues('address')}
                initialLat={tempLat}
                initialLng={tempLng}
              />
            </div>
            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMapOpen(false)}
                className="h-10 px-4 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-medium text-sm transition-colors"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmLocation}
                className="h-10 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
              >
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
