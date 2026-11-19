import { Reveal } from '@/components/landing/reveal'
import { StackedCards } from '@/components/landing/stacked-cards'
import { ArrowDown, ArrowRight, CheckCircle, XCircle } from '@phosphor-icons/react/dist/ssr'
import { TEXT_BODY, TEXT_MUTED, ACCENT, INSET } from '@/components/landing/landing-theme'
import { MODULES, PAIN, FLOW, SEGMENTS, STACK_TOP_REM, STACK_STEP_PX, type LandingContext } from '@/components/landing/landing-content'
import { SectionHeading, ModuleVisual } from '@/components/landing/landing-parts'

/** Pain → solution, one sale followed through the whole business, and the modules. */
export function LandingStory({ ctx }: { ctx: LandingContext }) {
  const { t } = ctx
  return (
    <>
      {/* ── Pain → solution ──────────────────────────────────────────── */}
      <section className="relative px-4 pt-24 sm:px-6 lg:pt-32">
        <div className="mx-auto max-w-5xl">
          <SectionHeading eyebrow={t('painEyebrow')} title={t('painTitle')} subtitle={t('painSubtitle')} />
          <div className="space-y-4">
            {PAIN.map((key, i) => (
              <Reveal key={key} delay={(i % 2) * 80}>
                <div className="lp-glass grid items-stretch gap-3 rounded-3xl p-3 md:grid-cols-[1fr_auto_1fr] md:gap-0 md:p-4">
                  <div className={`flex items-start gap-4 rounded-2xl p-4 sm:p-5 ${INSET}`}>
                    <XCircle weight="duotone" className="mt-0.5 h-6 w-6 shrink-0 text-rose-500 dark:text-rose-400" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">{t('painNow')}</p>
                      <p className={`mt-1 font-medium ${TEXT_BODY}`}>{t(`pain.${key}.problem`)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center px-3 text-violet-500 dark:text-violet-300">
                    <ArrowDown weight="bold" className="h-5 w-5 md:hidden" />
                    <ArrowRight weight="bold" className="hidden h-5 w-5 md:block" />
                  </div>
                  <div className="flex items-start gap-4 rounded-2xl bg-emerald-500/10 p-4 sm:p-5">
                    <CheckCircle weight="duotone" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{t('painWith')}</p>
                      <p className="mt-1 font-medium">{t(`pain.${key}.solution`)}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── One sale, whole business ─────────────────────────────────── */}
      <section className="relative px-4 pt-28 sm:px-6 lg:pt-40">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow={t('flowEyebrow')} title={t('flowTitle')} subtitle={t('flowSubtitle')} />
          <ol className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-0">
            {FLOW.map(({ key, icon: FlowIcon }, i) => (
              <li key={key} className="contents">
                <Reveal delay={i * 120} className="md:flex-1">
                  <div className="lp-glass lp-glass-hover flex h-full flex-row items-center gap-4 rounded-3xl p-5 md:flex-col md:gap-3 md:p-6 md:text-center">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
                      <FlowIcon weight="duotone" className="h-6 w-6" />
                    </span>
                    <p className="text-sm font-semibold leading-snug">{t(`flow.${key}`)}</p>
                  </div>
                </Reveal>
                {i < FLOW.length - 1 && (
                  <span aria-hidden className="flex items-center justify-center md:w-10 md:shrink-0">
                    <ArrowDown weight="bold" className={`h-5 w-5 md:hidden ${ACCENT}`} />
                    <span className="lp-flow-line hidden h-px w-full md:block" />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Modules: marquee + stacked cards ─────────────────────────── */}
      <section id="modules" className="relative scroll-mt-4 pt-24 lg:pt-32">
        <SectionHeading title={t('modulesTitle')} subtitle={t('modulesSubtitle')} />

        <div className="lp-marquee-wrap lp-marquee-mask mb-20 overflow-hidden" aria-hidden>
          <div className="lp-marquee flex w-max gap-4 pr-4">
            {[...MODULES, ...MODULES].map(({ key, icon: ModuleIcon }, i) => (
              <span key={`${key}-${i}`} className={`lp-glass flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium ${TEXT_BODY}`}>
                <ModuleIcon weight="duotone" className={`h-5 w-5 ${ACCENT}`} />
                {t(`modules.${key}.title`)}
              </span>
            ))}
          </div>
        </div>

        <StackedCards className="mx-auto max-w-4xl px-4 sm:px-6">
          {MODULES.map(({ key, icon: ModuleIcon, from, to }, i) => (
            <div
              key={key}
              data-stack-card
              className="sticky mb-6 last:mb-0"
              style={{ top: `calc(${STACK_TOP_REM}rem + ${i * STACK_STEP_PX}px)` }}
            >
              <article className="lp-stack-inner lp-glass relative grid min-h-[17rem] items-center gap-8 overflow-hidden rounded-[2rem] p-8 sm:p-10 md:grid-cols-[1.2fr_1fr]">
                <div aria-hidden className={`absolute -right-24 -top-24 h-72 w-72 rounded-full bg-linear-to-br ${from} ${to} opacity-25 blur-3xl`} />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${from} ${to} text-white shadow-lg`}>
                      <ModuleIcon weight="duotone" className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-400 dark:text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{t(`modules.${key}.title`)}</h3>
                  <p className={`mt-3 max-w-md text-base leading-relaxed ${TEXT_BODY}`}>{t(`modules.${key}.desc`)}</p>
                </div>
                <ModuleVisual icon={ModuleIcon} from={from} to={to} />
              </article>
            </div>
          ))}
        </StackedCards>
      </section>
    </>
  )
}

/** Who it is for. */
export function LandingSegments({ ctx }: { ctx: LandingContext }) {
  const { t } = ctx
  return (
    <>
      {/* ── Segments ─────────────────────────────────────────────────── */}
      <section className="relative px-4 pt-28 sm:px-6 lg:pt-40">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow={t('segmentsEyebrow')} title={t('segmentsTitle')} subtitle={t('segmentsSubtitle')} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SEGMENTS.map(({ key, icon: SegmentIcon, tone }, i) => (
              <Reveal key={key} delay={i * 100}>
                <div className="lp-glass lp-glass-hover relative h-full overflow-hidden rounded-3xl p-7">
                  <div aria-hidden className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-linear-to-br ${tone} opacity-25 blur-2xl`} />
                  <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${tone} text-white shadow-lg`}>
                    <SegmentIcon weight="duotone" className="h-6 w-6" />
                  </span>
                  <h3 className="relative mt-5 text-lg font-semibold">{t(`segments.${key}.title`)}</h3>
                  <p className={`relative mt-2 text-sm leading-relaxed ${TEXT_MUTED}`}>{t(`segments.${key}.desc`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
