import Link from 'next/link'
import { BookOpen, HelpCircle, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function SupportAside() {
  const t = useTranslations('support')
  return (
    <div className="space-y-6 lg:col-span-2">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-violet-700 p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 size-32 translate-x-8 -translate-y-8 rounded-full bg-white/10" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold tracking-wider text-violet-100 uppercase">{t('liveStatus')}</span>
          </div>
          <h3 className="text-xl leading-snug font-extrabold">{t('alwaysConnected')}</h3>
          <p className="text-xs leading-relaxed text-violet-100/90">{t('liveStatusDesc')}</p>
          <div className="flex w-fit items-center gap-2 rounded-xl bg-white/15 px-3 py-2 pt-2 text-xs font-semibold">{t('premiumActive')}</div>
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border bg-muted/40 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-5 text-violet-600 dark:text-violet-400" />
          <span>{t('securityTitle')}</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('securityDesc')}</p>
      </div>
    </div>
  )
}

/** Self-service first: the guide and the FAQ say what the app really does. */
export function SelfServiceLinks({ lang }: { lang: string }) {
  const t = useTranslations('nav')
  const chip = 'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors'
  return (
    <div className="flex flex-wrap gap-3">
      <Link href={`/${lang}/faq`} className={`${chip} bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50`}>
        <HelpCircle className="size-3.5" />
        {t('faq')}
      </Link>
      <Link href={`/${lang}/guide`} className={`${chip} bg-muted text-foreground/80 hover:bg-muted/70`}>
        <BookOpen className="size-3.5" />
        {t('guide')}
      </Link>
    </div>
  )
}
