import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/shared/page-header'
import { FaqBrowser, type FaqCategory } from '@/components/support/faq-browser'

export const metadata: Metadata = { title: 'FAQ' }

export default async function FaqPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [t, tCommon] = await Promise.all([getTranslations('faq'), getTranslations('common')])

  // Authored as nested arrays in messages/{uz,ru,en}.json, so `raw` is the only
  // way to read them — `t()` would stringify the structure.
  const categories = t.raw('categories') as FaqCategory[]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: 'ERP', href: `/${lang}/dashboard` }, { label: t('title') }]}
      />

      <FaqBrowser
        categories={categories}
        intro={t('intro')}
        searchPlaceholder={t('searchPlaceholder')}
        noResults={tCommon('noResults')}
        allLabel={tCommon('all')}
        guideLabel={t('guideLink')}
        guideHref={`/${lang}/guide`}
        supportLabel={t('supportLink')}
        supportHref={`/${lang}/support`}
      />
    </div>
  )
}
