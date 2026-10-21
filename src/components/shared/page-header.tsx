import { cn } from '@/lib/utils'
import { ChevronRight, LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageInfoButton } from '@/components/shared/page-info-button'
import { BackButton } from '@/components/shared/back-button'
import Link from 'next/link'

/**
 * The page's primary action. On desktop it is a button in the header; on a
 * phone it floats above the bottom navigation as a pill (the app design's
 * "+ Yangi …" button), where the thumb already is. The pages' content has room
 * under it — the dashboard layout pads `main` by the nav plus this.
 */
const ACTION_CLASS =
  'gap-1.5 max-md:fixed max-md:right-4 max-md:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] max-md:z-30 ' +
  'max-md:h-12 max-md:rounded-full max-md:px-5 max-md:text-sm max-md:font-semibold max-md:shadow-brand-lg'

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
    <div className={cn('mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start md:mb-6 md:gap-4', className)}>
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground max-md:-mx-4 max-md:overflow-x-auto max-md:px-4 max-md:pb-0.5 max-md:[scrollbar-width:none] md:mb-1 [&::-webkit-scrollbar]:hidden"
          >
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1
              // Phones: a trail of pills — links lavender, the current page solid violet.
              const pill = cn(
                'whitespace-nowrap max-md:rounded-full max-md:px-3 max-md:py-1.5 max-md:font-semibold',
                last
                  ? 'text-foreground max-md:bg-violet-700 max-md:text-white dark:max-md:bg-violet-500'
                  : 'max-md:bg-violet-100 max-md:text-violet-800 dark:max-md:bg-violet-500/15 dark:max-md:text-violet-200'
              )
              return (
                <span key={i} className="flex shrink-0 items-center gap-1.5">
                  {i > 0 && <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 max-md:block md:hidden" aria-hidden="true" />}
                  {i > 0 && <span className="max-md:hidden">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className={cn('transition-colors hover:text-foreground', pill)}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={pill}>{crumb.label}</span>
                  )}
                </span>
              )
            })}
          </nav>
        )}
        <div className="flex items-center gap-2">
          {/* Phones: the back control lives in the app bar (app-header.tsx). */}
          {back !== false && <BackButton href={typeof back === 'string' ? back : undefined} className="max-md:hidden" />}
          <h1 className="min-w-0 text-xl font-extrabold tracking-tight break-words text-slate-900 md:text-2xl md:font-bold dark:text-slate-100">{title}</h1>
          {info && <PageInfoButton text={info} />}
        </div>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground md:mt-1 md:text-sm">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 max-md:-mx-4 max-md:overflow-x-auto max-md:px-4 max-md:pb-1 max-md:[scrollbar-width:none] max-md:empty:hidden md:flex-wrap sm:shrink-0 [&::-webkit-scrollbar]:hidden">
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
              className={ACTION_CLASS}
            >
              {ActionIcon && <ActionIcon className="h-4 w-4" />}
              {action.label}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={action.onClick}
              className={ACTION_CLASS}
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
