import { ReportsTabs } from '@/components/reports/reports-tabs'

interface ReportsPageProps {
  params: Promise<{ lang: string }>
}

/**
 * The hub is a menu, so it fetches nothing: each report loads its own data
 * when it is opened. Previously this page pulled the full analytics and
 * dashboard aggregates before rendering, which every visitor paid for even
 * when they were on their way to one specific report.
 */
export default async function ReportsPage({ params }: ReportsPageProps) {
  const { lang } = await params

  return (
    <ReportsTabs
      // `new Date()` on the server, not in the client component: an impure
      // call during render is a React Compiler lint error (see AGENTS.md).
      today={new Date().toISOString().slice(0, 10)}
      lang={lang}
    />
  )
}
