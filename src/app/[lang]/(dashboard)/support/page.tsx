import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSessionUser, getCachedProfile } from '@/lib/auth'
import { SupportClient } from '@/components/support/support-client'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'support' })
  return { title: t('title') }
}

export default async function SupportPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const user = await getSessionUser()

  if (!user) {
    redirect(`/${lang}/login`)
  }

  const profile = await getCachedProfile(user.id)
  if (!profile) {
    redirect(`/${lang}/login`)
  }

  return <SupportClient lang={lang} />
}
