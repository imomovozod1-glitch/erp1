'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Building2, Globe, Phone, KeyRound, Layers, CalendarDays, Wallet, FileText, ReceiptText, IdCard, Users, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NumericInput } from '@/components/ui/numeric-input'
import { PasswordInput } from '@/components/ui/password-input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { formatPhoneInput, isReservedSubdomain } from '@/lib/tenant-auth'
import { cn } from '@/lib/utils'

export interface TenantFormInitialData {
  id: string
  subdomain: string
  company_name: string
  phone: string
  costing_method: 'fifo' | 'lifo' | 'aveco'
  license_count: number
  license_months: number
  subscription_started_at: string | null
  subscription_ends_at: string | null
  details: string | null
}

interface TenantFormProps {
  mode: 'create' | 'edit'
  initialData?: TenantFormInitialData
}

const LICENSE_COUNT_PRESETS = [1, 5, 10, 25, 50]
const DURATION_PRESETS = [1, 3, 6, 12]

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + (Number(months) || 1))
  return d.toISOString().slice(0, 10)
}

function SectionHeading({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {children}
    </h3>
  )
}

/**
 * Preset-pill selector with a "custom" fallback — the modern equivalent of a
 * plan/seat-count picker (mirrors the status-filter pill pattern already
 * used in tenants-table.tsx) instead of a bare number field. Falls open to
 * a NumericInput automatically when the current value isn't one of the
 * presets (e.g. editing a tenant that already has a non-standard value).
 */
function PresetPicker({
  value,
  options,
  onSelect,
  customLabel,
  suffix,
}: {
  value: number | undefined
  options: number[]
  onSelect: (n: number) => void
  customLabel: string
  suffix?: string
}) {
  const [customOpen, setCustomOpen] = useState(value != null && !options.includes(value))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setCustomOpen(false)
              onSelect(n)
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
              !customOpen && value === n
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            )}
          >
            {n}
            {suffix ? ` ${suffix}` : ''}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
            customOpen
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
          )}
        >
          <Pencil className="h-3 w-3" /> {customLabel}
        </button>
      </div>
      {customOpen && (
        <NumericInput
          value={value}
          onChange={(v) => onSelect(typeof v === 'number' ? v : 0)}
          className="w-32"
        />
      )}
    </div>
  )
}

