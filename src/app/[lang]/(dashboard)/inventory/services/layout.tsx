import { requireResourceView } from '@/lib/permissions-server'

export default async function InventoryServicesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('inventory', 'services', lang)
  return children
}
