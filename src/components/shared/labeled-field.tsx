import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface LabeledFieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  aside?: ReactNode
  compact?: boolean
  className?: string
  children: ReactNode
}

export function LabeledField({ id, label, required, error, aside, compact, className, children }: LabeledFieldProps) {
  return (
    <div className={cn(compact ? 'space-y-1.5' : 'space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className={cn(compact && 'text-xs font-semibold text-muted-foreground')}>
          {label}
          {required && ' *'}
        </Label>
        {aside}
      </div>
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
