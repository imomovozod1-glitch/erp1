import { redirect } from 'next/navigation'

export default async function DistributionIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/distribution/deliveries`)
}
