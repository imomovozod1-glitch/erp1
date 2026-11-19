import Link from 'next/link'
import { LocaleSwitcher } from '@/components/shared/locale-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { LeadForm } from '@/components/landing/lead-form'
import { Reveal } from '@/components/landing/reveal'
import { AndroidLogo, AppleLogo, Phone, TelegramLogo } from '@phosphor-icons/react/dist/ssr'
import { TEXT_MUTED, ACCENT, HAIRLINE } from '@/components/landing/landing-theme'
import { type LandingContext } from '@/components/landing/landing-content'
import { Logo, SectionHeading } from '@/components/landing/landing-parts'

/** The sign-up request, posted to /api/leads. */
export function LandingSignup({ ctx }: { ctx: LandingContext }) {
  const { t, contact, lang } = ctx
  return (
    <>
      {/* ── Sign-up request ──────────────────────────────────────────── */}
      <section id="start" className="relative scroll-mt-4 px-4 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow={t('formEyebrow')} title={t('formTitle')} subtitle={t('formSubtitle')} />
          <Reveal>
            <div className="lp-glass relative isolate overflow-hidden rounded-[2rem] p-6 sm:p-10">
              <div aria-hidden className="lp-blob -left-10 -top-20 -z-10 h-64 w-64 bg-violet-500/40 dark:bg-violet-600/40" />
              <div aria-hidden className="lp-blob -bottom-24 right-0 -z-10 h-64 w-64 bg-fuchsia-500/30 [animation-delay:-8s] dark:bg-fuchsia-600/30" />
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
                  consent: t('formConsent'),
                  required: t('formRequired'),
                }}
              />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}

/** Contacts, app downloads and the small print. */
export function LandingFooter({ ctx }: { ctx: LandingContext }) {
  const { t, contact, loginHref, navLinks } = ctx
  return (
    <>
      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className={`border-t bg-slate-900/[0.03] dark:bg-black/20 ${HAIRLINE}`}>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className={`mt-4 max-w-xs text-sm leading-relaxed ${TEXT_MUTED}`}>{t('footerTagline')}</p>
          </div>
          <nav className={`flex flex-col gap-3 text-sm ${TEXT_MUTED}`}>
            {navLinks.map(({ href, label }) => (
              <a key={href} href={href} className="w-fit transition-colors hover:text-slate-900 dark:hover:text-white">
                {label}
              </a>
            ))}
            <Link href={loginHref} className="w-fit transition-colors hover:text-slate-900 dark:hover:text-white">
              {t('login')}
            </Link>
          </nav>
          <div className={`flex flex-col gap-3 text-sm ${TEXT_MUTED}`}>
            <a href={contact.phone} className="flex w-fit items-center gap-2 transition-colors hover:text-slate-900 dark:hover:text-white">
              <Phone weight="duotone" className={`h-4 w-4 ${ACCENT}`} />
              {contact.phoneLabel}
            </a>
            {contact.telegram && (
              <a href={contact.telegram} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-2 transition-colors hover:text-slate-900 dark:hover:text-white">
                <TelegramLogo weight="duotone" className={`h-4 w-4 ${ACCENT}`} />
                Telegram
              </a>
            )}
            {contact.apk && (
              <a href={contact.apk} className="flex w-fit items-center gap-2 transition-colors hover:text-slate-900 dark:hover:text-white">
                <AndroidLogo weight="duotone" className={`h-4 w-4 ${ACCENT}`} />
                {t('appDownloadAndroid')}
              </a>
            )}
            {contact.ios && (
              <a href={contact.ios} className="flex w-fit items-center gap-2 transition-colors hover:text-slate-900 dark:hover:text-white">
                <AppleLogo weight="duotone" className={`h-4 w-4 ${ACCENT}`} />
                {t('appDownloadIos')}
              </a>
            )}
          </div>
        </div>
        <div className={`border-t ${HAIRLINE}`}>
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 pb-24 pt-6 text-sm text-slate-500 sm:flex-row sm:px-6 md:pb-6">
            <p>© {new Date().getFullYear()} Falco. {t('footerRights')}</p>
            <div className="flex items-center gap-2">
              <LocaleSwitcher mode="path" />
              <ThemeToggle className="rounded-full" />
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
