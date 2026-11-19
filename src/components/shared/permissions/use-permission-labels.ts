'use client'

import { useTranslations } from 'next-intl'
import type { LevelAction, PermissionModule, PermissionResource } from '@/lib/permissions'
import type { Scope } from './permission-model'

interface SectionRef {
  module: PermissionModule
  resource: PermissionResource
}

export function usePermissionLabels() {
  const t = useTranslations()

  const moduleName = (module: PermissionModule) => t(`nav.${module}`)
  const sectionName = ({ module, resource }: SectionRef) =>
    resource.key === 'main' ? moduleName(module) : t(`permissions.resource_${module}_${resource.key}`)

  return {
    t,
    moduleName,
    sectionName,
    actionName: (action: LevelAction) => t(`permissions.action_${action}`),
    scopeName: (scope: Scope) => t(`permissions.scopeShort_${scope}`),
  }
}
