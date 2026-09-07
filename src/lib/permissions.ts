/**
 * Per-module role-based access control.
 *
 * The original model had two flags per module (`view`, `edit`), which cannot
 * express the distinctions a real ERP needs: a cashier who may create a sale
 * but never delete one, an accountant who may read and export finance but not
 * change it, a manager who is the only person allowed to approve a purchase
 * order. This model follows the shape used by Odoo/Dynamics-class systems:
 * a fixed set of ACTIONS per module, plus a DATA SCOPE.
 *
 * Actions
 *   view    — open the module at all
 *   create  — add new records
 *   edit    — modify existing records
 *   delete  — remove records
 *   export  — download data (Excel). Separate from `view` on purpose: reading
 *             a customer on screen and walking out with the whole customer
 *             list are different risks.
 *   approve — confirm/authorise a record (order confirmation, payment,
 *             purchase receipt). Separate from `edit` so the person who
 *             creates a document need not be the one who approves it.
 *
 * Scope
 *   all  — every record in the tenant
 *   own  — only records this user created. Lets a salesperson see their own
 *          orders without seeing the whole company's.
 *
 * Enforcement, stated honestly: this is an APPLICATION-level boundary. Server
 * Components check it before rendering (src/lib/permissions-server.ts) and the
 * privileged writes go through API routes that re-check it, but RLS still
 * scopes rows per TENANT, not per user-permission. A tenant member who crafts
 * raw PostgREST calls can reach data the UI hides from them. Closing that means
 * expressing these rules in SQL policies — a separate migration, deliberately
 * not claimed here.
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
}

export type Permissions = Partial<Record<PermissionModule, ModulePermission>>

/** No access granted by default — an admin turns modules on explicitly (least privilege). */
export const EMPTY_PERMISSIONS: Permissions = {}

export const NO_MODULE_ACCESS: ModulePermission = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  export: false,
  approve: false,
  scope: 'all',
}

/**
 * Some modules have no meaningful "approve" step — there is nothing to
 * authorise in Analytics or Settings — so the matrix hides that column rather
 * than offering a checkbox that does nothing.
 */
export const APPROVABLE_MODULES: readonly PermissionModule[] = [
  'sales',
  'procurement',
  'finance',
  'hr',
]

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
    return {
      view: !!value.view || edit,
      create: edit,
      edit,
      delete: false,
      export: false,
      approve: false,
      scope: 'all',
    }
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
    out[moduleKey] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
      export: true,
      approve: true,
      scope: 'all',
    }
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

export function hasViewAccess(role: string | null | undefined, permissions: unknown, module: PermissionModule): boolean {
  return can(role, permissions, module, 'view')
}

export function hasEditAccess(role: string | null | undefined, permissions: unknown, module: PermissionModule): boolean {
  return can(role, permissions, module, 'edit')
}
