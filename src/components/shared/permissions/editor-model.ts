import {
  MATRIX_MODULES,
  PERMISSION_RESOURCES,
  flattenLevels,
  type LevelAction,
  type ModuleLevels,
  type PermissionModule,
  type PermissionResource,
  type Permissions,
  type ResourceLevels,
} from '@/lib/permissions'
import {
  combineTicks,
  readModule,
  scopeOf,
  tickOf,
  tickedOf,
  withAction,
  withAll,
  withScope,
  type Scope,
  type Tick,
} from './permission-model'

export interface SectionModel {
  module: PermissionModule
  resource: PermissionResource
  tick: Tick
  ticked: Set<LevelAction>
  scope: Scope
  toggle: (action: LevelAction, on: boolean) => void
  setScope: (scope: Scope) => void
  setAll: (on: boolean) => void
}

export interface ModuleModel {
  module: PermissionModule
  sections: SectionModel[]
  tick: Tick
  granted: number
  setAll: (on: boolean) => void
}

export interface EditorModel {
  modules: ModuleModel[]
  setEverything: (on: boolean) => void
}

const grantModule = (module: PermissionModule, on: boolean): ModuleLevels =>
  Object.fromEntries(PERMISSION_RESOURCES[module].map((resource) => [resource.key, withAll(resource, on)]))

export function buildEditorModel(value: Permissions, onChange: (next: Permissions) => void): EditorModel {
  const writeModule = (module: PermissionModule, levels: ModuleLevels) =>
    onChange({ ...value, [module]: flattenLevels(levels) })

  const writeSection = (module: PermissionModule, key: string, section: ResourceLevels) =>
    writeModule(module, { ...readModule(value, module), [key]: section })

  const sectionModel = (module: PermissionModule, resource: PermissionResource, section: ResourceLevels) => {
    const scope = scopeOf(resource, section)
    const write = (next: ResourceLevels) => writeSection(module, resource.key, next)
    return {
      module,
      resource,
      scope,
      tick: tickOf(resource, section),
      ticked: tickedOf(resource, section),
      toggle: (action, on) => write(withAction(resource, section, action, on)),
      setScope: (next) => write(withScope(resource, section, next)),
      setAll: (on) => write(withAll(resource, on, scope)),
    } satisfies SectionModel
  }

  const moduleModel = (module: PermissionModule): ModuleModel => {
    const levels = readModule(value, module)
    const sections = PERMISSION_RESOURCES[module].map((resource) => sectionModel(module, resource, levels[resource.key]))
    return {
      module,
      sections,
      tick: combineTicks(sections.map((section) => section.tick)),
      granted: sections.filter((section) => section.tick !== 'none').length,
      setAll: (on) => writeModule(module, grantModule(module, on)),
    }
  }

  const setEverything = (on: boolean) =>
    onChange({
      ...value,
      ...Object.fromEntries(MATRIX_MODULES.map((module) => [module, flattenLevels(grantModule(module, on))])),
    })

  return { modules: MATRIX_MODULES.map(moduleModel), setEverything }
}
