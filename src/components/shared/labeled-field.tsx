import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface LabeledFieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  aside?: ReactNode
  icon?: LucideIcon
  badge?: ReactNode
  compact?: boolean
  className?: string
  children: ReactNode
}

export function LabeledField({ id, label, required, error, aside, icon: Icon, badge, compact, className, children }: LabeledFieldProps) {
  return (
    <div className={cn(compact ? 'space-y-1.5' : 'space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className={cn('flex items-center gap-1.5', (compact || Icon) && 'text-xs font-semibold text-muted-foreground')}>
          {Icon && <Icon className="size-3.5" />}
          {label}
          {required && ' *'}
          {badge}
        </Label>
        {aside}
      </div>
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
