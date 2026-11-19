import { Reveal } from '@/components/landing/reveal'
import { Plus } from '@phosphor-icons/react/dist/ssr'
import { TEXT_MUTED, ACCENT } from '@/components/landing/landing-theme'
import { FEATURES, FAQ, STEPS, type LandingContext } from '@/components/landing/landing-content'
import { SectionHeading } from '@/components/landing/landing-parts'

/** The features bento, how getting started works, and the FAQ. */
export function LandingDetails({ ctx }: { ctx: LandingContext }) {
  const { t, platforms } = ctx
  return (
    <>
      {/* ── Features: bento ──────────────────────────────────────────── */}
      <section id="features" className="relative scroll-mt-4 py-28 lg:py-40">
        <div aria-hidden className="lp-blob left-1/2 top-1/3 -z-10 h-96 w-96 -translate-x-1/2 bg-violet-500/25 dark:bg-violet-700/20" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={t('featuresTitle')} subtitle={t('featuresSubtitle')} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: FeatureIcon }, i) => (
              <Reveal key={key} delay={(i % 3) * 100}>
                <div className="lp-glass lp-glass-hover group h-full rounded-3xl p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20 transition-colors duration-300 group-hover:bg-violet-500/20 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/20 dark:group-hover:bg-violet-500/30">
                    <FeatureIcon weight="duotone" className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${TEXT_MUTED}`}>{t(`features.${key}.desc`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="relative scroll-mt-4 pb-28 lg:pb-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={t('stepsTitle')} />
          <ol className="relative grid gap-5 md:grid-cols-3">
            <div aria-hidden className="absolute left-[16%] right-[16%] top-[3.1rem] hidden h-px bg-linear-to-r from-transparent via-violet-500/50 to-transparent md:block" />
            {STEPS.map((key, i) => (
              <li key={key}>
                <Reveal delay={i * 120} className="h-full">
                  <div className="lp-glass lp-glass-hover relative h-full rounded-3xl p-7 pt-8">
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-violet-500/40">
                      <span aria-hidden className="lp-ring absolute inset-0 rounded-full border border-violet-400" />
                      {i + 1}
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{t(`steps.${key}.title`)}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${TEXT_MUTED}`}>{t(`steps.${key}.desc`)}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="relative scroll-mt-4 px-4 pb-28 sm:px-6 lg:pb-40">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow={t('faqEyebrow')} title={t('faqTitle')} />
          <div className="space-y-3">
            {FAQ.map((key, i) => (
              <Reveal key={key} delay={(i % 3) * 80}>
                <details className="lp-glass group rounded-2xl">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold [&::-webkit-details-marker]:hidden">
                    {t(`faq.${key}.q`)}
                    <Plus weight="bold" className={`h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-45 ${ACCENT}`} />
                  </summary>
                  <p className={`px-5 pb-5 text-sm leading-relaxed ${TEXT_MUTED}`}>{t(`faq.${key}.a`, { platforms })}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
        {/* The same questions for search engines (FAQPage rich results). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQ.map((key) => ({
                '@type': 'Question',
                name: t(`faq.${key}.q`),
                acceptedAnswer: { '@type': 'Answer', text: t(`faq.${key}.a`, { platforms }) },
              })),
            }).replace(/</g, '\\u003c'),
          }}
        />
      </section>
    </>
  )
}
