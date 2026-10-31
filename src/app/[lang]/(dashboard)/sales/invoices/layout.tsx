import { requireResourceView } from '@/lib/permissions-server'

export default async function SalesInvoicesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('sales', 'invoices', lang)
  return children
}
