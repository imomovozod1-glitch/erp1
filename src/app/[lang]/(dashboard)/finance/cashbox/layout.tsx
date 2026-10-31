import { requireResourceView } from '@/lib/permissions-server'

export default async function FinanceCashboxLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('finance', 'cashbox', lang)
  return children
}
