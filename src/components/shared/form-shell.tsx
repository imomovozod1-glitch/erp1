import { cn } from '@/lib/utils'

/**
 * The single layout used by every create/edit form in the app.
 *
 * Before this, form pages were laid out three different ways at eight
 * different widths — `max-w-2xl`, `max-w-3xl`, `max-w-4xl`, `max-w-5xl`, some
 * self-styling as a card with `bg-white p-6 rounded-xl border shadow-sm`,
 * others wrapping in `<Card>`, others bare — and 21 pages added their own
 * `px-4 md:px-8` on top of the dashboard layout's `p-6`. The result was a
 * narrow, off-centre column of fields floating in a wide empty page, at a
 * different width on every screen.
 *
 * The shell is full-width and the fields flow into a responsive grid, so a
 * wide monitor gets more COLUMNS rather than one absurdly long text input.
 */

export function FormShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('w-full space-y-6', className)}>{children}</div>
}

/**
 * A titled group of fields. Sections stack; each is a card, so a long form
 * reads as a few labelled blocks instead of one uninterrupted wall.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6',
        className
      )}
    >
      {(title || description) && (
        <header className="mb-5">
          {title && (
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          )}
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </header>
      )}
      {children}
    </section>
  )
}

/**
 * Responsive field grid: one column on phones, two on tablets, three from
 * `xl` up. A field that needs the full row opts out with
 * `className="sm:col-span-2 xl:col-span-3"`.
 */
export function FormGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {children}
    </div>
  )
}

/** One labelled field. `full` makes it span the whole grid row. */
export function FormField({
  children,
  full = false,
  className,
}: {
  children: React.ReactNode
  full?: boolean
  className?: string
}) {
  return (
    <div className={cn('space-y-2', full && 'sm:col-span-2 xl:col-span-3', className)}>
      {children}
    </div>
  )
}

/**
 * Sticky action bar. Kept at the bottom of the viewport on long forms so Save
 * is reachable without scrolling to the end.
 */
export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85',
        className
      )}
    >
      {children}
    </div>
  )
}
