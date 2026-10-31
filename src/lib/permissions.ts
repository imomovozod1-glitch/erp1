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
  'production',
  'sales',
  'distribution',
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
  /** With scope 'own': colleagues in the user's department count as their own. */
  department?: boolean
  /**
   * Per-section levels, written by the new editor. The flags above are then a
   * summary of them (`flattenLevels`), which is what keeps every module-level
   * check and the SQL `app_can` / `app_data_scope` working unchanged.
   */
  levels?: ModuleLevels
}

export const ACCESS_LEVELS = ['none', 'own', 'department', 'all'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

export type LevelAction = Exclude<PermissionAction, 'approve'>
export type ResourceLevels = Partial<Record<LevelAction, AccessLevel>>
export type ModuleLevels = Record<string, ResourceLevels>

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

const ALL_ACTIONS: LevelAction[] = ['create', 'view', 'edit', 'delete', 'export']
const CRUD: LevelAction[] = ['create', 'view', 'edit', 'delete']
const WRITE_READ: LevelAction[] = ['create', 'view', 'edit']

export interface PermissionResource {
  key: string
  actions: LevelAction[]
  /** The table has `assigned_to`, so "if responsible" and "by department" mean something. */
  ownable?: boolean
  /** Route under the locale, for the sidebar and the page guards. */
  path?: string
}

/** The sections of each module, in sidebar order. `main` = the module has none. */
export const PERMISSION_RESOURCES: Record<PermissionModule, PermissionResource[]> = {
  analytics: [{ key: 'main', actions: ['view', 'export'] }],
  pos: [{ key: 'main', actions: ['view'] }],
  inventory: [
    { key: 'products', actions: ALL_ACTIONS, ownable: true, path: 'inventory/products' },
    { key: 'services', actions: ALL_ACTIONS, ownable: true, path: 'inventory/services' },
    { key: 'categories', actions: CRUD, path: 'inventory/categories' },
    { key: 'movements', actions: ['view'], path: 'inventory/movements' },
    { key: 'units', actions: CRUD, path: 'inventory/units' },
  ],
  production: [
    { key: 'orders', actions: CRUD, ownable: true, path: 'production/orders' },
    { key: 'boms', actions: CRUD, path: 'production/boms' },
  ],
  sales: [
    { key: 'orders', actions: WRITE_READ, ownable: true, path: 'sales/orders' },
    { key: 'invoices', actions: WRITE_READ, ownable: true, path: 'sales/invoices' },
  ],
  distribution: [
    { key: 'deliveries', actions: CRUD, ownable: true, path: 'distribution/deliveries' },
    { key: 'routes', actions: CRUD, path: 'distribution/routes' },
  ],
  customers: [
    { key: 'list', actions: ALL_ACTIONS, ownable: true, path: 'customers' },
    { key: 'categories', actions: CRUD, path: 'customers/categories' },
  ],
  procurement: [
    { key: 'purchases', actions: WRITE_READ, ownable: true, path: 'procurement/purchase-orders' },
    { key: 'suppliers', actions: ['create', 'view', 'edit', 'export'], ownable: true, path: 'procurement/suppliers' },
  ],
  finance: [
    { key: 'cashbox', actions: CRUD, path: 'finance/cashbox' },
    { key: 'transactions', actions: WRITE_READ, ownable: true, path: 'finance/transactions' },
    { key: 'categories', actions: CRUD, path: 'finance/categories' },
  ],
  hr: [{ key: 'employees', actions: ['create', 'view', 'edit', 'export'], path: 'hr/employees' }],
  settings: [{ key: 'main', actions: ['view'] }],
}

/** Levels a cell offers: creating has no record to be responsible for yet. */
export function levelsFor(resource: PermissionResource, action: LevelAction): readonly AccessLevel[] {
  return resource.ownable && action !== 'create' ? ACCESS_LEVELS : ['none', 'all']
}

function sanitiseLevels(raw: unknown): ModuleLevels {
  const out: ModuleLevels = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [resource, actions] of Object.entries(raw as Record<string, unknown>)) {
    if (!actions || typeof actions !== 'object') continue
    const clean: ResourceLevels = {}
    for (const action of ALL_ACTIONS) {
      const level = (actions as Record<string, unknown>)[action]
      if (ACCESS_LEVELS.includes(level as AccessLevel)) clean[action] = level as AccessLevel
    }
    out[resource] = clean
  }
  return out
}

/**
 * The module-level summary of a section grid. An action is on if any section
 * has it. The scope takes the NARROWEST level in use: `app_owns` and the other
 * module-level readers then never allow more than a section does. `department`
 * is its own flag because SQL from before these levels reads anything but
 * 'own' as 'all'.
 */
export function flattenLevels(levels: ModuleLevels): ModulePermission {
  const used = Object.values(levels).flatMap((actions) =>
    ALL_ACTIONS.filter((action) => (actions[action] ?? 'none') !== 'none').map((action) => ({
      action,
      level: actions[action] as AccessLevel,
    }))
  )
  const has = (action: LevelAction) => used.some((u) => u.action === action)
  const own = used.some((u) => u.level === 'own')
  const department = used.some((u) => u.level === 'department')
  return {
    view: used.length > 0,
    create: has('create'),
    edit: has('edit'),
    delete: has('delete'),
    export: has('export'),
    approve: false,
    scope: own || department ? 'own' : 'all',
    ...(department && !own ? { department: true } : {}),
    levels,
  }
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
  if (entry.levels) return entry.levels[resource]?.[action] ?? 'none'
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
