import Link from 'next/link'
import { ArrowRight, Compass, HelpCircle, Lightbulb, Rocket } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import { GUIDE_SECTIONS, type GuideItem } from './guide-sections'

export const GUIDE_CARD = 'rounded-xl border-0 shadow-sm bg-card'
const HEADING = 'text-sm font-semibold uppercase tracking-wider text-muted-foreground'
const CHIP = 'rounded-lg px-3 py-1.5 text-xs transition-colors'
const BRAND_CHIP = cn(CHIP, 'bg-violet-50 font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50')
const PLAIN_CHIP = cn(CHIP, 'bg-muted font-medium text-foreground/80 hover:bg-muted/70')

/** The long-form content is authored as arrays in the message files; `raw` is the only way to read them. */
type Entry = { title: string; text: string }

function IconBadge({ icon: Icon, tone }: { icon: typeof Rocket; tone: string }) {
  return (
    <div className={cn('shrink-0 rounded-lg p-2', tone)}>
      <Icon className="size-4" />
    </div>
  )
}

const VIOLET = 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400'

/** Anchors to every section below. */
export async function GuideToc() {
  const t = await getTranslations()
  return (
    <div className={cn(GUIDE_CARD, 'p-5')}>
      <h2 className={cn(HEADING, 'mb-3 flex items-center gap-2')}>
        <Compass className="size-4" /> {t('guide.tocTitle')}
      </h2>
      <div className="flex flex-wrap gap-2">
        <a href="#quick-start" className={BRAND_CHIP}>{t('guide.quickStart.title')}</a>
        <a href="#basics" className={BRAND_CHIP}>{t('guide.basics.title')}</a>
        {GUIDE_SECTIONS.flatMap((section) => section.items).map((item) => (
          <a key={item.key} href={`#${item.key}`} className={PLAIN_CHIP}>{t(item.labelKey)}</a>
        ))}
        <a href="#faq" className={PLAIN_CHIP}>{t('faq.title')}</a>
      </div>
    </div>
  )
}

export async function QuickStart() {
  const t = await getTranslations('guide.quickStart')
  const steps = t.raw('steps') as Entry[]
  return (
    <section id="quick-start" className={cn(GUIDE_CARD, 'scroll-mt-24 p-5')}>
      <div className="flex items-start gap-3">
        <IconBadge icon={Rocket} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" />
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-lg bg-muted/50 p-3.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Rules that apply on every page. */
export async function Basics() {
  const t = await getTranslations('guide.basics')
  const items = t.raw('items') as Entry[]
  return (
    <section id="basics" className="scroll-mt-24">
      <h2 className={cn(HEADING, 'mb-1')}>{t('title')}</h2>
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{t('description')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className={cn(GUIDE_CARD, 'p-4')}>
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function StepList({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <p className={cn(HEADING, 'mb-2 text-xs')}>{title}</p>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-sm">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">{index + 1}</span>
            <span className="leading-relaxed text-foreground/80">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function TipList({ title, tips }: { title: string; tips: string[] }) {
  return (
    <div>
      <p className={cn(HEADING, 'mb-2 text-xs')}>{title}</p>
      <ul className="space-y-2">
        {tips.map((tip) => (
          <li key={tip} className="flex gap-2.5 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span className="leading-relaxed text-foreground/80">{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One detailed card per page of the app: what it is for, how to use it, and tips. */
export async function ModuleCard({ item, lang }: { item: GuideItem; lang: string }) {
  const t = await getTranslations()
  const Icon = item.icon
  const base = `guide.modules.${item.key}`
  return (
    <article id={item.key} className={cn(GUIDE_CARD, 'scroll-mt-24 p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconBadge icon={Icon} tone={VIOLET} />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{t(item.labelKey)}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`${base}.purpose`)}</p>
          </div>
        </div>
        <Link href={`/${lang}/${item.href}`} className={cn(BRAND_CHIP, 'inline-flex shrink-0 items-center gap-1.5')}>
          {t('guide.openLink')}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <StepList title={t('guide.stepsTitle')} steps={t.raw(`${base}.steps`) as string[]} />
        <TipList title={t('guide.tipsTitle')} tips={t.raw(`${base}.tips`) as string[]} />
      </div>
    </article>
  )
}

export async function ModuleSections({ lang }: { lang: string }) {
  const t = await getTranslations()
  return (
    <div className="space-y-8">
      {GUIDE_SECTIONS.map((section) => (
        <section key={section.titleKey}>
          <h2 className={cn(HEADING, 'mb-3')}>{t(section.titleKey)}</h2>
          <div className="space-y-4">
            {section.items.map((item) => (
              <ModuleCard key={item.key} item={item} lang={lang} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** The FAQ has its own page; the guide points at it rather than keeping a second copy. */
export async function FaqLink({ lang }: { lang: string }) {
  const t = await getTranslations('faq')
  return (
    <section id="faq" className="scroll-mt-24">
      <Link href={`/${lang}/faq`} className={cn(GUIDE_CARD, 'flex items-center justify-between gap-4 p-5 transition-shadow hover:shadow-md')}>
        <div className="flex items-start gap-3">
          <IconBadge icon={HelpCircle} tone={VIOLET} />
          <div>
            <p className="text-base font-semibold text-foreground">{t('title')}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
      </Link>
    </section>
  )
}
