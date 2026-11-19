/**
 * Per-module role-based access control: a fixed set of ACTIONS per module
 * (view, create, edit, delete, export, approve) plus a DATA SCOPE (all / own).
 * `export` is separate from `view` because reading a record on screen and
 * walking out with the whole list are different risks; `approve` is separate
 * from `edit` so the author of a document need not be the one who approves it.
 *
 * This is an APPLICATION-level boundary: pages and API routes check it, but RLS
 * scopes rows per tenant only, so raw PostgREST calls can reach what the UI hides.
 */

import { PERMISSION_RESOURCES, sanitiseLevels, type AccessLevel } from '@/lib/permission-resources'

export { ACCESS_LEVELS, PERMISSION_RESOURCES, flattenLevels, levelsFor, type AccessLevel, type PermissionResource } from '@/lib/permission-resources'

export const PERMISSION_MODULES = ['analytics', 'pos', 'inventory', 'production', 'sales', 'distribution', 'customers', 'procurement', 'finance', 'hr', 'settings'] as const

export type PermissionModule = (typeof PERMISSION_MODULES)[number]

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

export const DATA_SCOPES = ['all', 'own'] as const
export type DataScope = (typeof DATA_SCOPES)[number]

export interface ModulePermission {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
  export: boolean
  approve: boolean
  /** Whose records this user may act on within the module. Defaults to 'all'. */
  scope: DataScope
  /** With scope 'own': colleagues in the user's department count as their own. */
  department?: boolean
  /**
   * Per-section levels, written by the new editor. The flags above are then a
   * summary of them (`flattenLevels`), which is what keeps every module-level
   * check and the SQL `app_can` / `app_data_scope` working unchanged.
   */
  levels?: ModuleLevels
}

export type LevelAction = Exclude<PermissionAction, 'approve'>
export type ResourceLevels = Partial<Record<LevelAction, AccessLevel>>
export type ModuleLevels = Record<string, ResourceLevels>

export type Permissions = Partial<Record<PermissionModule, ModulePermission>>

/** No access granted by default — an admin turns modules on explicitly (least privilege). */
export const EMPTY_PERMISSIONS: Permissions = {}

export const NO_MODULE_ACCESS: ModulePermission = { view: false, create: false, edit: false, delete: false, export: false, approve: false, scope: 'all' }

/**
 * Some modules have no meaningful "approve" step — there is nothing to
 * authorise in Analytics or Settings — so the matrix hides that column rather
 * than offering a checkbox that does nothing.
 */
export const APPROVABLE_MODULES: readonly PermissionModule[] = ['sales', 'procurement', 'finance', 'hr']

/**
 * Modules the matrix offers. Distribution is hidden from the sidebar for now
 * (app-sidebar.tsx), so it is left out here too; add it back with the sidebar.
 * It stays in PERMISSION_MODULES: its pages keep their guard and stored grants
 * keep their meaning.
 */
export const MATRIX_MODULES = PERMISSION_MODULES.filter((module) => module !== 'distribution')

/**
 * Actions the matrix offers. `approve` is left out: nothing in the product asks
 * for it, so its checkbox granted nothing.
 */
export const MATRIX_ACTIONS = PERMISSION_ACTIONS.filter((action) => action !== 'approve')

export function moduleSupportsApproval(module: PermissionModule): boolean {
  return APPROVABLE_MODULES.includes(module)
}

/**
 * Reads a stored permission blob into the current shape.
 *
 * Existing rows hold the old `{ view, edit }` pair, so they are upgraded on
 * read rather than by a data migration: `edit: true` implied the ability to
 * create and modify, so it maps to create+edit, while delete/export/approve
 * start off FALSE. That is the safe direction — an upgrade must not silently
 * hand anyone a capability they were never granted, and an admin can turn the
 * new ones on deliberately.
 */
