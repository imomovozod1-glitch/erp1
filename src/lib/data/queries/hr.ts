/**
 * Employees, departments, role templates and assignable users.
 *
 * Part of the query layer described in `./index.ts` — every function here is
 * `unstable_cache`-wrapped, tagged for invalidation, and MUST filter by
 * `tenant_id` explicitly: the service-role client it uses bypasses RLS.
 */

import { unstable_cache } from 'next/cache'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { queryPage, type PageResult } from '@/lib/data/paginate'
import { CACHE_TAGS } from './cache-tags'

export const getCachedEmployees = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('employees')
      .select('*, profiles(full_name, email, avatar_url, departments!fk_profiles_department(name))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  ['employees-list'],
  { tags: [CACHE_TAGS.employees, CACHE_TAGS.departments], revalidate: 60 }
)

export const getCachedRoleTemplates = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('role_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['role-templates-list'],
  { tags: [CACHE_TAGS.roleTemplates], revalidate: 120 }
)

export const getCachedRoleTemplateById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data, error } = await supabase
      .from('role_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw error
    return data
  },
  ['role-template-by-id'],
  { tags: [CACHE_TAGS.roleTemplates], revalidate: 3600 }
)

export const getCachedDepartments = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['departments-list'],
  { tags: [CACHE_TAGS.departments], revalidate: 120 }
)

/**
 * The cashbox screen's standing data: the registers themselves plus the four
 * picker lists behind the kirim/chiqim dialog.
 *
 * The screen used to fetch all of this from the BROWSER after hydrating: the
 * cashboxes, then — awaiting that first — their transactions, then four more
 * lookups for the customer/employee/supplier/category pickers. Against a
 * Supabase project ~500 ms away that is a second and a half of empty cards
 * after the page has already been delivered, every single visit, and none of
 * it was cached anywhere.
 *
 * Fetched together rather than as five exported queries because the screen
 * always needs all five, and one cache entry means one round trip on a miss
 * instead of five. The transaction history is deliberately NOT part of it —
 * see `getCachedCashboxTransactions`.
 *
 * `failed` is part of the contract: the client keeps a localStorage mirror for
 * when Supabase is unreachable (see `adjustCashboxBalance` in
 * finance-helpers.ts), and it can only decide to use it if it can tell an
 * empty tenant apart from a failed read.
 */
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
        .select('id, full_name, email, role, permissions')
        .eq('tenant_id', tenantId),
      supabase
        .from('employees')
        .select('profile_id')
        .eq('tenant_id', tenantId)
        .not('profile_id', 'is', null),
    ])

    return {
      cashboxes: cashboxes.data ?? [],
      roleTemplates: roleTemplates.data ?? [],
      profiles: profiles.data ?? [],
      claimedProfileIds: (linked.data ?? []).map((e: any) => e.profile_id as string),
    }
  },
  ['employee-form-options'],
  {
    tags: [CACHE_TAGS.cashbox, CACHE_TAGS.roleTemplates, CACHE_TAGS.employees, 'profiles'],
    revalidate: 60,
  }
)

export const getCachedDepartmentsForSelect = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name')
    return data ?? []
  },
  ['departments-select'],
  { tags: [CACHE_TAGS.departments], revalidate: 120 }
)

export const getCachedEmployeeById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw error
    return data
  },
  ['employee-by-id'],
  { tags: [CACHE_TAGS.employees], revalidate: 3600 }
)

export const getCachedDepartmentById = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw error
    return data
  },
  ['department-by-id'],
  { tags: [CACHE_TAGS.departments], revalidate: 3600 }
)

export const getCachedEmployeeDetails = unstable_cache(
  async (id: string, tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data: employee } = await supabase
      .from('employees')
      .select('*, profiles(*, departments!fk_profiles_department(name))')
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

export function getEmployeesPage(
  tenantId: string,
  opts: {
    page: number
    pageSize: number
    search?: string
    status?: 'all' | 'hired' | 'not_hired'
    /** Paid-seat (subscribed) filter — `is_paid` is what gates a system login. */
    paid?: 'all' | 'paid' | 'free'
  }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'employees',
    tenantId,
    select: '*, profiles(full_name, email, avatar_url, departments!fk_profiles_department(name))',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['full_name', 'employee_code', 'position'],
    filters: {
      is_active: opts.status === 'all' || !opts.status ? undefined : opts.status === 'hired',
      is_paid: opts.paid === 'all' || !opts.paid ? undefined : opts.paid === 'paid',
    },
    orderBy: { column: 'created_at', ascending: false },
  })
}

/**
 * Active tenant members, for the "responsible person" picker on documents.
 * Cached: the staff list changes far less often than documents do.
 */
export const getAssignableUsers = unstable_cache(
  async (tenantId: string) => {
    const supabase = getCacheClient() as any
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('full_name')
    return (data ?? []) as { id: string; full_name: string | null; role: string }[]
  },
  ['assignable-users'],
  { tags: ['profiles'], revalidate: 120 }
)
