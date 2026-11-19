'use client'

import {
  ChevronDown,
  Contact,
  DollarSign,
  Factory,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PermissionModule } from '@/lib/permissions'
import type { ModuleModel } from './editor-model'
import { SectionCard } from './section-card'
import { TickCheckbox } from './section-parts'
import { SectionTable } from './section-table'
import { usePermissionLabels } from './use-permission-labels'

const MODULE_ICON: Partial<Record<PermissionModule, LucideIcon>> = {
  analytics: TrendingUp,
  pos: Store,
  inventory: Package,
  sales: ShoppingCart,
  customers: Contact,
  procurement: Truck,
  finance: DollarSign,
  hr: Users,
  production: Factory,
  settings: Settings,
}

interface ModuleCardProps {
  module: ModuleModel
  open: boolean
  onToggle: () => void
  disabled?: boolean
}

export function ModuleCard({ module, open, onToggle, disabled }: ModuleCardProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border bg-card transition-shadow duration-200',
        open ? 'border-violet-200 shadow-sm dark:border-violet-900/60' : 'border-border/60 hover:shadow-sm'
      )}
    >
      <ModuleHeader module={module} open={open} onToggle={onToggle} disabled={disabled} />
      {open && (
        <div className="border-t border-border/60">
          <div className="max-md:hidden">
            <SectionTable module={module} disabled={disabled} />
          </div>
          <div className="space-y-2.5 bg-muted/20 p-3 md:hidden">
            {module.sections.map((section) => (
              <SectionCard key={section.resource.key} section={section} disabled={disabled} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ModuleHeader({ module, open, onToggle, disabled }: ModuleCardProps) {
  const { t, moduleName } = usePermissionLabels()
  const name = moduleName(module.module)
  return (
    <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
      <TickCheckbox
        size="lg"
        tick={module.tick}
        onChange={module.setAll}
        disabled={disabled}
        aria-label={`${name} — ${t('permissions.selectModule')}`}
      />
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <ModuleIcon module={module.module} active={module.tick !== 'none'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          {module.sections.length > 1 && (
            <span className="block text-xs text-muted-foreground tabular-nums">
              {t('permissions.sectionsCount', { on: module.granted, total: module.sections.length })}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
    </div>
  )
}

function ModuleIcon({ module, active }: { module: PermissionModule; active: boolean }) {
  const Icon = MODULE_ICON[module] ?? ShieldCheck
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
        active ? 'bg-brand-subtle text-violet-700 dark:text-violet-300' : 'bg-muted text-muted-foreground'
      )}
    >
      <Icon className="size-4.5" />
    </span>
  )
}
