import Link from 'next/link'
import type { Icon } from '@phosphor-icons/react'
import {
  ArrowRight,
  Barcode,
  Brain,
  ChartLineUp,
  Check,
  Gift,
  Receipt,
  CloudCheck,
  Cube,
  CurrencyCircleDollar,
  DeviceMobile,
  Factory,
  Key,
  MapTrifold,
  Phone,
  ShieldCheck,
  ShoppingCart,
  TelegramLogo,
  Translate,
  TrendUp,
  Truck,
  UsersThree,
  AddressBook,
} from '@phosphor-icons/react/dist/ssr'
import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import { LeadForm } from '@/components/landing/lead-form'
import { MobileMenu } from '@/components/landing/mobile-menu'
import { NativeAppRedirect } from '@/components/landing/native-app-redirect'
import { Reveal } from '@/components/landing/reveal'
import { StackedCards } from '@/components/landing/stacked-cards'

/**
 * The public marketing page on the bare host (falco.business / www.) —
 * `src/app/[lang]/page.tsx` renders it there and keeps redirecting tenant
 * subdomains to their dashboard. Always dark (glassmorphism over an animated
 * aurora), like the sign-in screens, so it has no theme toggle. Styles are the
 * `lp-*` block at the end of globals.css.
 *
 * Server-rendered except `Reveal` (scroll fade-in) and `StackedCards` (depth
 * on the sticky pile). The `landing` namespace is in the root layout's
 * SERVER_ONLY_NAMESPACES, so none of this text reaches tenant pages' payload.
 *
 * Contact buttons only appear once LANDING_CONTACT_TELEGRAM and/or
 * LANDING_CONTACT_PHONE are set — a placeholder number on a live page is
 * worse than no button.
 */

const MODULES: { key: string; icon: Icon; from: string; to: string }[] = [
  { key: 'inventory', icon: Cube, from: 'from-indigo-500', to: 'to-violet-500' },
  { key: 'sales', icon: ShoppingCart, from: 'from-emerald-500', to: 'to-teal-400' },
  { key: 'procurement', icon: Truck, from: 'from-amber-500', to: 'to-orange-500' },
  { key: 'finance', icon: CurrencyCircleDollar, from: 'from-violet-500', to: 'to-fuchsia-500' },
  { key: 'customers', icon: AddressBook, from: 'from-sky-500', to: 'to-cyan-400' },
  { key: 'hr', icon: UsersThree, from: 'from-rose-500', to: 'to-pink-500' },
  { key: 'production', icon: Factory, from: 'from-orange-500', to: 'to-red-500' },
  { key: 'distribution', icon: MapTrifold, from: 'from-teal-500', to: 'to-emerald-400' },
  { key: 'reports', icon: ChartLineUp, from: 'from-fuchsia-500', to: 'to-purple-500' },
]

// Three double-width tiles in a 3-column grid fill all three rows exactly.
const FEATURES: { key: string; icon: Icon; span?: string }[] = [
  { key: 'languages', icon: Translate, span: 'lg:col-span-2' },
  { key: 'mobile', icon: DeviceMobile },
  { key: 'telegram', icon: TelegramLogo },
  { key: 'ai', icon: Brain, span: 'lg:col-span-2' },
  { key: 'roles', icon: Key, span: 'lg:col-span-2' },
  { key: 'security', icon: ShieldCheck },
]

const STEPS = ['contact', 'setup', 'start'] as const

const NAV: { href: string; key: 'navModules' | 'navFeatures' | 'navHow' | 'navStart' }[] = [
  { href: '#modules', key: 'navModules' },
  { href: '#features', key: 'navFeatures' },
  { href: '#how', key: 'navHow' },
  { href: '#start', key: 'navStart' },
]

const TRIAL_POINTS = ['trialPoint1', 'trialPoint2', 'trialPoint3'] as const

const STATS: { value: string; label: string }[] = [
  { value: '9', label: 'statModules' },
  { value: '3', label: 'statLanguages' },
  { value: '3', label: 'statDevices' },
  { value: '24/7', label: 'statCloud' },
]

