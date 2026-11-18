import { requireRecordView } from '@/lib/permissions-server'

/** A record outside the user's scope is not opened by URL either (see requireRecordView). */
export default async function RecordLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  await requireRecordView('sales', 'orders', 'sales_orders', id, lang, '/sales/orders')
  return children
}
