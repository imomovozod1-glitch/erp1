'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateSuppliers } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Truck, Mail, Phone, MapPin, CreditCard, FileText, User } from 'lucide-react'

interface SupplierFormProps {
  initialData?: any
  lang: string
}

export function SupplierForm({ initialData, lang }: SupplierFormProps) {
  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formSchema = z.object({
    name: z.string().min(1, tCommon('required')),
    phone: z.string().min(1, tCommon('required')),
    email: z.string().email(tCommon('invalidEmail')).optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    contact_person: z.string().optional().or(z.literal('')),
    tin: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
    is_active: z.boolean(),
  })

  type FormData = z.infer<typeof formSchema>

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      address: initialData?.address || '',
      contact_person: initialData?.contact_person || '',
      tin: initialData?.tin || '',
      notes: initialData?.notes || '',
      is_active: initialData?.is_active ?? true,
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient() as any

      const payload = {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        contact_person: data.contact_person || null,
        tin: data.tin || null,
        notes: data.notes || null,
        is_active: data.is_active,
      }

      if (initialData?.id) {
        const { error } = await supabase
          .from('suppliers')
          .update(payload as any)
          .eq('id', initialData.id)
        if (error) throw error
        toast.success(t('supplierUpdated'))
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([payload as any])
        if (error) throw error
        toast.success(t('supplierCreated'))
      }
      await invalidateSuppliers()
      router.push(`/${lang}/procurement/suppliers`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-base">{t('supplier')}</h3>
          <p className="text-xs text-slate-500 font-sans">{t('addSupplier')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Supplier Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-slate-400" />
            {t('supplierName')} *
          </Label>
          <Input
            id="name"
            {...register('name')}
            placeholder={t('supplierName')}
            className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all focus:bg-white"
          />
          {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            {t('supplierPhone')} *
          </Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="+998 90 123 45 67"
            className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all focus:bg-white"
          />
          {errors.phone && <p className="text-xs text-red-500 font-medium">{errors.phone.message}</p>}
        </div>

        {/* Contact Person */}
        <div className="space-y-2">
          <Label htmlFor="contact_person" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-400" />
            {t('contactPerson')}
          </Label>
          <Input
            id="contact_person"
            {...register('contact_person')}
            placeholder={t('contactPerson')}
            className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all focus:bg-white"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            {tCommon('email')}
          </Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="example@mail.com"
            className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all focus:bg-white"
          />
          {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>}
        </div>

        {/* TIN */}
        <div className="space-y-2">
          <Label htmlFor="tin" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-slate-400" />
            {t('tin')}
          </Label>
          <Input
            id="tin"
            {...register('tin')}
            placeholder="123456789"
            className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all focus:bg-white"
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="is_active" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-400" />
            {tCommon('status')}
          </Label>
          <select
            id="is_active"
            {...register('is_active', { setValueAs: (v) => v === 'true' })}
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 focus:bg-white"
          >
            <option value="true">{tCommon('active')}</option>
            <option value="false">{tCommon('inactive')}</option>
          </select>
        </div>

        {/* Address */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {tCommon('address')}
          </Label>
          <Input
            id="address"
            {...register('address')}
            placeholder={tCommon('address') || 'Address'}
            className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all focus:bg-white"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes" className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            {tCommon('notes') || 'Notes'}
          </Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={tCommon('notes') || 'Notes'}
            rows={3}
            className="bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all focus:bg-white resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-5 justify-end border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${lang}/procurement/suppliers`)}
          disabled={isSubmitting}
          className="rounded-lg"
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 rounded-lg">
          {isSubmitting ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
