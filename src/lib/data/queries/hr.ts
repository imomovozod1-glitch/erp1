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

/** One page of the role templates list, searched by name. */
export function getRoleTemplatesPage(
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string }
): Promise<PageResult<any>> {
  return queryPage({
    table: 'role_templates',
    tenantId,
    select: '*',
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
    searchColumns: ['name'],
    orderBy: { column: 'name', ascending: true },
  })
}

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
    select: '*, profiles(full_name, phone, role, avatar_url, departments!fk_profiles_department(name), role_templates(name))',
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
