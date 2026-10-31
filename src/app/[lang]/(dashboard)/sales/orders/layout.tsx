import { requireResourceView } from '@/lib/permissions-server'

export default async function SalesOrdersLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('sales', 'orders', lang)
  return children
}
