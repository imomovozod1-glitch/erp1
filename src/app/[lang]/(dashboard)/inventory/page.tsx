import { redirect } from 'next/navigation'

export default async function InventoryRootPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/inventory/products`)
}
