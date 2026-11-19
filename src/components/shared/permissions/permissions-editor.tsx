'use client'

import { useToggleSet } from '@/lib/hooks/use-toggle-set'
import { MATRIX_MODULES, type PermissionModule, type Permissions } from '@/lib/permissions'
import { buildEditorModel } from './editor-model'
import { EditorToolbar } from './editor-toolbar'
import { ModuleCard } from './module-card'

export interface PermissionsEditorProps {
  value: Permissions
  onChange: (next: Permissions) => void
  disabled?: boolean
}

export function PermissionsEditor({ value, onChange, disabled }: PermissionsEditorProps) {
  const editor = buildEditorModel(value, onChange)
  const expanded = useToggleSet<PermissionModule>()
  const allOpen = expanded.items.size === MATRIX_MODULES.length

  return (
    <div className="space-y-3">
      <EditorToolbar
        allOpen={allOpen}
        onToggleAll={() => expanded.replace(allOpen ? [] : MATRIX_MODULES)}
        onGrantEverything={editor.setEverything}
        disabled={disabled}
      />
      {editor.modules.map((module) => (
        <ModuleCard
          key={module.module}
          module={module}
          open={expanded.has(module.module)}
          onToggle={() => expanded.toggle(module.module)}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
