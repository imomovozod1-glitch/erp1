import { requireResourceView } from '@/lib/permissions-server'

export default async function SalesReportLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('analytics', 'sales', lang)
  return children
}
