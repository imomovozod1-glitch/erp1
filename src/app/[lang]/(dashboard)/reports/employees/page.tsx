import { getCachedSalesReportData } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { GroupedSalesReport } from '@/components/reports/grouped-sales-report'
import { isoDate } from '@/lib/utils'

export default async function EmployeeSalesReportPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId()
  const data = await getCachedSalesReportData(tenantId as string)

  return (
    <GroupedSalesReport
      lang={lang}
      today={isoDate()}
      dimension="seller"
      orders={data.orders}
      items={data.items}
    />
  )
}
