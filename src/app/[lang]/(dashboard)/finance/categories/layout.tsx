import { requireResourceView } from '@/lib/permissions-server'

export default async function FinanceCategoriesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('finance', 'categories', lang)
  return children
}
