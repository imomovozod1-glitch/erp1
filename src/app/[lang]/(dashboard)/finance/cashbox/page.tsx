import type { Metadata } from 'next'
import { CashboxClient } from '@/components/finance/cashbox-client'

export const metadata: Metadata = { title: 'Cashbox' }

export default async function CashboxPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params

  return (
    <div className="px-4 md:px-8">
      <CashboxClient lang={lang} />
    </div>
  )
}
