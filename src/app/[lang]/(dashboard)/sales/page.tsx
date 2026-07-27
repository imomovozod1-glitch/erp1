import { redirect } from 'next/navigation'

export default async function SalesRootPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/sales/orders`)
}
