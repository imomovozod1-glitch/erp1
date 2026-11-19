import { nextEmployeeCode } from '@/lib/employee-code'
import type { Permissions } from '@/lib/permissions'
import type { EmployeeData } from './employee-schema'

/** The employee code is already taken in this tenant (UNIQUE tenant_id, employee_code). */
export class EmployeeCodeTakenError extends Error {}

/** A login failure the API answered with a body to show as is. */
export class AccountCreateError extends Error {
  constructor(public readonly body: unknown) {
    super('account_create_failed')
  }
}

const UNIQUE_VIOLATION = '23505'
const MAX_CODE_ATTEMPTS = 5
const friendly = (error: { code?: string }) => (error.code === UNIQUE_VIOLATION ? new EmployeeCodeTakenError() : error)

interface NewLogin {
  fullName: string
  phone: string
  password: string
  permissions: Permissions
  roleTemplateId: string | null
  isPaid: boolean
}

// Needs the service-role key (auth.admin.createUser), so it goes through the server route.
export async function createLogin(login: NewLogin): Promise<string> {
  const res = await fetch('/api/tenant/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: login.fullName,
      phone: login.phone,
      password: login.password,
      permissions: login.permissions,
      role_template_id: login.roleTemplateId,
      is_paid: login.isPaid,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new AccountCreateError(json)
  return json.profile.id
}

/** Every employee needs a cashbox; with none chosen, a personal one is created — on the first save only. */
export async function ensureCashbox(supabase: any, chosen: string | null, name: string, description: string) {
  if (chosen) return chosen
  const { data, error } = await supabase.from('cashboxes').insert({ name, type: 'cash', description }).select('id').single()
  if (error) throw error
  return data.id as string
}

const codeTaken = (error: { code?: string; message?: string }) => error.code === UNIQUE_VIOLATION && !!error.message?.includes('employee_code')

/** Two people adding an employee at once get the same suggested code; only the automatic one moves on. */
export async function insertEmployee(supabase: any, payload: Record<string, unknown>, automaticCode: boolean) {
  let code = payload.employee_code
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const { error } = await supabase.from('employees').insert({ ...payload, employee_code: code })
    if (!error) return
    if (!codeTaken(error) || !automaticCode || attempt === MAX_CODE_ATTEMPTS - 1) throw friendly(error)
    const { data, error: readError } = await supabase.from('employees').select('employee_code')
    if (readError) throw readError
    code = nextEmployeeCode((data ?? []).map((e: any) => e.employee_code))
  }
}

export async function updateEmployee(supabase: any, id: string, payload: Record<string, unknown>) {
  const { error } = await supabase.from('employees').update(payload).eq('id', id)
  if (error) throw friendly(error)
}

// `permissions` and `role_template_id` are privilege-bearing: only the server route may write them.
export async function saveLinkedAccess(profileId: string, permissions: Permissions, roleTemplateId: string | null) {
  const res = await fetch(`/api/tenant/users/${profileId}/access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions, role_template_id: roleTemplateId }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '')
}

export function employeePayload(data: EmployeeData, initial: any, nextCode: string, extra: { profileId: string | null; isPaid: boolean; cashboxId: string }) {
  return {
    ...data,
    employee_code: data.employee_code || initial?.employee_code || nextCode,
    terminated_at: !data.is_active && data.terminated_at ? data.terminated_at : null,
    profile_id: extra.profileId,
    is_paid: extra.isPaid,
    cashbox_id: extra.cashboxId,
  }
}
