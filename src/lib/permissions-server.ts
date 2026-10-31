import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import {
  accessLevel,
  can,
  dataScope,
  type DataScope,
  type LevelAction,
  type PermissionAction,
  type PermissionModule,
} from '@/lib/permissions'

/**
 * Server-side enforcement of `profiles.permissions`.
 *
 * Until now the permission matrix was consulted in exactly ONE place —
 * `app-sidebar.tsx`, to decide which nav links to render. Hiding a link is not
 * access control: a `staff` user with no `finance` permission simply typed
 * /uz/finance/cashbox and got the whole module, because no page ever checked.
 * These helpers close that gap for every module, from a Server Component, so
 * the check runs before any data is fetched or markup is produced.
 *
 * Scope, stated plainly: this is still an application-level boundary, not a
 * database one. RLS scopes rows to the tenant, but within a tenant it grants
 * every authenticated member the same access, so a user who crafts raw
 * PostgREST calls can still reach data their role hides in the UI. Making
 * `permissions` an RLS boundary means expressing it in SQL policies; that is a
 * separate migration and is deliberately not what this file claims to do.
 */

/** The caller's role + permission map, memoised per request. */
export const getPermissionContext = cache(async () => {
  const user = await getSessionUser()
  if (!user) return null
  const profile = (await getCachedProfile(user.id)) as
    | { role?: string; permissions?: unknown }
    | null
  if (!profile) return null
  // userId is here so callers applying the 'own' data scope can filter on it
  // without a second session lookup.
  return { userId: user.id, role: profile.role ?? 'staff', permissions: profile.permissions }
})

/** The one question pages ask: may the caller do `action` in `module`? */
export async function canDo(module: PermissionModule, action: PermissionAction): Promise<boolean> {
  const ctx = await getPermissionContext()
  if (!ctx) return false
  return can(ctx.role, ctx.permissions, module, action)
}

/** Which records the caller may act on in `module` — 'all' or only their own. */
export async function getDataScope(module: PermissionModule): Promise<DataScope> {
  const ctx = await getPermissionContext()
  if (!ctx) return 'all'
  return dataScope(ctx.role, ctx.permissions, module)
}

/** True when the caller may see `module` at all. Admins always may. */
export async function canViewModule(module: PermissionModule): Promise<boolean> {
  return canDo(module, 'view')
}

/**
 * True when the caller may create/modify inside `module`. Pages use this to
 * drop "Add new" actions rather than rendering controls whose writes the user
 * shouldn't be making.
 */
export async function canEditModule(module: PermissionModule): Promise<boolean> {
  return canDo(module, 'edit')
}

/**
 * Guard for a module's route subtree. Redirects to the dashboard (always
 * reachable — it is not a permissioned module) when the caller lacks view
 * access. Call it from the module's `layout.tsx` so every current and future
 * page underneath inherits the check automatically.
 */
export async function requireModuleView(module: PermissionModule, lang: string): Promise<void> {
  if (!(await canViewModule(module))) {
    redirect(`/${lang}/dashboard?denied=${module}`)
  }
}

/**
 * Guard for a write-only route (a `/new` or `/[id]/edit` page). Sends the user
 * back to the module's list rather than the dashboard, since they are allowed
 * to be here — just not to change anything.
 */
export async function requireModuleEdit(
  module: PermissionModule,
  lang: string,
  listPath: string
): Promise<void> {
  // A "new" page needs `create`; an edit page needs `edit`. Both land here, so
  // accept either — the specific action is re-checked by the API route that
  // performs the write.
  if (!(await canDo(module, 'create')) && !(await canDo(module, 'edit'))) {
    redirect(`/${lang}${listPath}?denied=edit`)
  }
}

/**
 * May the caller edit this one record? Needs `edit` in the section and, short of
 * an `all` level, a record that is theirs or nobody's — the same "mine OR
 * unassigned" rule the scoped lists apply (`queryPage`), so a user can edit
 * what their list shows them. Pass `undefined` for a table with no assignee.
 */
