import { redirect } from 'next/navigation'

/**
 * The section was renamed Analytics → Reports. The route moved with it; this
 * keeps every old link, bookmark and browser-history entry working instead of
 * turning them into 404s. The permission module is still called `analytics`
 * internally (it is what is stored in `profiles.permissions`), so no tenant's
 * saved permissions had to be rewritten.
 */
export default async function AnalyticsRedirectPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/reports`)
}
