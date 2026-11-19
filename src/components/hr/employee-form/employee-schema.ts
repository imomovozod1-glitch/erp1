import * as z from 'zod'
import { EMPTY_PERMISSIONS, type Permissions } from '@/lib/permissions'

export interface AccountOption {
  id: string
  full_name: string | null
  phone: string | null
  permissions: unknown
  role?: string
}

export interface RoleTemplateOption {
  id: string
  name: string
  permissions: unknown
}

export interface EmployeeFormOptions {
  nextEmployeeCode: string
  cashboxes: { id: string; name: string }[]
  roleTemplates: RoleTemplateOption[]
  profiles: AccountOption[]
  claimedProfileIds: string[]
}

type Translate = (key: string) => string

export const permissionsOf = (row?: { permissions: unknown } | null): Permissions =>
  row?.permissions && typeof row.permissions === 'object' ? (row.permissions as Permissions) : EMPTY_PERMISSIONS

/** Every field trimmed and bounded; an inactive employee must say when they left, within their employment. */
export function employeeSchema(t: Translate, today: string) {
  return z
    .object({
      full_name: z.string().trim().min(2, t('common.required')).max(120, t('common.tooLong')),
      employee_code: z.string().trim().max(32, t('common.tooLong')).regex(/^[A-Za-z0-9._-]*$/, t('hr.employeeCodeFormat')),
      position: z.string().trim().max(100, t('common.tooLong')).optional().or(z.literal('')),
      salary: z.coerce.number({ message: t('common.invalidAmount') }).min(0, t('common.invalidAmount')).max(1_000_000_000_000, t('common.invalidAmount')),
      hired_at: z
        .string()
        .min(1, t('common.required'))
        .refine((v) => !Number.isNaN(Date.parse(v)), t('common.invalidDate'))
        .refine((v) => v <= today, t('hr.hiredAtFuture')),
      is_active: z.boolean().default(true),
      terminated_at: z.string().optional().nullable(),
      notes: z.string().trim().max(1000, t('common.tooLong')).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.is_active) return
      const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['terminated_at'], message })
      if (!data.terminated_at) return issue(t('hr.terminatedAtRequired'))
      if (Number.isNaN(Date.parse(data.terminated_at))) return issue(t('common.invalidDate'))
      if (data.hired_at && data.terminated_at < data.hired_at) issue(t('hr.terminatedBeforeHired'))
      if (data.terminated_at > today) issue(t('hr.terminatedAtFuture'))
    })
}

export type EmployeeData = z.infer<ReturnType<typeof employeeSchema>>

const dateOnly = (value?: string | null) => (value ? value.split('T')[0] : '')

export const employeeDefaults = (initial: any, nextCode: string): EmployeeData => ({
  full_name: initial?.full_name || '',
  employee_code: initial?.employee_code || nextCode,
  position: initial?.position || '',
  salary: (initial?.salary ?? '') as unknown as number,
  hired_at: dateOnly(initial?.hired_at),
  is_active: initial?.is_active ?? true,
  terminated_at: dateOnly(initial?.terminated_at),
  notes: initial?.notes || '',
})

/** Accounts that may be linked: not admins, and not already claimed by another employee. */
export function linkableAccounts(options: EmployeeFormOptions, ownProfileId?: string | null) {
  const claimed = new Set(options.claimedProfileIds.filter((id) => id !== ownProfileId))
  return options.profiles.filter((p) => p.role !== 'admin' && !claimed.has(p.id))
}
