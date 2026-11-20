import { Reveal } from '@/components/landing/reveal'
import { FalcoLogo } from '@/components/shared/falco-logo'
import type { Icon } from '@phosphor-icons/react'
import { CloudCheck, DeviceMobile, Translate } from '@phosphor-icons/react/dist/ssr'
import { TEXT_STRONG, TEXT_MUTED, INSET, HAIRLINE, SKELETON } from '@/components/landing/landing-theme'

export function Logo() {
  return <FalcoLogo className="h-9 w-auto" />
}

export function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <Reveal className="mx-auto mb-14 max-w-2xl text-center">
      {eyebrow && (
        <span className="mb-4 inline-block rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-700 dark:border-white/10 dark:bg-white/5 dark:text-violet-300">
          {eyebrow}
        </span>
      )}
      <h2 className={`text-3xl font-bold tracking-tight sm:text-5xl ${TEXT_STRONG}`}>{title}</h2>
      {subtitle && <p className={`mt-5 text-base leading-relaxed sm:text-lg ${TEXT_MUTED}`}>{subtitle}</p>}
    </Reveal>
  )
}

/** Right-hand side of a stacked card: a glowing icon over skeleton "UI" rows. */
export function ModuleVisual({ icon: ModuleIcon, from, to }: { icon: Icon; from: string; to: string }) {
  return (
    <div aria-hidden className="relative hidden h-44 md:block">
      <div className={`absolute inset-x-2 top-0 space-y-3 rounded-2xl border p-4 ${HAIRLINE} ${INSET}`}>
        {[88, 64, 76].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`h-6 w-6 shrink-0 rounded-lg bg-linear-to-br ${from} ${to} ${i === 0 ? 'opacity-90' : 'opacity-50'}`} />
            <span className={`h-2.5 rounded-full ${SKELETON}`} style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <span className={`lp-float absolute -bottom-2 right-0 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br ${from} ${to} text-white shadow-2xl`}>
        <ModuleIcon weight="duotone" className="h-10 w-10" />
      </span>
    </div>
  )
}

/**
 * The product at a glance: a window holding every module as an app-launcher
 * tile, with two chips for what surrounds it. Deliberately no figures or
 * charts — a mock-up with invented numbers says nothing true, while the nine
 * sections of the system are exactly what a visitor is deciding about.
 */
export function HeroPreview({
  title,
  chips,
  tiles,
}: {
  title: string
  chips: { app: string; languages: string }
  tiles: { key: string; label: string; icon: Icon; from: string; to: string }[]
}) {
  return (
    <div aria-hidden className="relative mx-auto max-w-3xl">
      <div className="absolute -inset-4 rounded-[2.5rem] bg-linear-to-r from-violet-500/30 via-fuchsia-500/20 to-cyan-500/30 blur-3xl" />

      <div className="lp-glass relative rounded-3xl p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${TEXT_MUTED}`}>
            <CloudCheck weight="duotone" className="h-4 w-4" />
            {title}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {tiles.map(({ key, label, icon: TileIcon, from, to }, i) => (
            <div
              key={key}
              className={`lp-pop flex flex-col items-center gap-2.5 rounded-2xl px-2 py-4 text-center sm:gap-3 sm:py-6 ${INSET}`}
              style={{ animationDelay: `${0.5 + i * 0.07}s` }}
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg sm:h-14 sm:w-14 ${from} ${to}`}>
                <TileIcon weight="duotone" className="h-6 w-6 sm:h-7 sm:w-7" />
              </span>
              <span className="text-xs font-semibold leading-tight sm:text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-glass lp-float absolute -left-40 top-24 hidden items-center gap-3 rounded-2xl px-4 py-3 xl:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
          <DeviceMobile weight="duotone" className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold">{chips.app}</p>
      </div>
      <div className="lp-glass lp-float-slow absolute -right-40 bottom-24 hidden items-center gap-3 rounded-2xl px-4 py-3 xl:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-200">
          <Translate weight="duotone" className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold">{chips.languages}</p>
      </div>
    </div>
  )
}
