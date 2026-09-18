import { redirect } from 'next/navigation'

export default async function ProductionIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/production/orders`)
}
