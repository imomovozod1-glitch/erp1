import { requireResourceView } from '@/lib/permissions-server'

export default async function FinanceTransactionsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('finance', 'transactions', lang)
  return children
}
