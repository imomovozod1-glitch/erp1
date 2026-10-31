'use client'

/**
 * The signed-in user's permissions, for client components.
 *
 * Fed once by the dashboard layout, so a table can ask `useCan('inventory',
 * 'delete')` without a prop passed down from its page. This only decides what
 * to offer: plain browser writes are not checked by RLS (see
 * src/lib/permissions.ts), so it is a UI gate, not a security boundary.
 *
 * Outside the provider everything reads as not allowed.
 */

import { createContext, useContext, useMemo } from 'react'
import { can, canResource, type LevelAction, type PermissionAction, type PermissionModule } from '@/lib/permissions'

interface PermissionsValue {
  role: string | null | undefined
  permissions: unknown
}

const PermissionsContext = createContext<PermissionsValue>({ role: null, permissions: null })

export function PermissionsProvider({
  role,
  permissions,
  children,
}: PermissionsValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ role, permissions }), [role, permissions])
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

/** With `resource`, asks about that section of the module rather than the module as a whole. */
export function useCan(module: PermissionModule, action: PermissionAction, resource?: string): boolean {
  const { role, permissions } = useContext(PermissionsContext)
  return resource
    ? canResource(role, permissions, module, resource, action as LevelAction)
    : can(role, permissions, module, action)
}
