import { getCachedSalesReportData } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { SalesOverviewReport } from '@/components/reports/sales-overview-report'
import { isoDate } from '@/lib/utils'

export default async function SalesReportPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId()
  const data = await getCachedSalesReportData(tenantId as string)

  return (
    <SalesOverviewReport
      lang={lang}
      today={isoDate()}
      orders={data.orders}
      items={data.items}
    />
  )
}
