/**
 * Granular per-module UI permissions for non-admin users (see
 * supabase/migration_permissions.sql). Deliberately UI-level only — not an
 * RLS/security boundary. `admin` role always has full access; `manager`/
 * `staff` visibility is gated by the `view`/`edit` flags stored on
 * `profiles.permissions`, keyed by the module names below (which match
 * `src/components/layout/app-sidebar.tsx`'s NAV_ITEMS keys 1:1 so the
 * permission matrix maps directly onto what a user sees in the sidebar).
 */

export const PERMISSION_MODULES = [
  'analytics',
  'pos',
  'inventory',
  'sales',
  'customers',
  'procurement',
  'finance',
  'hr',
  'settings',
] as const

export type PermissionModule = (typeof PERMISSION_MODULES)[number]

export interface ModulePermission {
  view: boolean
  edit: boolean
}

export type Permissions = Partial<Record<PermissionModule, ModulePermission>>

/** No access granted by default — an admin must explicitly turn modules on (least privilege). */
export const EMPTY_PERMISSIONS: Permissions = {}

function normalize(permissions: unknown): Permissions {
  return permissions && typeof permissions === 'object' ? (permissions as Permissions) : {}
}

/** Admins always have full access and never consult the permissions column. */
export function hasViewAccess(role: string | null | undefined, permissions: unknown, module: PermissionModule): boolean {
  if (role === 'admin') return true
  return !!normalize(permissions)[module]?.view
}

export function hasEditAccess(role: string | null | undefined, permissions: unknown, module: PermissionModule): boolean {
  if (role === 'admin') return true
  return !!normalize(permissions)[module]?.edit
}
