'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/phone-input'
import { PasswordInput } from '@/components/ui/password-input'
import { createClient } from '@/lib/supabase/client'
import { invalidateEmployees, invalidateProfile } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Loader2, KeyRound } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import type { Resolver } from 'react-hook-form'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { PermissionsMatrix } from '@/components/shared/permissions-matrix'
import { EMPTY_PERMISSIONS, type Permissions } from '@/lib/permissions'
import { isStrongPassword } from '@/lib/password-validation'
import { isValidPhone } from '@/lib/phone-validation'
import { cn } from '@/lib/utils'


interface EmployeeFormProps {
  initialData?: any
  lang: string
}

interface AccountOption {
  id: string
  full_name: string | null
  email: string | null
  permissions: unknown
}

interface RoleTemplateOption {
  id: string
  name: string
  permissions: unknown
}

interface CashboxOption {
  id: string
  name: string
}

export function EmployeeForm({ initialData, lang }: EmployeeFormProps) {
  const t = useTranslations('hr')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any

  const [accessMode, setAccessMode] = useState<'none' | 'link' | 'create'>(initialData?.profile_id ? 'link' : 'none')
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(initialData?.profile_id ?? null)
  const [permsValue, setPermsValue] = useState<Permissions>(EMPTY_PERMISSIONS)
  const [newPhone, setNewPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isPaid, setIsPaid] = useState<boolean>(initialData?.is_paid ?? false)
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplateOption[]>([])
  const [selectedRoleTemplateId, setSelectedRoleTemplateId] = useState<string | null>(initialData?.role_template_id ?? null)
  const [cashboxes, setCashboxes] = useState<CashboxOption[]>([])
  const [selectedCashboxId, setSelectedCashboxId] = useState<string | null>(initialData?.cashbox_id ?? null)

  // The account fields live in component state rather than react-hook-form, so
  // they need their own error slots. They used to surface only as toasts,
  // which meant a bad phone number produced a message with no indication of
  // which box was wrong — and the message vanished on its own.
  const [accessErrors, setAccessErrors] = useState<{ profile?: string; phone?: string; password?: string }>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('cashboxes').select('id, name').order('name')
      if (!cancelled) setCashboxes(data ?? [])
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Role templates are tenant-scoped by RLS (see migration_roles_and_seats.sql)
  // — the browser client only ever sees the caller's own tenant's rows, no
  // need to pass tenant_id explicitly.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('role_templates').select('id, name, permissions').order('name')
      if (!cancelled) setRoleTemplates(data ?? [])
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectRoleTemplate = (roleId: string | null) => {
    const next = !roleId || roleId === 'none' ? null : roleId
    setSelectedRoleTemplateId(next)
    const chosen = roleTemplates.find((r) => r.id === next)
    setPermsValue(chosen?.permissions && typeof chosen.permissions === 'object' ? (chosen.permissions as Permissions) : EMPTY_PERMISSIONS)
  }

  // Available login accounts to link this employee to — profiles not
  // already claimed by a different employee (employees.profile_id is
  // UNIQUE), plus whichever one this employee already has, so editing an
  // existing link doesn't make it disappear from its own dropdown.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: profiles }, { data: linkedEmployees }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, permissions'),
        supabase.from('employees').select('profile_id').not('profile_id', 'is', null),
      ])
      if (cancelled) return
      const claimedIds = new Set(
        (linkedEmployees ?? [])
          .map((e: any) => e.profile_id)
          .filter((id: string) => id !== initialData?.profile_id)
      )
      const available = (profiles ?? []).filter((p: any) => p.role !== 'admin' && !claimedIds.has(p.id))
      setAccountOptions(available)
      const current = (profiles ?? []).find((p: any) => p.id === initialData?.profile_id)
      if (current) {
        setPermsValue(current.permissions && typeof current.permissions === 'object' ? current.permissions : EMPTY_PERMISSIONS)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectAccount = (profileId: string | null) => {
    const next = !profileId || profileId === 'none' ? null : profileId
    setSelectedProfileId(next)
    const chosen = accountOptions.find((p) => p.id === next)
    setPermsValue(chosen?.permissions && typeof chosen.permissions === 'object' ? (chosen.permissions as Permissions) : EMPTY_PERMISSIONS)
  }

  // Every field is trimmed and bounded, and the two date rules are enforced as
  // cross-field checks. Previously `min(1)` accepted a string of spaces as a
  // name, `salary` silently coerced an empty box to 0, an employee could be
  // hired in the year 3000, and marking someone inactive without a termination
  // date quietly stored NULL — so the record said "not employed" with no
  // indication of when that happened.
  const todayISO = new Date().toISOString().split('T')[0]

  const innerFormSchema = z
    .object({
      full_name: z
        .string()
        .trim()
        .min(2, tCommon('required'))
        .max(120, tCommon('tooLong')),
      employee_code: z
        .string()
        .trim()
        .min(1, tCommon('required'))
        .max(32, tCommon('tooLong'))
        .regex(/^[A-Za-z0-9._-]+$/, t('employeeCodeFormat')),
      position: z.string().trim().max(100, tCommon('tooLong')).optional().or(z.literal('')),
      salary: z
        .coerce.number({ message: tCommon('invalidAmount') })
        .min(0, tCommon('invalidAmount'))
        .max(1_000_000_000_000, tCommon('invalidAmount')),
      hired_at: z
        .string()
        .min(1, tCommon('required'))
        .refine((v) => !Number.isNaN(Date.parse(v)), tCommon('invalidDate'))
        .refine((v) => v <= todayISO, t('hiredAtFuture')),
      is_active: z.boolean().default(true),
      terminated_at: z.string().optional().nullable(),
      notes: z.string().trim().max(1000, tCommon('tooLong')).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.is_active) return
      // An inactive employee must say when they left, and it can be neither
      // before they were hired nor in the future.
      if (!data.terminated_at) {
        ctx.addIssue({ code: 'custom', path: ['terminated_at'], message: t('terminatedAtRequired') })
        return
      }
      if (Number.isNaN(Date.parse(data.terminated_at))) {
        ctx.addIssue({ code: 'custom', path: ['terminated_at'], message: tCommon('invalidDate') })
        return
      }
      if (data.hired_at && data.terminated_at < data.hired_at) {
        ctx.addIssue({ code: 'custom', path: ['terminated_at'], message: t('terminatedBeforeHired') })
      }
      if (data.terminated_at > todayISO) {
        ctx.addIssue({ code: 'custom', path: ['terminated_at'], message: t('terminatedAtFuture') })
      }
    })

  type FormData = z.infer<typeof innerFormSchema>

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(innerFormSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      full_name: initialData?.full_name || '',
      employee_code: initialData?.employee_code || '',
      position: initialData?.position || '',
      salary: initialData?.salary ?? '' as any,
      hired_at: initialData?.hired_at ? initialData.hired_at.split('T')[0] : '',
      is_active: initialData?.is_active ?? true,
      terminated_at: initialData?.terminated_at ? initialData.terminated_at.split('T')[0] : '',
      notes: initialData?.notes || '',
    }
  })

  const validateAccessFields = () => {
    const next: { profile?: string; phone?: string; password?: string } = {}
    if (accessMode === 'link' && !selectedProfileId) {
      next.profile = t('selectAccountRequired')
    }
    if (accessMode === 'create') {
      if (!isValidPhone(newPhone)) next.phone = tAuth('invalidPhone')
      if (!isStrongPassword(newPassword)) next.password = tAuth('passwordRequirements')
    }
    setAccessErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (data: FormData) => {
    if (accessMode !== 'none' && !isPaid) {
      toast.error(t('systemAccessRequiresPaid'))
      return
    }
    if (!validateAccessFields()) return
    setIsSubmitting(true)
    try {
      let profileId: string | null = accessMode === 'link' ? selectedProfileId : null

      // Creating a brand-new login has to go through a server route — it
      // needs the service-role key (auth.admin.createUser), which the
      // browser client never has access to. See src/app/api/tenant/users/route.ts.
      if (accessMode === 'create') {
        const res = await fetch('/api/tenant/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: data.full_name,
            phone: newPhone,
            password: newPassword,
            permissions: permsValue,
            role_template_id: selectedRoleTemplateId,
            is_paid: isPaid,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(json.error || t('createAccountError'))
          setIsSubmitting(false)
          return
        }
        profileId = json.profile.id
      }

      // Every employee needs a cashbox — if the admin didn't pick an
      // existing one, create a personal one named after them rather than
      // leaving cashbox_id unset.
      // Only auto-create on the *first* save. Re-running this on every edit of an
      // employee who still has no cashbox spawned a duplicate cashbox each time
      // the form was saved (e.g. just toggling is_active). `description` is set
      // explicitly because several list/search screens read it.
      let cashboxId = selectedCashboxId ?? initialData?.cashbox_id ?? null
      if (!cashboxId) {
        const { data: newCashbox, error: cashboxError } = await supabase
          .from('cashboxes')
          .insert({
            name: data.full_name,
            type: 'cash',
            description: t('employeeCashboxDescription', { name: data.full_name }),
          })
          .select('id')
          .single()
        if (cashboxError) throw cashboxError
        cashboxId = newCashbox.id
      }

      const payload = {
        ...data,
        terminated_at: !data.is_active && data.terminated_at ? data.terminated_at : null,
        profile_id: profileId,
        is_paid: isPaid,
        cashbox_id: cashboxId,
      }
      // UNIQUE (tenant_id, employee_code) — surface it as the field problem it
      // is rather than a raw Postgres constraint string.
      const asFriendlyError = (error: { code?: string; message?: string }) =>
        new Error(error.code === '23505' ? t('employeeCodeTaken') : error.message || tCommon('error'))

      if (initialData?.id) {
        const { error } = await supabase
          .from('employees')
          .update(payload as any)
          .eq('id', initialData.id)
        if (error) throw asFriendlyError(error)
        toast.success(tCommon('saved'))
      } else {
        const { error } = await supabase
          .from('employees')
          .insert(payload as any)
        if (error) throw asFriendlyError(error)
        toast.success(tCommon('created'))
      }

      // The linked login account's module permissions are edited here but
      // live on `profiles`, not `employees` — a separate write. (A
      // freshly-created account already got its permissions set by the
      // API route above, so this only applies to an existing linked one.)
      if (accessMode === 'link' && profileId) {
        // Through the server route, not the browser client: `permissions` and
        // `role_template_id` are privilege-bearing and `authenticated` no
        // longer holds UPDATE on them (migration_profile_privilege_lockdown.sql).
        const res = await fetch(`/api/tenant/users/${profileId}/access`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: permsValue, role_template_id: selectedRoleTemplateId }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error || tCommon('error'))
        }
        await invalidateProfile(profileId)
      }

      await invalidateEmployees()
      router.push(`/${lang}/hr/employees`)
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isActiveValue = useWatch({ control, name: 'is_active' })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? tCommon('edit') : tCommon('add')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">{tCommon('name')}</Label>
              <Input id="full_name" {...register('full_name')} placeholder={tCommon('name')} />
              {errors.full_name && (
                <p className="text-sm text-red-500">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_code">{t('employeeCode')}</Label>
              <Input id="employee_code" {...register('employee_code')} />
              {errors.employee_code && (
                <p className="text-sm text-red-500">{errors.employee_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">{t('position')}</Label>
              <Input id="position" {...register('position')} />
              {errors.position && (
                <p className="text-sm text-red-500">{errors.position.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary">{t('salary')}</Label>
              <Controller
                control={control}
                name="salary"
                render={({ field: { onChange, value } }) => (
                  <NumericInput id="salary" value={value} onChange={onChange} />
                )}
              />
              {errors.salary && (
                <p className="text-sm text-red-500">{errors.salary.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hired_at">{t('hiredAt')}</Label>
              <Controller
                control={control}
                name="hired_at"
                render={({ field }) => (
                  <DatePicker
                    id="hired_at"
                    value={field.value}
                    onChange={field.onChange}
                    lang={lang}
                    placeholder={t('hiredAt')}
                  />
                )}
              />
              {errors.hired_at && (
                <p className="text-sm text-red-500">{errors.hired_at.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashbox">{t('cashbox')}</Label>
              <Select value={selectedCashboxId ?? 'auto'} onValueChange={(v) => setSelectedCashboxId(v === 'auto' ? null : v)}>
                <SelectTrigger id="cashbox" className="w-full">
                  <SelectValue>
                    {(val: string) => {
                      if (val === 'auto' || !val) return t('cashboxAuto')
                      return cashboxes.find((cb) => cb.id === val)?.name ?? t('cashboxAuto')
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t('cashboxAuto')}</SelectItem>
                  {cashboxes.map((cb) => (
                    <SelectItem key={cb.id} value={cb.id}>{cb.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('cashboxHint')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea id="notes" {...register('notes')} />
            {errors.notes && (
              <p className="text-sm text-red-500">{errors.notes.message}</p>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t dark:border-slate-800">
            <div className="flex items-center space-x-2 pt-4">
              <Checkbox
                id="is_paid"
                checked={isPaid}
                onCheckedChange={(checked) => {
                  const next = checked as boolean
                  setIsPaid(next)
                  if (!next) setAccessMode('none')
                }}
              />
              <Label htmlFor="is_paid" className="cursor-pointer">
                {t('isPaid')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t('isPaidHint')}</p>

            <Label className="flex items-center gap-1.5 pt-2">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> {t('systemAccess')}
            </Label>

            <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 w-fit">
              {(['none', 'link', 'create'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={mode !== 'none' && !isPaid}
                  onClick={() => setAccessMode(mode)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                    mode !== 'none' && !isPaid
                      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      : accessMode === mode
                        ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  {mode === 'none' ? t('systemAccessNone') : mode === 'link' ? t('systemAccessLink') : t('systemAccessCreate')}
                </button>
              ))}
            </div>

            {!isPaid && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('systemAccessRequiresPaid')}</p>
            )}

            {isPaid && accessMode === 'none' && (
              <p className="text-xs text-muted-foreground">{t('systemAccessHint')}</p>
            )}

            {accessMode === 'link' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <Select value={selectedProfileId ?? ''} onValueChange={handleSelectAccount}>
                  <SelectTrigger id="system-access" className="w-full sm:w-80">
                    <SelectValue>
                      {(val: string) => {
                        const chosen = accountOptions.find((p) => p.id === val)
                        return chosen ? (chosen.full_name || chosen.email || val) : t('selectAccount')
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email} {p.email ? `(${p.email})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accessErrors.profile && <p className="text-sm text-red-500">{accessErrors.profile}</p>}
                {selectedProfileId && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>{t('selectRoleTemplate')}</Label>
                      <Select value={selectedRoleTemplateId ?? 'none'} onValueChange={handleSelectRoleTemplate}>
                        <SelectTrigger className="w-full sm:w-80">
                          <SelectValue>
                            {(val: string) => {
                              if (val === 'none' || !val) return t('noRoleTemplate')
                              return roleTemplates.find((r) => r.id === val)?.name ?? t('noRoleTemplate')
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('noRoleTemplate')}</SelectItem>
                          {roleTemplates.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{tSettings('permissions')}</Label>
                      <PermissionsMatrix value={permsValue} onChange={setPermsValue} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {accessMode === 'create' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-xs text-muted-foreground">{t('newAccountFields')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-account-phone">{tAuth('phone')}</Label>
                    <PhoneInput id="new-account-phone" value={newPhone} onChange={setNewPhone} placeholder="90 123 45 67" />
                    {accessErrors.phone && <p className="text-sm text-red-500">{accessErrors.phone}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-account-password">{tAuth('password')}</Label>
                    <PasswordInput
                      id="new-account-password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      showLabel={tAuth('showPassword')}
                      hideLabel={tAuth('hidePassword')}
                    />
                    {accessErrors.password ? (
                      <p className="text-sm text-red-500">{accessErrors.password}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{tAuth('passwordRequirements')}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('selectRoleTemplate')}</Label>
                  <Select value={selectedRoleTemplateId ?? 'none'} onValueChange={handleSelectRoleTemplate}>
                    <SelectTrigger className="w-full sm:w-80">
                      <SelectValue>
                        {(val: string) => {
                          if (val === 'none' || !val) return t('noRoleTemplate')
                          return roleTemplates.find((r) => r.id === val)?.name ?? t('noRoleTemplate')
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('noRoleTemplate')}</SelectItem>
                      {roleTemplates.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tSettings('permissions')}</Label>
                  <PermissionsMatrix value={permsValue} onChange={setPermsValue} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="is_active" 
              checked={isActiveValue}
              onCheckedChange={(checked) => {
                setValue('is_active', checked as boolean)
                if (checked) {
                  setValue('terminated_at', '')
                } else {
                  setValue('terminated_at', new Date().toISOString().split('T')[0])
                }
              }}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              {t('isActive')}
            </Label>
          </div>

          {!isActiveValue && (
            <div className="space-y-2 max-w-sm animate-in fade-in slide-in-from-top-1 duration-200">
              <Label htmlFor="terminated_at">{t('terminatedAt')}</Label>
              <Controller
                control={control}
                name="terminated_at"
                render={({ field }) => (
                  <DatePicker
                    id="terminated_at"
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                    lang={lang}
                    placeholder={t('terminatedAt')}
                  />
                )}
              />
              {errors.terminated_at && (
                <p className="text-sm text-red-500">{errors.terminated_at.message}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.push(`/${lang}/hr/employees`)}
              disabled={isSubmitting}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
