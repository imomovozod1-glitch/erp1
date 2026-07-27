import { redirect } from 'next/navigation'

export default async function ProcurementRootPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/procurement/suppliers`)
}
