/**
 * The employee screens' bundled reads: the form's dropdowns and the detail page's history.
 *
 * Same rules as `./hr.ts`: cached, tagged, and filtered by `tenant_id` by hand.
 */

import { unstable_cache } from 'next/cache'
import { nextEmployeeCode } from '@/lib/employee-code'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { CACHE_TAGS } from './cache-tags'

/**
 * The dropdown contents behind the employee form.
 *
 * The form used to fetch these itself from three `useEffect`s once it had
 * hydrated — four queries for a screen the server had already rendered, each a
 * ~500 ms round trip, with the selects sitting empty until they landed. The
 * page is a Server Component and can simply arrive with them.
 *
 * `accounts` is profiles not already claimed by ANOTHER employee
 * (`employees.profile_id` is UNIQUE); the caller re-adds the employee's own
 * current link so editing one does not make it vanish from its own dropdown.
 */
export const getCachedEmployeeFormOptions = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const [cashboxes, roleTemplates, profiles, linked] = await Promise.all([
      supabase.from('cashboxes').select('id, name').eq('tenant_id', tenantId).order('name'),
      supabase
        .from('role_templates')
        .select('id, name, permissions')
        .eq('tenant_id', tenantId)
        .order('name'),
      supabase
        .from('profiles')
        .select('id, full_name, phone, role, permissions')
        .eq('tenant_id', tenantId),
      supabase
        .from('employees')
        .select('profile_id, employee_code')
        .eq('tenant_id', tenantId),
    ])

    return {
      cashboxes: cashboxes.data ?? [],
      roleTemplates: roleTemplates.data ?? [],
      profiles: profiles.data ?? [],
      claimedProfileIds: (linked.data ?? [])
        .map((e: any) => e.profile_id as string | null)
        .filter((id: string | null): id is string => id !== null),
      nextEmployeeCode: nextEmployeeCode((linked.data ?? []).map((e: any) => e.employee_code)),
    }
  },
  ['employee-form-options'],
  {
    tags: [CACHE_TAGS.cashbox, CACHE_TAGS.roleTemplates, CACHE_TAGS.employees, 'profiles'],
    revalidate: 60,
  }
)

export const getCachedEmployeeDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data: employee } = await supabase
      .from('employees')
      .select('*, profiles(*, departments!fk_profiles_department(name), role_templates(name))')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!employee) return null
    const profileId = employee.profile_id

    const [
      { data: transactions },
      { data: salesOrders },
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('employee_id', id)
        .eq('tenant_id', tenantId)
        .order('transaction_date', { ascending: false }),
      profileId
        ? supabase
            .from('sales_orders')
            .select('*, customers(name)')
            .eq('created_by', profileId)
            .eq('tenant_id', tenantId)
            .order('order_date', { ascending: false })
        : Promise.resolve({ data: [] })
    ])

    return {
      employee,
      transactions: transactions ?? [],
      salesOrders: salesOrders ?? [],
    }
  },
  ['employee-details-by-id'],
  { tags: [CACHE_TAGS.employees, CACHE_TAGS.transactions, CACHE_TAGS.orders], revalidate: 30 }
)
