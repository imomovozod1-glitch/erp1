import { requireResourceView } from '@/lib/permissions-server'

export default async function ProductionOrdersLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('production', 'orders', lang)
  return children
}
