import { z } from 'zod'
import { addMonths } from '@/components/admin/preset-picker'
import { newPasswordSchema } from '@/lib/password-validation'
import { phoneSchema } from '@/lib/phone-validation'
import { isReservedSubdomain } from '@/lib/tenant-auth'
import { isoDate } from '@/lib/utils'

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
  support_agent_id: string | null
}

export interface SupportAgentOption {
  id: string
  full_name: string
}

export type TenantFormMode = 'create' | 'edit'
type Translate = (key: string) => string

/** Only on create: an edit moves the subscription through a payment and never touches the costing method. */
const onCreate = <T extends z.ZodTypeAny>(mode: TenantFormMode, schema: T) => (mode === 'create' ? schema : schema.optional())

export function tenantSchema(mode: TenantFormMode, t: Translate, passwordRule: string) {
  const password = newPasswordSchema(passwordRule)
  return z
    .object({
      subdomain: z.string().min(2, t('subdomainInvalid')).regex(/^[a-z0-9-]+$/, t('subdomainInvalid')).refine((v) => !isReservedSubdomain(v), t('subdomainReserved')),
      company_name: z.string().min(1, t('companyNameRequired')),
      phone: phoneSchema(t('phoneInvalid')),
      password: mode === 'create' ? password : z.union([password, z.literal('')]).optional(),
      costing_method: z.enum(['fifo', 'lifo', 'aveco']),
      license_count: onCreate(mode, z.number({ message: t('licenseCountRequired') }).int().min(1, t('licenseCountRequired'))),
      license_months: onCreate(mode, z.number({ message: t('licenseMonthsRequired') }).int().min(1, t('licenseMonthsRequired'))),
      subscription_started_at: onCreate(mode, z.string().min(1, t('subscriptionStartRequired'))),
      subscription_ends_at: onCreate(mode, z.string().min(1, t('subscriptionEndRequired'))),
      price_paid: onCreate(mode, z.number({ message: t('pricePaidRequired') }).min(0, t('pricePaidNegative'))),
      details: z.string().optional(),
      support_agent_id: z.string().uuid().nullable().optional(),
    })
    .refine((data) => mode === 'edit' || new Date(data.subscription_ends_at ?? '') > new Date(data.subscription_started_at ?? ''), {
      message: t('subscriptionEndBeforeStart'),
      path: ['subscription_ends_at'],
    })
}

export type TenantFormData = z.infer<ReturnType<typeof tenantSchema>>

export function tenantDefaults(initial?: TenantFormInitialData): Partial<TenantFormData> {
  if (!initial) {
    const today = isoDate()
    return { costing_method: 'fifo', license_count: 1, license_months: 1, subscription_started_at: today, subscription_ends_at: addMonths(today, 1), price_paid: 0, support_agent_id: null }
  }
  return {
    subdomain: initial.subdomain,
    company_name: initial.company_name,
    phone: initial.phone,
    costing_method: initial.costing_method,
    license_count: initial.license_count,
    license_months: initial.license_months,
    subscription_started_at: initial.subscription_started_at ?? '',
    subscription_ends_at: initial.subscription_ends_at ?? '',
    support_agent_id: initial.support_agent_id ?? null,
  }
}

/** An edit sends only identity, support agent and notes. */
export const tenantBody = (mode: TenantFormMode, data: TenantFormData) =>
  mode === 'edit' ? { subdomain: data.subdomain, company_name: data.company_name, phone: data.phone, details: data.details, support_agent_id: data.support_agent_id } : data
