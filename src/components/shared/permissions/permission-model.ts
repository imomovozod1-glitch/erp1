import {
  PERMISSION_RESOURCES,
  accessLevel,
  type AccessLevel,
  type LevelAction,
  type ModuleLevels,
  type PermissionModule,
  type PermissionResource,
  type Permissions,
  type ResourceLevels,
} from '@/lib/permissions'

export type Scope = Exclude<AccessLevel, 'none'>
export type Tick = 'all' | 'some' | 'none'

export const SCOPES: readonly Scope[] = ['own', 'department', 'all']
export const ACTIONS: readonly LevelAction[] = ['view', 'create', 'edit', 'delete', 'export']

const RANK: Record<AccessLevel, number> = { none: 0, own: 1, department: 2, all: 3 }

export const actionsOf = (resource: PermissionResource) =>
  ACTIONS.filter((action) => resource.actions.includes(action))

export function readModule(value: Permissions, module: PermissionModule): ModuleLevels {
  return Object.fromEntries(
    PERMISSION_RESOURCES[module].map((resource) => [resource.key, readSection(value, module, resource)])
  )
}

function readSection(value: Permissions, module: PermissionModule, resource: PermissionResource): ResourceLevels {
  return Object.fromEntries(
    resource.actions.map((action) => [action, accessLevel('staff', value, module, resource.key, action)])
  )
}

export function tickedOf(resource: PermissionResource, section: ResourceLevels): Set<LevelAction> {
  return new Set(resource.actions.filter((action) => (section[action] ?? 'none') !== 'none'))
}

export function tickOf(resource: PermissionResource, section: ResourceLevels): Tick {
  const count = tickedOf(resource, section).size
  if (count === 0) return 'none'
  return count === resource.actions.length ? 'all' : 'some'
}

export function combineTicks(ticks: Tick[]): Tick {
  if (ticks.every((tick) => tick === 'all')) return 'all'
  if (ticks.every((tick) => tick === 'none')) return 'none'
  return 'some'
}

export function scopeOf(resource: PermissionResource, section: ResourceLevels): Scope {
  const widest = resource.actions
    .filter((action) => action !== 'create')
    .map((action) => section[action] ?? 'none')
    .reduce<AccessLevel>((wide, level) => (RANK[level] > RANK[wide] ? level : wide), 'none')
  return resource.ownable && widest !== 'none' ? widest : 'all'
}

function levelFor(resource: PermissionResource, action: LevelAction, on: boolean, scope: Scope): AccessLevel {
  if (!on) return 'none'
  return resource.ownable && action !== 'create' ? scope : 'all'
}

function buildSection(resource: PermissionResource, ticked: Set<LevelAction>, scope: Scope): ResourceLevels {
  return Object.fromEntries(
    resource.actions.map((action) => [action, levelFor(resource, action, ticked.has(action), scope)])
  )
}

function nextTicked(resource: PermissionResource, ticked: Set<LevelAction>, action: LevelAction, on: boolean) {
  if (!on && action === 'view') return new Set<LevelAction>()
  const next = new Set(ticked)
  if (!on) {
    next.delete(action)
    return next
  }
  next.add(action)
  if (resource.actions.includes('view')) next.add('view')
  return next
}

export function withAction(resource: PermissionResource, section: ResourceLevels, action: LevelAction, on: boolean) {
  const ticked = nextTicked(resource, tickedOf(resource, section), action, on)
  return buildSection(resource, ticked, scopeOf(resource, section))
}

export const withScope = (resource: PermissionResource, section: ResourceLevels, scope: Scope) =>
  buildSection(resource, tickedOf(resource, section), scope)

export const withAll = (resource: PermissionResource, on: boolean, scope: Scope = 'all') =>
  buildSection(resource, new Set(on ? resource.actions : []), scope)
