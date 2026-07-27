import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Scan } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ScannerInterface } from '@/components/tools/scanner-interface'

export const metadata: Metadata = { title: 'Smart Scanner' }

export default async function ScannerPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations('tools')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('scanner')}
        subtitle={t('scannerDesc')}
        breadcrumbs={[
          { label: 'ERP', href: `/${lang}/dashboard` },
          { label: t('title') },
          { label: t('scanner') },
        ]}
      />
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-6 rounded-2xl border border-indigo-100 mb-6">
        <div className="flex items-start gap-4">
          <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-sm shrink-0 mt-1">
            <Scan className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              Sun&apos;iy Intellekt Yordamida Hujjat Tahlili
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              Ushbu vosita yordamida har qanday hujjat (invoys, chek, shartnoma) rasmini yuklang va tizim Gemini AI orqali 
              undagi ma&apos;lumotlarni avtomatik tarzda o&apos;qib, tartiblab beradi. Bu jarayon ma&apos;lumotlarni qo&apos;lda kiritish 
              vaqtini tejaydi.
            </p>
          </div>
        </div>
      </div>
      <ScannerInterface />
    </div>
  )
}
