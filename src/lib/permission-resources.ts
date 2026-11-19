import type { LevelAction, ModuleLevels, ModulePermission, PermissionModule, ResourceLevels } from '@/lib/permissions'

export const ACCESS_LEVELS = ['none', 'own', 'department', 'all'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

export const ALL_ACTIONS: LevelAction[] = ['create', 'view', 'edit', 'delete', 'export']
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
  analytics: [
    { key: 'sales', actions: ['view'], path: 'reports/sales' },
    { key: 'employees', actions: ['view'], path: 'reports/employees' },
    { key: 'customers', actions: ['view'], path: 'reports/customers' },
    { key: 'products', actions: ['view'], path: 'reports/products' },
    { key: 'abc', actions: ['view'], path: 'reports/abc' },
    // The free-form builder on the /reports hub; exporting is its own right.
    { key: 'builder', actions: ['view', 'export'] },
  ],
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
  settings: [
    { key: 'company', actions: ['view'], path: 'settings/company' },
    { key: 'printer', actions: ['view'], path: 'settings/printer' },
    { key: 'integrations', actions: ['view'], path: 'settings/integrations' },
  ],
}

/** Levels a cell offers: creating has no record to be responsible for yet. */
export function levelsFor(resource: PermissionResource, action: LevelAction): readonly AccessLevel[] {
  return resource.ownable && action !== 'create' ? ACCESS_LEVELS : ['none', 'all']
}

export function sanitiseLevels(raw: unknown): ModuleLevels {
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
