import { requireResourceView } from '@/lib/permissions-server'

export default async function InventoryProductsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('inventory', 'products', lang)
  return children
}
