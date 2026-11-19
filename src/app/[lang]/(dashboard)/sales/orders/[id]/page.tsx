import { OrderDetailClient } from '@/components/sales/order-detail/order-detail-client'

export default async function OrderDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params
  return <OrderDetailClient id={id} lang={lang} />
}
