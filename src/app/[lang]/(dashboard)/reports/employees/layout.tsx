import { requireResourceView } from '@/lib/permissions-server'

export default async function EmployeesReportLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  await requireResourceView('analytics', 'employees', lang)
  return children
}