// Decorative chart heights in the hero mock-up.
const PREVIEW_BARS = [38, 56, 44, 72, 52, 88, 66, 94]

// Stuck top of the first stacked card, and the offset between cards — the
// offset must match STEP in stacked-cards.tsx.
const STACK_TOP_REM = 6.5
const STACK_STEP_PX = 20

// The sales number shown on the page. LANDING_CONTACT_PHONE overrides it per
// deployment; LANDING_CONTACT_TELEGRAM adds a Telegram button.
const DEFAULT_PHONE = '+998998182004'

function contactLinks() {
  const telegram = process.env.LANDING_CONTACT_TELEGRAM?.trim().replace(/^@/, '')
  const phone = process.env.LANDING_CONTACT_PHONE?.trim() || DEFAULT_PHONE
  return {
    telegram: telegram ? `https://t.me/${telegram}` : null,
    phone: `tel:${phone.replace(/[^\d+]/g, '')}`,
    phoneLabel: phone,
  }
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-base font-extrabold text-white shadow-lg shadow-violet-500/40">
        F
      </span>
      <span className="text-lg font-bold tracking-tight text-white">Falco</span>
    </span>
  )
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <Reveal className="mx-auto mb-14 max-w-2xl text-center">
      {eyebrow && (
        <span className="mb-4 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-300">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">{subtitle}</p>}
    </Reveal>
  )
}

const primaryButton =
  'group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-7 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-violet-500/60'
const glassButton =
  'lp-glass inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/10'

