import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageInfoButton } from '@/components/shared/page-info-button'
import Link from 'next/link'

interface PageHeaderProps {
  title: string
  subtitle?: string
  info?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
    icon?: LucideIcon
  }
  breadcrumbs?: { label: string; href?: string }[]
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  info,
  action,
  breadcrumbs,
  children,
  className,
}: PageHeaderProps) {
  const ActionIcon = action?.icon

  return (
    <div className={cn('flex items-start justify-between gap-4 mb-6', className)}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
          {info && <PageInfoButton text={info} />}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {action && (
          action.href ? (
            <Link
              href={action.href}
              prefetch={true}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[0.8rem] font-medium rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
              {action.label}
            </Link>
          ) : (
            <Button
              size="sm"
              onClick={action.onClick}
              className="bg-violet-600 hover:bg-violet-500 gap-1.5"
            >
              {ActionIcon && <ActionIcon className="h-4 w-4" />}
              {action.label}
            </Button>
          )
        )}
      </div>
    </div>
  )
}
