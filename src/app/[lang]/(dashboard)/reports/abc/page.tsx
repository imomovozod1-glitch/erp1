import { getCachedSalesReportData } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { AbcAnalysisReport } from '@/components/reports/abc-analysis-report'

export default async function AbcReportPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId()
  const data = await getCachedSalesReportData(tenantId as string)

  return (
    <AbcAnalysisReport
      lang={lang}
      today={new Date().toISOString().slice(0, 10)}
      items={data.items}
    />
  )
}