export async function LandingPage({ lang }: { lang: string }) {
  const t = await getTranslations('landing')
  const contact = contactLinks()
  const loginHref = `/${lang}/login`

  return (
    <div className="lp relative min-h-screen text-white">
      <NativeAppRedirect href={loginHref} />

      {/* ── Floating glass header ──────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-4 z-50 px-4">
        <div className="lp-glass relative mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-full pl-5 pr-2.5">
          <a href="#top" aria-label="Falco">
            <Logo />
          </a>
          <nav className="hidden items-center gap-1 text-sm font-medium text-slate-300 md:flex">
            {NAV.map(({ href, key }) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 transition-colors hover:bg-white/10 hover:text-white">
                {t(key)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <LocaleSwitcher mode="path" variant="glass" className="hidden md:flex" />
            <Link
              href={loginHref}
              className="inline-flex h-9 items-center rounded-full bg-white px-5 text-sm font-semibold text-slate-900 transition-transform duration-300 hover:scale-105"
            >
              {t('login')}
            </Link>
            <MobileMenu links={NAV.map(({ href, key }) => ({ href, label: t(key) }))} label="Menu">
              <LocaleSwitcher mode="path" variant="glass" />
            </MobileMenu>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="lp-grid-bg absolute inset-0" />
            <div className="lp-blob -left-24 top-10 h-[26rem] w-[26rem] bg-violet-600/40" />
            <div className="lp-blob right-0 top-0 h-[30rem] w-[30rem] bg-fuchsia-600/25 [animation-delay:-6s]" />
            <div className="lp-blob bottom-0 left-1/3 h-[22rem] w-[22rem] bg-cyan-500/20 [animation-delay:-11s]" />
          </div>

          <div className="mx-auto max-w-6xl px-4 pb-24 pt-36 sm:px-6 lg:pb-32 lg:pt-44">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <span className="lp-glass lp-sheen inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-violet-200">
                  {t('heroBadge')}
                </span>
              </Reveal>
              <Reveal delay={100}>
                <h1 className="mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                  {t('heroTitle')} <span className="lp-text-gradient">{t('heroTitleAccent')}</span>
                </h1>
              </Reveal>
              <Reveal delay={200}>
                <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-300">{t('heroSubtitle')}</p>
              </Reveal>
              <Reveal delay={300} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a href="#start" className={primaryButton}>
                  {t('ctaTrial')}
                  <ArrowRight weight="bold" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
                <Link href={loginHref} className={glassButton}>
                  {t('ctaLogin')}
                </Link>
              </Reveal>
              <Reveal delay={400}>
                <ul className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-sm text-slate-400">
                  {(['heroPointLanguages', 'heroPointMobile', 'heroPointCloud'] as const).map((key) => (
                    <li key={key} className="flex items-center gap-2">
                      <Check weight="bold" className="h-4 w-4 shrink-0 text-emerald-400" />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <p className="mx-auto mt-5 inline-flex max-w-xl items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                  <Gift weight="duotone" className="h-4 w-4 shrink-0" />
                  {t('heroTrialNote')}
                </p>
              </Reveal>
            </div>

            <Reveal delay={500} className="mt-20">
              <HeroPreview
                labels={{
                  title: t('previewTitle'),
                  revenue: t('previewRevenue'),
                  orders: t('previewOrders'),
                  stock: t('previewStock'),
                  chart: t('previewChart'),
                }}
              />
            </Reveal>
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <section className="relative px-4 pb-8 sm:px-6">
          <Reveal className="lp-glass mx-auto grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/5 md:grid-cols-4">
            {STATS.map(({ value, label }) => (
              <div key={label} className="bg-[#0a0b18]/70 px-6 py-8 text-center">
                <p className="lp-text-gradient text-4xl font-extrabold tracking-tight sm:text-5xl">{value}</p>
                <p className="mt-2 text-sm text-slate-400">{t(label)}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ── Modules: marquee + stacked cards ─────────────────────────── */}
        <section id="modules" className="relative scroll-mt-4 pt-24 lg:pt-32">
          <SectionHeading title={t('modulesTitle')} subtitle={t('modulesSubtitle')} />

          <div className="lp-marquee-wrap lp-marquee-mask mb-20 overflow-hidden" aria-hidden>
            <div className="lp-marquee flex w-max gap-4 pr-4">
              {[...MODULES, ...MODULES].map(({ key, icon: ModuleIcon }, i) => (
                <span key={`${key}-${i}`} className="lp-glass flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium text-slate-200">
                  <ModuleIcon weight="duotone" className="h-5 w-5 text-violet-300" />
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
                      <span className="text-sm font-semibold tabular-nums text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{t(`modules.${key}.title`)}</h3>
                    <p className="mt-3 max-w-md text-base leading-relaxed text-slate-300">{t(`modules.${key}.desc`)}</p>
                  </div>
                  <ModuleVisual icon={ModuleIcon} from={from} to={to} />
                </article>
              </div>
            ))}
          </StackedCards>
        </section>

        {/* ── Features: bento ──────────────────────────────────────────── */}
        <section id="features" className="relative scroll-mt-4 py-28 lg:py-40">
          <div aria-hidden className="lp-blob left-1/2 top-1/3 -z-10 h-96 w-96 -translate-x-1/2 bg-violet-700/20" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title={t('featuresTitle')} subtitle={t('featuresSubtitle')} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ key, icon: FeatureIcon, span }, i) => (
                <Reveal key={key} delay={(i % 3) * 100} className={span}>
                  <div className="lp-glass lp-glass-hover group h-full rounded-3xl p-7">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20 transition-colors duration-300 group-hover:bg-violet-500/30">
                      <FeatureIcon weight="duotone" className="h-6 w-6" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{t(`features.${key}.title`)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(`features.${key}.desc`)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Free trial ───────────────────────────────────────────────── */}
        <section id="trial" className="relative scroll-mt-4 pb-28 lg:pb-40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <div className="lp-glass relative isolate overflow-hidden rounded-[2.5rem] p-8 sm:p-12">
                <div aria-hidden className="lp-blob -left-16 -top-20 -z-10 h-72 w-72 bg-emerald-500/30" />
                <div aria-hidden className="lp-blob -bottom-24 right-0 -z-10 h-72 w-72 bg-violet-600/40 [animation-delay:-8s]" />
                <div className="grid items-center gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
                  <div className="text-center lg:text-left">
                    <p className="lp-text-gradient text-8xl font-extrabold leading-none tracking-tighter sm:text-9xl">{t('trialDays')}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-200">{t('trialDaysLabel')}</p>
                  </div>
                  <div>
                    <span className="inline-block rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300">
                      {t('trialEyebrow')}
                    </span>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{t('trialTitle')}</h2>
                    <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">{t('trialSubtitle')}</p>
                    <ul className="mt-6 space-y-3">
                      {TRIAL_POINTS.map((key) => (
                        <li key={key} className="flex items-start gap-3 text-slate-200">
                          <Check weight="bold" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                          {t(key)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-10 flex items-start gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                    <Receipt weight="duotone" className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{t('afterTitle')}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t('afterText')}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how" className="relative scroll-mt-4 pb-28 lg:pb-40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading title={t('stepsTitle')} />
            <ol className="relative grid gap-5 md:grid-cols-3">
              <div aria-hidden className="absolute left-[16%] right-[16%] top-[3.1rem] hidden h-px bg-linear-to-r from-transparent via-violet-400/50 to-transparent md:block" />
              {STEPS.map((key, i) => (
                <li key={key}>
                  <Reveal delay={i * 120} className="h-full">
                    <div className="lp-glass lp-glass-hover relative h-full rounded-3xl p-7 pt-8">
                      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 text-lg font-bold shadow-lg shadow-violet-500/40">
                        <span aria-hidden className="lp-ring absolute inset-0 rounded-full border border-violet-400" />
                        {i + 1}
                      </span>
                      <h3 className="mt-5 text-lg font-semibold">{t(`steps.${key}.title`)}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(`steps.${key}.desc`)}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Sign-up request ──────────────────────────────────────────── */}
        <section id="start" className="relative scroll-mt-4 px-4 pb-24 sm:px-6 lg:pb-32">
          <div className="mx-auto max-w-3xl">
            <SectionHeading eyebrow={t('formEyebrow')} title={t('formTitle')} subtitle={t('formSubtitle')} />
            <Reveal>
              <div className="lp-glass relative isolate overflow-hidden rounded-[2rem] p-6 sm:p-10">
                <div aria-hidden className="lp-blob -left-10 -top-20 -z-10 h-64 w-64 bg-violet-600/40" />
                <div aria-hidden className="lp-blob -bottom-24 right-0 -z-10 h-64 w-64 bg-fuchsia-600/30 [animation-delay:-8s]" />
                <LeadForm
                  lang={lang}
                  phone={{ href: contact.phone, label: contact.phoneLabel }}
                  labels={{
                    name: t('formName'),
                    namePlaceholder: t('formNamePlaceholder'),
                    company: t('formCompany'),
                    companyPlaceholder: t('formCompanyPlaceholder'),
                    phone: t('formPhone'),
                    comment: t('formComment'),
                    commentPlaceholder: t('formCommentPlaceholder'),
                    submit: t('formSubmit'),
                    sending: t('formSending'),
                    successTitle: t('formSuccessTitle'),
                    successText: t('formSuccessText'),
                    sendAnother: t('formSendAnother'),
                    errorName: t('formErrorName'),
                    errorCompany: t('formErrorCompany'),
                    errorPhone: t('formErrorPhone'),
                    errorGeneric: t('formErrorGeneric'),
                    errorLimit: t('formErrorLimit'),
                    orCall: t('formOrCall'),
                  }}
                />
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-black/20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">{t('heroBadge')}</p>
          </div>
          <nav className="flex flex-col gap-3 text-sm text-slate-400">
            {NAV.map(({ href, key }) => (
              <a key={href} href={href} className="w-fit transition-colors hover:text-white">
                {t(key)}
              </a>
            ))}
            <Link href={loginHref} className="w-fit transition-colors hover:text-white">
              {t('login')}
            </Link>
          </nav>
          <div className="flex flex-col gap-3 text-sm text-slate-400">
            <a href={contact.phone} className="flex w-fit items-center gap-2 transition-colors hover:text-white">
              <Phone weight="duotone" className="h-4 w-4 text-violet-300" />
              {contact.phoneLabel}
            </a>
            {contact.telegram && (
              <a href={contact.telegram} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-2 transition-colors hover:text-white">
                <TelegramLogo weight="duotone" className="h-4 w-4 text-violet-300" />
                Telegram
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} Falco. {t('footerRights')}</p>
            <LocaleSwitcher mode="path" variant="glass" />
          </div>
        </div>
      </footer>
    </div>
  )
}

/** Right-hand side of a stacked card: a glowing icon over skeleton "UI" rows. */
function ModuleVisual({ icon: ModuleIcon, from, to }: { icon: Icon; from: string; to: string }) {
  return (
    <div aria-hidden className="relative hidden h-44 md:block">
      <div className="absolute inset-x-2 top-0 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        {[88, 64, 76].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`h-6 w-6 shrink-0 rounded-lg bg-linear-to-br ${from} ${to} ${i === 0 ? 'opacity-90' : 'opacity-50'}`} />
            <span className="h-2.5 rounded-full bg-white/15" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <span className={`lp-float absolute -bottom-2 right-0 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br ${from} ${to} text-white shadow-2xl`}>
        <ModuleIcon weight="duotone" className="h-10 w-10" />
      </span>
    </div>
  )
}

/** A static, decorative miniature of the dashboard — no data, no client JS. */
function HeroPreview({
  labels,
}: {
  labels: { title: string; revenue: string; orders: string; stock: string; chart: string }
}) {
  const tiles: { label: string; value: string; icon: Icon; tone: string }[] = [
    { label: labels.revenue, value: '48.2M', icon: TrendUp, tone: 'bg-emerald-500/15 text-emerald-300' },
    { label: labels.orders, value: '1 284', icon: ShoppingCart, tone: 'bg-indigo-500/15 text-indigo-300' },
    { label: labels.stock, value: '12', icon: Barcode, tone: 'bg-amber-500/15 text-amber-300' },
  ]

  return (
    <div aria-hidden className="relative mx-auto max-w-4xl">
      <div className="absolute -inset-4 rounded-[2.5rem] bg-linear-to-r from-violet-500/30 via-fuchsia-500/20 to-cyan-500/30 blur-3xl" />

      <div className="lp-glass relative rounded-3xl p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <CloudCheck weight="duotone" className="h-4 w-4" />
            {labels.title}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
          <div className="hidden space-y-2 rounded-2xl bg-black/20 p-3 sm:block">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${i === 0 ? 'bg-violet-500/25' : ''}`}>
                <span className={`h-4 w-4 rounded-md ${i === 0 ? 'bg-violet-300' : 'bg-white/20'}`} />
                <span className="h-2 flex-1 rounded-full bg-white/15" />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {tiles.map(({ label, value, icon: TileIcon, tone }) => (
                <div key={label} className="rounded-2xl bg-black/20 p-3 sm:p-4">
                  <span className={`inline-flex rounded-lg p-1.5 ${tone}`}>
                    <TileIcon weight="duotone" className="h-4 w-4" />
                  </span>
                  <p className="mt-2 truncate text-[11px] text-slate-400">{label}</p>
                  <p className="text-lg font-bold sm:text-2xl">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="mb-3 text-xs font-medium text-slate-400">{labels.chart}</p>
              <div className="flex h-32 items-end gap-2 sm:h-40 sm:gap-3">
                {PREVIEW_BARS.map((h, i) => (
                  <div
                    key={i}
                    className="lp-bar flex-1 rounded-t-lg bg-linear-to-t from-violet-600 via-fuchsia-500 to-pink-400"
                    style={{ height: `${h}%`, animationDelay: `${0.7 + i * 0.08}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-glass lp-float absolute -left-3 top-24 hidden items-center gap-3 rounded-2xl px-4 py-3 md:flex lg:-left-10">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
          <TrendUp weight="bold" className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] text-slate-400">{labels.revenue}</p>
          <p className="text-sm font-bold text-emerald-300">+12.4%</p>
        </div>
      </div>
      <div className="lp-glass lp-float-slow absolute -right-3 bottom-16 hidden items-center gap-3 rounded-2xl px-4 py-3 md:flex lg:-right-10">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/25 text-violet-200">
          <ShoppingCart weight="duotone" className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] text-slate-400">{labels.orders}</p>
          <p className="text-sm font-bold">#1285</p>
        </div>
      </div>
    </div>
  )
}
