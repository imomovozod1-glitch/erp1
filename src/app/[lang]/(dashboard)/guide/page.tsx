import type { Metadata } from 'next'
import { Info } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Basics, FaqLink, GuideToc, ModuleSections, QuickStart } from '@/components/guide/guide-parts'
import { PageHeader } from '@/components/shared/page-header'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'nav' })
  return { title: t('guide') }
}

export default async function GuidePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations('guide')
  return (
    <div className="space-y-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} breadcrumbs={[{ label: 'Falco', href: `/${lang}/dashboard` }, { label: t('title') }]} />
      <div className="flex items-start gap-3 rounded-xl border-0 bg-violet-50 p-4 shadow-sm dark:bg-violet-950/30">
        <Info className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-400" />
        <p className="text-sm leading-relaxed text-violet-900 dark:text-violet-200">{t('intro')}</p>
      </div>
      <GuideToc />
      <QuickStart />
      <Basics />
      <ModuleSections lang={lang} />
      <FaqLink lang={lang} />
    </div>
  )
}
