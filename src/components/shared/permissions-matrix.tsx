'use client'

import { PermissionLevelsEditor } from '@/components/shared/permission-levels-editor'
import type { Permissions } from '@/lib/permissions'

interface PermissionsMatrixProps {
  value: Permissions
  onChange: (next: Permissions) => void
  disabled?: boolean
}

/**
 * The permissions editor used by the employee form and role templates: every
 * module split into its pages (sections), each action at a level. The older
 * module-only checkbox grid it replaced is gone with the `permissions_v2` flag
 * that held them side by side; grants saved by it are still read (they apply
 * to every page of the module — see accessLevel in src/lib/permissions.ts).
 */
export function PermissionsMatrix(props: PermissionsMatrixProps) {
  return <PermissionLevelsEditor {...props} />
}
