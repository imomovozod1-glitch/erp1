import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getTenantSubdomain } from '@/lib/tenant-host'
import { LandingPage } from '@/components/landing/landing-page'
import { routing } from '@/i18n/routing'
import { ROOT_DOMAIN } from '@/lib/tenant-host'

/**
 * `/<lang>` answers differently per host: a company's subdomain goes straight
 * to its dashboard, while the bare host (falco.business / www.) is the public
 * landing page. src/proxy.ts lets this path through without a session on the
 * bare host only.
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations('landing')
  const description = t('metaDescription')
  return {
    title: { absolute: t('metaTitle') },
    description,
    // The page lives on the bare host; the apex redirects to www (see .env.example).
    metadataBase: new URL(`https://www.${ROOT_DOMAIN}`),
    alternates: {
      canonical: `/${lang}`,
      languages: Object.fromEntries(routing.locales.map((locale) => [locale, `/${locale}`])),
    },
    openGraph: { title: t('metaTitle'), description, siteName: 'Falco', type: 'website', locale: lang },
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
