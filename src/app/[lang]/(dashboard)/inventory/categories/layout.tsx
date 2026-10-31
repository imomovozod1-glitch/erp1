import { requireResourceView } from '@/lib/permissions-server'

export default async function InventoryCategoriesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('inventory', 'categories', lang)
  return children
}
