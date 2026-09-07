import type { Metadata } from 'next'
import { CashboxClient } from '@/components/finance/cashbox-client'

export const metadata: Metadata = { title: 'Cashbox' }

export default async function CashboxPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params

  return (
    <CashboxClient lang={lang} />
  )
}
