import { getCachedSalesReportData } from '@/lib/data/queries'
import { getCurrentTenantId } from '@/lib/tenant'
import { ProductSalesReport } from '@/components/reports/product-sales-report'

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
      today={new Date().toISOString().slice(0, 10)}
      orders={data.orders}
      items={data.items}
      products={data.products}
    />
  )
}