export function TenantForm({ mode, initialData }: TenantFormProps) {
  const t = useTranslations('admin.form')
  const tPassword = useTranslations('admin.password')
  const tCosting = useTranslations('inventory')
  const lang = useLocale()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tenantFormSchema = useMemo(
    () =>
      z.object({
        subdomain: z
          .string()
          .min(2, t('subdomainInvalid'))
          .regex(/^[a-z0-9-]+$/, t('subdomainInvalid'))
          .refine((v) => !isReservedSubdomain(v), t('subdomainReserved')),
        company_name: z.string().min(1, t('companyNameRequired')),
        phone: z
          .string()
          .min(9, t('phoneInvalid'))
          .regex(/^\+?\d[\d\s-]{7,}\d$/, t('phoneInvalid')),
        password:
          mode === 'create'
            ? z.string().min(6, t('passwordRequired'))
            : z.string().optional(),
        costing_method: z.enum(['fifo', 'lifo', 'aveco']),
        license_count: z.number({ message: t('licenseCountRequired') }).int().min(1, t('licenseCountRequired')),
        license_months: z.number({ message: t('licenseMonthsRequired') }).int().min(1, t('licenseMonthsRequired')),
        subscription_started_at: z.string().min(1, t('subscriptionStartRequired')),
        subscription_ends_at: z.string().min(1, t('subscriptionEndRequired')),
        price_paid:
          mode === 'create'
            ? z.number({ message: t('pricePaidRequired') }).min(0, t('pricePaidNegative'))
            : z.number().optional(),
        details: z.string().optional(),
      }).refine((data) => new Date(data.subscription_ends_at) > new Date(data.subscription_started_at), {
        message: t('subscriptionEndBeforeStart'),
        path: ['subscription_ends_at'],
      }),
    [t, mode]
  )
  type TenantFormData = z.infer<typeof tenantFormSchema>

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: initialData
      ? {
          subdomain: initialData.subdomain,
          company_name: initialData.company_name,
          phone: initialData.phone,
          costing_method: initialData.costing_method,
          license_count: initialData.license_count,
          license_months: initialData.license_months,
          subscription_started_at: initialData.subscription_started_at ?? '',
          subscription_ends_at: initialData.subscription_ends_at ?? '',
        }
      : {
          costing_method: 'fifo',
          license_count: 1,
          license_months: 1,
          subscription_started_at: new Date().toISOString().slice(0, 10),
          subscription_ends_at: addMonths(new Date().toISOString().slice(0, 10), 1),
        },
  })

  // Duration presets are a convenience: clicking one sets license_months AND
  // recomputes subscription_ends_at from the current start date — a one-time
  // action, not a live watcher, so a manual edit to the end date afterward
  // is never silently overwritten by an unrelated field change.
  const applyDurationPreset = (months: number) => {
    setValue('license_months', months, { shouldValidate: true })
    const start = getValues('subscription_started_at')
    if (start) {
      setValue('subscription_ends_at', addMonths(start, months), { shouldValidate: true })
    }
  }

  const onSubmit = async (data: TenantFormData) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(
        mode === 'create' ? '/api/admin/tenants' : `/api/admin/tenants/${initialData!.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || t('genericError'))
        setIsSubmitting(false)
        return
      }
      toast.success(mode === 'create' ? t('createSuccess') : t('updateSuccess'))
      router.push('/admin/tenants')
      router.refresh()
    } catch {
      toast.error(t('genericError'))
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 max-w-3xl">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-4">
            <SectionHeading icon={Building2}>{t('sectionBasics')}</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="company_name" className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {t('companyName')}
                </Label>
                <Input id="company_name" placeholder={t('companyNamePlaceholder')} {...register('company_name')} />
                {errors.company_name && <p className="text-sm text-red-500">{errors.company_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subdomain" className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" /> {t('subdomain')}
                </Label>
                <Input id="subdomain" placeholder={t('subdomainPlaceholder')} {...register('subdomain')} />
                {errors.subdomain ? (
                  <p className="text-sm text-red-500">{errors.subdomain.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('subdomainHint')}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {t('phone')}
                </Label>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <Input
                      id="phone"
                      placeholder={t('phonePlaceholder')}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(formatPhoneInput(e.target.value))}
                    />
                  )}
                />
                {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
              </div>

              {mode === 'create' && (
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> {t('password')}
                  </Label>
                  <PasswordInput
                    id="password"
                    placeholder={t('passwordPlaceholder')}
                    showLabel={tPassword('show')}
                    hideLabel={tPassword('hide')}
                    {...register('password')}
                  />
                  {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5 border-t pt-6 dark:border-slate-800">
            <SectionHeading icon={ReceiptText}>{t('sectionSubscription')}</SectionHeading>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" /> {t('costingMethod')}
              </Label>
              <Controller
                control={control}
                name="costing_method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue>
                        {(value: 'fifo' | 'lifo' | 'aveco') => tCosting(value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fifo">{tCosting('fifo')}</SelectItem>
                      <SelectItem value="lifo">{tCosting('lifo')}</SelectItem>
                      <SelectItem value="aveco">{tCosting('aveco')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" /> {t('licenseCount')}
              </Label>
              <Controller
                control={control}
                name="license_count"
                render={({ field: { value, onChange } }) => (
                  <PresetPicker
                    value={value}
                    options={LICENSE_COUNT_PRESETS}
                    onSelect={onChange}
                    customLabel={t('custom')}
                  />
                )}
              />
              {errors.license_count && <p className="text-sm text-red-500">{errors.license_count.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground" /> {t('licenseMonths')}
              </Label>
              <Controller
                control={control}
                name="license_months"
                render={({ field: { value } }) => (
                  <PresetPicker
                    value={value}
                    options={DURATION_PRESETS}
                    onSelect={applyDurationPreset}
                    customLabel={t('custom')}
                    suffix={t('months')}
                  />
                )}
              />
              {errors.license_months && <p className="text-sm text-red-500">{errors.license_months.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="subscription_started_at" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> {t('subscriptionStart')}
                </Label>
                <Controller
                  control={control}
                  name="subscription_started_at"
                  render={({ field }) => (
                    <DatePicker
                      id="subscription_started_at"
                      value={field.value}
                      onChange={field.onChange}
                      lang={lang}
                      placeholder={t('subscriptionStart')}
                    />
                  )}
                />
                {errors.subscription_started_at && (
                  <p className="text-sm text-red-500">{errors.subscription_started_at.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subscription_ends_at" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> {t('subscriptionEnd')}
                </Label>
                <Controller
                  control={control}
                  name="subscription_ends_at"
                  render={({ field }) => (
                    <DatePicker
                      id="subscription_ends_at"
                      value={field.value}
                      onChange={field.onChange}
                      lang={lang}
                      placeholder={t('subscriptionEnd')}
                    />
                  )}
                />
                {errors.subscription_ends_at && (
                  <p className="text-sm text-red-500">{errors.subscription_ends_at.message}</p>
                )}
              </div>

              {mode === 'create' && (
                <div className="space-y-1.5">
                  <Label htmlFor="price_paid" className="flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" /> {t('initialPayment')}
                  </Label>
                  <Controller
                    control={control}
                    name="price_paid"
                    render={({ field: { value, onChange } }) => (
                      <NumericInput id="price_paid" placeholder="0" value={value ?? undefined} onChange={onChange} />
                    )}
                  />
                  {errors.price_paid && <p className="text-sm text-red-500">{errors.price_paid.message}</p>}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t pt-6 dark:border-slate-800">
            <SectionHeading icon={FileText}>{t('sectionNotes')}</SectionHeading>
            <div className="space-y-1.5">
              <Textarea id="details" rows={4} placeholder={t('detailsPlaceholder')} {...register('details')} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === 'create' ? t('create') : t('save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/admin/tenants')}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
