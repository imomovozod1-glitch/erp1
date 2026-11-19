import { requireResourceView } from '@/lib/permissions-server'

export default async function CustomersReportLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('analytics', 'customers', lang)
  return children
}
