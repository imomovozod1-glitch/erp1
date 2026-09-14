import { getCachedSalesReportData } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { ProductSalesReport } from '@/components/reports/product-sales-report'
import { isoDate } from '@/lib/utils'

export default async function ProductSalesReportPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const tenantId = await getCurrentTenantId()
  const data = await getCachedSalesReportData(tenantId as string)

  return (
    <ProductSalesReport
      lang={lang}
      today={isoDate()}
      orders={data.orders}
      items={data.items}
      products={data.products}
    />
  )
}
