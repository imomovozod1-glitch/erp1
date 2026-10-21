'use client'

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The phone view of a list: cards instead of table rows (the "Inventory",
 * "Orders", "Customers" … screens of the app design).
 *
 * A table is the right shape on a wide screen and the wrong one on a phone —
 * seven columns either shrink to unreadable or scroll sideways. A list screen
 * therefore renders BOTH from the same rows: its `<Table>` gets
 * `containerClassName="max-md:hidden"` and a `<MobileCardList>` sits next to it
 * (`md:hidden`). Only one is ever visible; the other is `display: none`.
 *
 * `MobileCardList` carries `data-slot="table-container"` on purpose: the layout
 * rules in globals.css that make a list page scroll its rows inside the card
 * (rather than the whole window) are keyed on that attribute, and the card list
 * is exactly the rows' scroll area on a phone.
 *
 * Usage, per row:
 *
 *   <MobileCard
 *     onClick={() => router.push(detailUrl)}
 *     leading={<MobileThumb src={row.image_url} fallback={<Package />} />}
 *     eyebrow={<><MobileChip>{row.sku}</MobileChip><span>{row.category}</span></>}
 *     title={row.name}
 *     status={<StatusBadge … />}
 *     menu={rowActionsMenu}
 *     stats={[
 *       { label: 'Narx', value: formatCurrency(row.price), tone: 'brand' },
 *       { label: 'Qoldiq', value: '12 dona', tone: 'good' },
 *     ]}
 *   />
 */

export function MobileCardList({
  children,
  empty,
  isEmpty,
  className,
}: {
  children: ReactNode
  /** What to show when there are no rows (the table's own empty state, usually). */
  empty?: ReactNode
  isEmpty?: boolean
  className?: string
}) {
  return (
    <div data-slot="table-container" // px/pb: the list scrolls inside its card (see globals.css), and a scroll container clips
    // whatever overflows it — without this the cards' shadows are cut off at its edges.
    className={cn('space-y-3 px-0.5 pt-0.5 pb-2 md:hidden', className)}>
      {isEmpty ? empty : children}
    </div>
  )
}

export type MobileStatTone = 'default' | 'brand' | 'good' | 'warn' | 'bad'

const STAT_TONE: Record<MobileStatTone, string> = {
  default: 'text-foreground',
  brand: 'text-violet-700 dark:text-violet-300',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
}

export interface MobileStat {
  label: string
  value: ReactNode
  tone?: MobileStatTone
}

export function MobileCard({
  onClick,
  leading,
  eyebrow,
  title,
  subtitle,
  status,
  menu,
  stats,
  footer,
  className,
}: {
  /** Makes the whole card a tap target (a row that opens its detail page). */
  onClick?: () => void
  /** A 44px thumbnail / icon tile at the left. */
  leading?: ReactNode
  /** The small line above the title: a chip and a category, a date, an order number. */
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Top-right status pill. */
  status?: ReactNode
  /** Top-right actions menu (stops its own clicks from opening the card). */
  menu?: ReactNode
  /** Up to four figures under a divider; the first sits left, the last right. */
  stats?: MobileStat[]
  /** Anything that belongs under the figures (buttons, a note). */
  footer?: ReactNode
  className?: string
}) {
  const interactive = Boolean(onClick)
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onClick || event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <article
      onClick={onClick}
      onKeyDown={interactive ? onKeyDown : undefined}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'link' : undefined}
      className={cn(
        'rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-150',
        interactive && 'cursor-pointer active:scale-[0.99] active:shadow-none focus-visible:ring-3 focus-visible:ring-ring/40 outline-none',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{eyebrow}</div>}
          <h3 className={cn('font-semibold leading-snug break-words', eyebrow && 'mt-1')}>{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {(status || menu) && (
          <div className="flex shrink-0 flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
            {status}
            {menu}
          </div>
        )}
      </div>

      {stats && stats.length > 0 && (
        <dl
          className="mt-3 grid gap-2 border-t border-border/60 pt-3"
          style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` } as CSSProperties}
        >
          {stats.map((stat, index) => (
            <div key={stat.label} className={cn('min-w-0', index === stats.length - 1 && stats.length > 1 && 'text-right')}>
              <dt className="truncate text-[11px] text-muted-foreground">{stat.label}</dt>
              <dd className={cn('truncate text-sm font-bold tabular-nums', STAT_TONE[stat.tone ?? 'default'])}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {footer && <div className="mt-3">{footer}</div>}
    </article>
  )
}

/** The small lavender tag in a card's eyebrow — a SKU, an order number, a code. */
export function MobileChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
        className
      )}
    >
      {children}
    </span>
  )
}

/** A rounded 44px tile for a card's `leading` slot: the image when there is one, else an icon. */
export function MobileThumb({
  src,
  alt = '',
  fallback,
  className,
}: {
  src?: string | null
  alt?: string
  fallback: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 [&_svg]:h-5 [&_svg]:w-5',
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a 44px tile of an already-sized upload; next/image would add a layout-shifting wrapper for nothing
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        fallback
      )}
    </div>
  )
}
