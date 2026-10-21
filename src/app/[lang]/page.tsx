import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getTenantSubdomain } from '@/lib/tenant-host'
import { LandingPage } from '@/components/landing/landing-page'

/**
 * `/<lang>` answers differently per host: a company's subdomain goes straight
 * to its dashboard, while the bare host (falco.business / www.) is the public
 * landing page. src/proxy.ts lets this path through without a session on the
 * bare host only.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing')
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    openGraph: { title: t('metaTitle'), description: t('metaDescription'), siteName: 'Falco', type: 'website' },
  }
}

export default async function LangRootPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (getTenantSubdomain((await headers()).get('host') ?? '')) {
    redirect(`/${lang}/dashboard`)
  }
  return <LandingPage lang={lang} />
}
