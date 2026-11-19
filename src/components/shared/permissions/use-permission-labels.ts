'use client'

import { useTranslations } from 'next-intl'
import type { LevelAction, PermissionModule, PermissionResource } from '@/lib/permissions'
import { NAV_ITEMS } from '@/components/layout/sidebar/nav-items'
import type { Scope } from './permission-model'

/** Sidebar label key per page path: a section is named exactly as its sidebar link. */
const SIDEBAR_LABELS = new Map(NAV_ITEMS.flatMap((item) => (item.subItems ?? []).map((sub) => [sub.href, sub.label] as const)))

interface SectionRef {
  module: PermissionModule
  resource: PermissionResource
}

export function usePermissionLabels() {
  const t = useTranslations()

  const moduleName = (module: PermissionModule) => t(`nav.${module}`)
  // Pages without a sidebar link of their own (report and settings tabs) keep their own names.
  const sectionName = ({ module, resource }: SectionRef) => {
    if (resource.key === 'main') return moduleName(module)
    const sidebarLabel = resource.path && SIDEBAR_LABELS.get(resource.path)
    return t(sidebarLabel || `permissions.resource_${module}_${resource.key}`)
  }

  return {
    t,
    moduleName,
    sectionName,
    actionName: (action: LevelAction) => t(`permissions.action_${action}`),
    scopeName: (scope: Scope) => t(`permissions.scopeShort_${scope}`),
  }
}