export async function canEditRecord(
  module: PermissionModule,
  resource: string,
  assignedTo: string | null | undefined
): Promise<boolean> {
  if (!(await canResource(module, resource, 'edit'))) return false
  const owners = await getOwnerFilter(module, resource, 'edit')
  if (owners === undefined || !assignedTo) return true
  return Array.isArray(owners) ? owners.includes(assignedTo) : owners === assignedTo
}

/** Guard for a `/[id]/edit` page, once the record is loaded. See `canEditRecord`. */
export async function requireRecordEdit(
  module: PermissionModule,
  resource: string,
  assignedTo: string | null | undefined,
  lang: string,
  listPath: string
): Promise<void> {
  if (!(await canEditRecord(module, resource, assignedTo))) {
    redirect(`/${lang}${listPath}?denied=edit`)
  }
}

/** May the caller do `action` in this section of the module? */
export async function canResource(module: PermissionModule, resource: string, action: LevelAction): Promise<boolean> {
  const ctx = await getPermissionContext()
  if (!ctx) return false
  return accessLevel(ctx.role, ctx.permissions, module, resource, action) !== 'none'
}

/** Guard for a section's route subtree. Call it from the section's `layout.tsx`. */
export async function requireResourceView(module: PermissionModule, resource: string, lang: string): Promise<void> {
  if (!(await canResource(module, resource, 'view'))) {
    redirect(`/${lang}/dashboard?denied=${module}`)
  }
}

/** Guard for a `/new` or `/[id]/edit` page in a section. */
export async function requireResourceAction(
  module: PermissionModule,
  resource: string,
  action: LevelAction,
  lang: string,
  listPath: string
): Promise<void> {
  if (!(await canResource(module, resource, action))) {
    redirect(`/${lang}${listPath}?denied=${action}`)
  }
}

/** The caller's colleagues in their department, themselves included. */
const getDepartmentUserIds = cache(async (userId: string): Promise<string[]> => {
  const supabase = getCacheClient() as any
  const { data: me } = await supabase.from('profiles').select('tenant_id, department_id').eq('id', userId).single()
  if (!me?.department_id) return [userId]
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('tenant_id', me.tenant_id)
    .eq('department_id', me.department_id)
  const ids: string[] = (data ?? []).map((p: { id: string }) => p.id)
  return ids.includes(userId) ? ids : [...ids, userId]
})

/**
 * Whose records a list shows: `undefined` for everyone's, otherwise the user or
 * their department. Pass the result to the query as `ownerId`.
 */
export async function getOwnerFilter(
  module: PermissionModule,
  resource: string,
  action: LevelAction = 'view'
): Promise<string | string[] | undefined> {
  const ctx = await getPermissionContext()
  if (!ctx) return undefined
  const level = accessLevel(ctx.role, ctx.permissions, module, resource, action)
  if (level === 'own') return ctx.userId
  if (level === 'department') return getDepartmentUserIds(ctx.userId)
  return undefined
}

/** Guard for a route that needs one specific action (e.g. an approval screen). */
export async function requireAction(
  module: PermissionModule,
  action: PermissionAction,
  lang: string,
  fallbackPath: string
): Promise<void> {
  if (!(await canDo(module, action))) {
    redirect(`/${lang}${fallbackPath}?denied=${action}`)
  }
}

/**
 * Guard for routes that are admin-only regardless of module permissions.
 *
 * Role templates are the case this exists for: they decide what their holders
 * may see and do, so "can edit HR" must not be enough to author them — that
 * would let a manager mint a role with every module enabled. The matching API
 * routes (/api/tenant/roles/**) enforce the same check server-side; this only
 * keeps a non-admin from landing on a page whose every action would fail.
 */
export async function requireTenantAdmin(lang: string): Promise<void> {
  const ctx = await getPermissionContext()
  if (ctx?.role !== 'admin') {
    redirect(`/${lang}/dashboard?denied=admin`)
  }
}
