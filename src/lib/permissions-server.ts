import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { hasEditAccess, hasViewAccess, type PermissionModule } from '@/lib/permissions'

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
  return { role: profile.role ?? 'staff', permissions: profile.permissions }
})

/** True when the caller may see `module` at all. Admins always may. */
export async function canViewModule(module: PermissionModule): Promise<boolean> {
  const ctx = await getPermissionContext()
  if (!ctx) return false
  return hasViewAccess(ctx.role, ctx.permissions, module)
}

/**
 * True when the caller may create/modify inside `module`. Pages use this to
 * drop "Add new" actions and row actions rather than rendering controls whose
 * writes the user shouldn't be making.
 */
export async function canEditModule(module: PermissionModule): Promise<boolean> {
  const ctx = await getPermissionContext()
  if (!ctx) return false
  return hasEditAccess(ctx.role, ctx.permissions, module)
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
  if (!(await canEditModule(module))) {
    redirect(`/${lang}${listPath}?denied=edit`)
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
