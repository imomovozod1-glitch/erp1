import Link from 'next/link'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { MobileMenu } from '@/components/landing/mobile-menu'
import { Reveal } from '@/components/landing/reveal'
import { ArrowRight, AndroidLogo, AppleLogo, Check, DownloadSimple, Phone } from '@phosphor-icons/react/dist/ssr'
import { TEXT_BODY, TEXT_MUTED, ACCENT, primaryButton, glassButton } from '@/components/landing/landing-theme'
import { MODULES, type LandingContext } from '@/components/landing/landing-content'
import { Logo, HeroPreview } from '@/components/landing/landing-parts'

/** The floating glass header: logo, anchors, language, theme, login and the phone menu. */
export function LandingHeader({ ctx }: { ctx: LandingContext }) {
  const { t, loginHref, navLinks } = ctx
  return (
    <>
      {/* ── Floating glass header ──────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-4 z-50 px-4">
        <div className="lp-glass relative mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-full pl-5 pr-2.5">
          <a href="#top" aria-label="Falco">
            <Logo />
          </a>
          <nav className={`hidden items-center gap-1 text-sm font-medium md:flex ${TEXT_BODY}`}>
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-4 py-2 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <LocaleSwitcher mode="path" className="hidden md:flex" />
            <ThemeToggle className="rounded-full" />
            <Link
              href={loginHref}
              className="inline-flex h-9 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition-transform duration-300 hover:scale-105 dark:bg-white dark:text-slate-900"
            >
              {t('login')}
            </Link>
            <MobileMenu links={navLinks} label={t('menuLabel')}>
              <LocaleSwitcher mode="path" />
            </MobileMenu>
          </div>
        </div>
      </header>

    </>
  )
}

/** The hero with the product preview, then the headline figures. */
export function LandingHero({ ctx }: { ctx: LandingContext }) {
  const { t, contact, platforms, stats } = ctx
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="lp-grid-bg absolute inset-0" />
          <div className="lp-blob -left-24 top-10 h-[26rem] w-[26rem] bg-violet-500/40 dark:bg-violet-600/40" />
          <div className="lp-blob right-0 top-0 h-[30rem] w-[30rem] bg-fuchsia-500/30 [animation-delay:-6s] dark:bg-fuchsia-600/25" />
          <div className="lp-blob bottom-0 left-1/3 h-[22rem] w-[22rem] bg-cyan-400/30 [animation-delay:-11s] dark:bg-cyan-500/20" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-24 pt-36 sm:px-6 lg:pb-32 lg:pt-44">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="lp-glass lp-sheen inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-200">
                {t('heroBadge')}
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                {t('heroTitle')} <span className="lp-text-gradient">{t('heroTitleAccent')}</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className={`mx-auto mt-7 max-w-2xl text-lg leading-relaxed ${TEXT_BODY}`}>{t('heroSubtitle')}</p>
            </Reveal>
            <Reveal delay={300} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#start" className={primaryButton}>
                {t('ctaStart')}
                <ArrowRight weight="bold" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
              <a href={contact.phone} className={glassButton}>
                <Phone weight="fill" className={`h-4 w-4 ${ACCENT}`} />
                {contact.phoneLabel}
              </a>
            </Reveal>
            <Reveal delay={400}>
              <ul className={`mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-sm ${TEXT_MUTED}`}>
                {[t('heroPointLanguages'), t('heroPointMobile', { platforms }), t('heroPointCloud')].map((text) => (
                  <li key={text} className="flex items-center gap-2">
                    <Check weight="bold" className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                    {text}
                  </li>
                ))}
              </ul>
              {(contact.apk || contact.ios) && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                  {contact.apk && (
                    <a href={contact.apk} className={`inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline ${ACCENT}`}>
                      <AndroidLogo weight="fill" className="h-4 w-4" />
                      {t('appDownloadAndroid')}
                      <DownloadSimple weight="bold" className="h-4 w-4" />
                    </a>
                  )}
                  {contact.ios && (
                    <a href={contact.ios} className={`inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline ${ACCENT}`}>
                      <AppleLogo weight="fill" className="h-4 w-4" />
                      {t('appDownloadIos')}
                      <DownloadSimple weight="bold" className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </Reveal>
          </div>

          <Reveal delay={500} className="mt-20">
            <HeroPreview
              title={t('previewTitle')}
              chips={{ app: t('chipApp', { platforms }), languages: t('chipLanguages') }}
              tiles={MODULES.map(({ key, icon, from, to }) => ({ key, icon, from, to, label: t(`modules.${key}.title`) }))}
            />
          </Reveal>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <section className="relative px-4 pb-8 sm:px-6">
        <Reveal className="lp-glass mx-auto grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-3xl bg-slate-900/5 sm:grid-cols-3 dark:bg-white/5">
          {stats.map(({ value, label }) => (
            <div key={label} className="bg-white/70 px-6 py-8 text-center dark:bg-[#0a0b18]/70">
              <p className="lp-text-gradient text-4xl font-extrabold tracking-tight sm:text-5xl">{value}</p>
              <p className={`mt-2 text-sm ${TEXT_MUTED}`}>{t(label, { platforms })}</p>
            </div>
          ))}
        </Reveal>
      </section>
    </>
  )
}
