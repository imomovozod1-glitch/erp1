import { requireResourceView } from '@/lib/permissions-server'

export default async function InventoryUnitsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('inventory', 'units', lang)
  return children
}
