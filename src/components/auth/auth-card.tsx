import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Building2, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Shared chrome for every sign-in surface in the app. There are three, each
 * with its own URL, credential shape and auth model — they are deliberately
 * NOT merged into one page (see `src/proxy.ts`):
 *
 * | Surface        | URL                        | Identity                  |
 * | -------------- | -------------------------- | ------------------------- |
 * | Tenant users   | `<tenant>.<domain>/<lang>/login` | `profiles` (phone + password) |
 * | Super-admin    | `admin.<domain>/login`     | `super_admins` (email + password) |
 * | Support agents | `support.<domain>/login`   | `support_agents` (phone + password) |
 *
 * The address decides which form is served, so no page offers a choice
 * between them. What is shared is everything below: the layout, the field
 * styling and the submit/loading behaviour, so the three forms can't drift
 * apart again.
 *
 * The look is the app's own design system (CLAUDE.md § Design system):
 * lavender page, white card, the violet brand gradient — on theme tokens, so
 * the sign-in screens follow light and dark mode like every other screen
 * instead of being a fixed dark island.
 */

/**
 * The page. With `aside`, a brand panel sits left of the form on wide screens
 * (hidden on phones, where the form is the whole screen); without, the card is
 * centred on its own.
 */
export function AuthScreen({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="app-surface min-h-dvh bg-background">
      <div
        className={cn(
          'mx-auto grid min-h-dvh w-full gap-8 px-4 py-6 sm:px-6 lg:py-8',
          aside ? 'max-w-6xl lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:px-8' : 'max-w-md'
        )}
      >
        {aside && <div className="hidden lg:flex">{aside}</div>}
        <main className="flex items-center justify-center">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  )
}

/** The brand panel beside the tenant sign-in: what Falco is, in three lines. */
export function AuthAside({
  title,
  text,
  features,
  tagline,
}: {
  title: string
  text: string
  features: string[]
  tagline: string
}) {
  return (
    <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-[28px] bg-brand-gradient p-10 text-white shadow-brand-lg">
      {/* Decorative rings, the same soft light the KPI tiles carry. */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5" />

      <div className="relative flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          <Building2 className="size-5" />
        </div>
        <div>
          <p className="text-lg font-bold leading-none">Falco</p>
          <p className="mt-1 text-xs text-white/70">{tagline}</p>
        </div>
      </div>

      <div className="relative space-y-6">
        <div className="space-y-3">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">{title}</h2>
          <p className="max-w-md text-base leading-relaxed text-white/80">{text}</p>
        </div>
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm font-medium">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                <Check className="size-3.5" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Falco</p>
    </div>
  )
}

export function AuthCard({
  icon: Icon,
  brandTitle,
  brandSubtitle,
  heading,
  subheading,
  action,
  children,
}: {
  icon: LucideIcon
  brandTitle: string
  brandSubtitle: string
  heading: string
  subheading?: string
  /** Slot at the top-right of the card — the language switcher. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-xl shadow-violet-900/5 sm:p-8 dark:shadow-black/30">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-brand">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-none text-foreground">{brandTitle}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{brandSubtitle}</p>
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
      </div>

      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{heading}</h1>
        {subheading && <p className="text-sm text-muted-foreground">{subheading}</p>}
      </div>

      {children}
    </div>
  )
}

/**
 * Whole-form error, shown in the card above the fields.
 *
 * Sign-in has refusals that belong to the account rather than to a field —
 * wrong company subdomain, a staff account at the tenant form, a disabled
 * profile — and each one has somewhere else to go. A toast is the wrong shape
 * for that: it disappears on its own, cannot be re-read, and has nowhere to
 * put the link. This stays on the page until the next attempt.
 */
export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 dark:border-rose-900/50 dark:bg-rose-950/40"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
      <div className="min-w-0 space-y-1.5 text-sm text-rose-700 dark:text-rose-300">{children}</div>
    </div>
  )
}

/** The "go here instead" line inside an AuthAlert — a host or a portal. */
export function AuthAlertLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      // A different origin (the other company's host) or a different root
      // layout (/admin, /support) — neither survives a soft navigation.
      className="inline-flex items-center gap-1 break-all font-semibold text-violet-700 transition-colors hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"
    >
      {children}
      <span aria-hidden>→</span>
    </a>
  )
}

/** Labelled field with an optional trailing link/hint and an inline error line. */
export function AuthField({
  id,
  label,
  action,
  error,
  children,
}: {
  id: string
  label: string
  action?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className={cn('flex items-center', action ? 'justify-between' : undefined)}>
        <Label htmlFor={id} className="text-sm font-medium text-foreground">{label}</Label>
        {action}
      </div>
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

export function AuthSubmitButton({
  isLoading,
  label,
  loadingLabel,
}: {
  isLoading: boolean
  label: string
  loadingLabel: string
}) {
  return (
    <Button
      type="submit"
      disabled={isLoading}
      className="mt-2 h-12 w-full rounded-2xl md:h-12 bg-brand-gradient text-base font-semibold text-white shadow-brand transition-all duration-200 hover:opacity-95 hover:shadow-brand-lg"
    >
      {isLoading ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {loadingLabel}</>
      ) : label}
    </Button>
  )
}

/** The trailing "forgot password?" style link next to a field label. */
export const authLinkClass =
  'text-xs font-medium text-violet-700 transition-colors hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200'

/** Input sizing for the sign-in cards; colours come from the theme tokens. */
export const authInputClass = 'h-11 rounded-xl md:h-11'

export const authInputErrorClass = 'border-red-500 focus-visible:ring-red-500/20'

/** `PhoneInput` overrides: the same height and radius as the other fields. */
export const authPhoneInputClasses = {
  triggerClassName: '!h-11 rounded-xl md:!h-11',
  inputClassName: authInputClass,
} as const
