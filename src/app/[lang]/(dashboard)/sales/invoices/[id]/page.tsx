import { InvoiceDetailClient } from '@/components/sales/invoice-detail/invoice-detail-client'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params
  return <InvoiceDetailClient id={id} lang={lang} />
}
