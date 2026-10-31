import { requireResourceView } from '@/lib/permissions-server'

export default async function InventoryMovementsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('inventory', 'movements', lang)
  return children
}