export function normaliseModulePermission(raw: unknown): ModulePermission {
  if (!raw || typeof raw !== 'object') return { ...NO_MODULE_ACCESS }
  const value = raw as Partial<ModulePermission> & { edit?: boolean; view?: boolean }

  const legacy = value.create === undefined && value.delete === undefined
  if (legacy) {
    const edit = !!value.edit
    return { ...NO_MODULE_ACCESS, view: !!value.view || edit, create: edit, edit }
  }

  // Edit/create/delete/approve are meaningless without being able to open the
  // module, so any of them implies view.
  const create = !!value.create
  const edit = !!value.edit
  const del = !!value.delete
  const approve = !!value.approve
  const exp = !!value.export
  return {
    view: !!value.view || create || edit || del || approve || exp,
    create,
    edit,
    delete: del,
    export: exp,
    approve,
    scope: value.scope === 'own' ? 'own' : 'all',
    ...(value.department === true ? { department: true } : {}),
    ...(value.levels ? { levels: sanitiseLevels(value.levels) } : {}),
  }
}

export function normalisePermissions(raw: unknown): Permissions {
  if (!raw || typeof raw !== 'object') return {}
  const out: Permissions = {}
  for (const moduleKey of PERMISSION_MODULES) {
    const entry = (raw as Record<string, unknown>)[moduleKey]
    if (entry) out[moduleKey] = normaliseModulePermission(entry)
  }
  return out
}

/** Full access to everything — what `role: 'admin'` resolves to. */
export function allPermissions(): Permissions {
  const out: Permissions = {}
  for (const moduleKey of PERMISSION_MODULES) {
    out[moduleKey] = { view: true, create: true, edit: true, delete: true, export: true, approve: true, scope: 'all' }
  }
  return out
}

/** The single question every caller asks. Admins always pass. */
export function can(
  role: string | null | undefined,
  permissions: unknown,
  module: PermissionModule,
  action: PermissionAction
): boolean {
  if (role === 'admin') return true
  const entry = normalisePermissions(permissions)[module]
  if (!entry) return false
  return entry[action] === true
}

/** Which records this user may act on in a module. Admins always see everything. */
export function dataScope(
  role: string | null | undefined,
  permissions: unknown,
  module: PermissionModule
): DataScope {
  if (role === 'admin') return 'all'
  return normalisePermissions(permissions)[module]?.scope ?? 'all'
}

// ─── Backwards-compatible helpers ─────────────────────────────────────────────
// Kept so existing call sites keep working; new code should use `can()`.

/** Keeps only known modules and normalises each, so a hand-built payload can't store an incoherent combination. */
export function pickKnownPermissions(permissions: Record<string, unknown> | undefined) {
  if (!permissions) return undefined
  const known: Record<string, ModulePermission> = {}
  for (const moduleKey of PERMISSION_MODULES) {
    const entry = permissions[moduleKey]
    if (entry) known[moduleKey] = normaliseModulePermission(entry)
  }
  return known
}

/** How far `action` reaches in one section. */
export function accessLevel(
  role: string | null | undefined,
  permissions: unknown,
  module: PermissionModule,
  resource: string,
  action: LevelAction
): AccessLevel {
  if (role === 'admin') return 'all'
  const entry = normalisePermissions(permissions)[module]
  if (!entry) return 'none'
  if (entry.levels) {
    // Saved before this module was split into sections: its one `main` row
    // stood for every page, and still does until the grant is edited.
    const section = entry.levels[resource] ?? entry.levels.main
    return section?.[action] ?? 'none'
  }
  // Saved by the older editor: the module's flags apply to every section.
  if (!entry[action]) return 'none'
  const ownable = PERMISSION_RESOURCES[module].find((r) => r.key === resource)?.ownable
  return entry.scope === 'own' && ownable && action !== 'create' ? 'own' : 'all'
}

export function canResource(
  role: string | null | undefined,
  permissions: unknown,
  module: PermissionModule,
  resource: string,
  action: LevelAction
): boolean {
  return accessLevel(role, permissions, module, resource, action) !== 'none'
}

export function hasViewAccess(role: string | null | undefined, permissions: unknown, module: PermissionModule): boolean {
  return can(role, permissions, module, 'view')
}

export function hasEditAccess(role: string | null | undefined, permissions: unknown, module: PermissionModule): boolean {
  return can(role, permissions, module, 'edit')
}
