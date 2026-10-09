import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageInfoButton } from '@/components/shared/page-info-button'
import { BackButton } from '@/components/shared/back-button'
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
  /**
   * Back control. Rendered on every page by default — the dashboard is the
   * only route with nothing above it, and BackButton returns null there of its
   * own accord. Pass `false` to suppress it, or a path to override where it
   * goes when there is no in-app history to return to.
   */
  back?: boolean | string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  info,
  action,
  breadcrumbs,
  back = true,
  children,
  className,
}: PageHeaderProps) {
  const ActionIcon = action?.icon

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6', className)}>
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
        <div className="flex items-center gap-2">
          {back !== false && <BackButton href={typeof back === 'string' ? back : undefined} />}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
          {info && <PageInfoButton text={info} />}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {children}
        {action && (
          // Both variants are the same Button so a link action and a click
          // action look identical. nativeButton={false}: with `href` the
          // rendered element is an <a>, and Base UI warns when a button-role
          // component is not a real <button>.
          action.href ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={action.href} prefetch={true} />}
              className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
            >
              {ActionIcon && <ActionIcon className="h-4 w-4" />}
              {action.label}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={action.onClick}
              className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
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
