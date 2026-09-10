import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
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
 * A tenant sign-in can only be resolved on its own subdomain, and folding the
 * super-admin console into a public role picker would advertise it to every
 * tenant user — so the separation stays. What is shared is everything below:
 * the layout, the field styling and the submit/loading behaviour, so the three
 * forms can't drift apart again.
 */

/** Full-screen backdrop; centres a single card. */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
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
  behind,
  children,
}: {
  icon: LucideIcon
  brandTitle: string
  brandSubtitle: string
  heading: string
  subheading?: string
  /** Slot at the top-right of the card — the language switcher. */
  action?: ReactNode
  /**
   * Secondary panel tucked *behind* the card and peeking out below it — the
   * cross-portal links. Kept out of the card body on purpose: they are an
   * escape hatch to a different sign-in, not part of signing in here, and
   * sitting behind the card is what says so before any label is read.
   */
  behind?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative">
      <div className="relative z-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/20 rounded-xl border border-violet-500/30">
              <Icon className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-none">{brandTitle}</h1>
              <p className="text-slate-400 text-xs mt-0.5">{brandSubtitle}</p>
            </div>
          </div>
          {action}
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{heading}</h2>
          {subheading && <p className="text-slate-400 text-sm mt-1">{subheading}</p>}
        </div>

        {children}
      </div>

      {behind && (
        // Negative margin slides the panel's top edge under the card, and the
        // narrower width lets it show at the sides — so it reads as one object
        // behind another rather than a second card stacked below. The top
        // padding compensates for the hidden strip so the content still clears
        // the card's bottom edge.
        <div className="relative z-0  pl-[25%] pt-5 pb-5 ">
          {behind}
        </div>
      )}

      {/* Background glow. Must be the real `bg-gradient-to-r` utility: the
          three sign-in cards previously wrapped the same value in Tailwind's
          arbitrary-value brackets, which is not a gradient utility at all —
          it compiled to an invalid `background-color` declaration that every
          browser drops, so this glow silently rendered as nothing.
          (The broken form is deliberately not spelled out here: Tailwind
          scans source files as plain text, so quoting it would regenerate
          the dead rule.) */}
      <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-2xl blur-xl -z-10" />
    </div>
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
        <Label htmlFor={id} className="text-slate-300 text-sm">{label}</Label>
        {action}
      </div>
      {children}
      {error && <p className="text-red-400 text-xs">{error}</p>}
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
      className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 mt-2"
    >
      {isLoading ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {loadingLabel}</>
      ) : label}
    </Button>
  )
}

/** Input styling for the always-dark sign-in cards. */
export const authInputClass =
  'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-11'

export const authInputErrorClass = 'border-red-500/50'

/**
 * `PhoneInput` renders its own country dropdown in a portal, which escapes
 * the card — these three overrides keep it dark. The sign-in screens are
 * always dark regardless of the app's `.dark` class, so this can't be left
 * to theme tokens.
 */
export const authPhoneInputClasses = {
  triggerClassName: 'bg-white/5 border-white/10 text-white !h-11',
  inputClassName: authInputClass,
  contentClassName:
    'bg-slate-900 border border-white/10 text-white [&_[data-slot=select-item]]:text-white [&_[data-slot=select-item]]:focus:bg-white/10',
} as const
