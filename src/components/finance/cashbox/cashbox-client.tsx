'use client'

import { AlertCircle, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/shared/page-header'
import { PeriodFilter } from '@/components/shared/period-filter'
import { useQueryParams } from '@/lib/hooks/use-query-params'
import { createClient } from '@/lib/supabase/client'
import { CashboxFormDialog } from './cashbox-form-dialog'
import { CashboxListCard } from './cashbox-list-card'
import { CashboxTransactionsCard } from './cashbox-transactions-card'
import { MovementDialog } from './movement-dialog'
import type { CashboxPageData, CashboxPeriod } from './cashbox-types'
import { useCashboxEditor } from './use-cashbox-editor'
import { useCashboxMovement } from './use-cashbox-movement'
import { useCashboxSnapshot } from './use-cashbox-snapshot'
import { useMovementDeepLink } from './use-movement-deep-link'

export type { CashboxPageData }

interface CashboxClientProps {
  lang: string
  initialData: CashboxPageData
  period: CashboxPeriod
  customStart: string
  customEnd: string
}

export function CashboxClient({ lang, initialData, period, customStart, customEnd }: CashboxClientProps) {
  const t = useTranslations()
  const supabase = createClient() as any
  const { setParams } = useQueryParams()
  const { snapshot, offline, replaceLists } = useCashboxSnapshot(initialData)
  const editor = useCashboxEditor({ supabase, snapshot, replaceLists })
  const movement = useCashboxMovement({ supabase, snapshot, replaceLists })
  useMovementDeepLink(snapshot, movement.openFor)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('finance.cashbox')}
        subtitle={t('finance.title')}
        info={t('pageInfo.cashbox')}
        action={{ label: t('finance.addCashbox'), onClick: () => editor.openFor(null), icon: Plus }}
        breadcrumbs={[{ label: 'Falco', href: `/${lang}/dashboard` }, { label: t('finance.title') }, { label: t('finance.cashbox') }]}
      >
        <PeriodFilter
          period={period}
          onPeriodChange={(next) => setParams({ period: next, from: null, to: null })}
          customStart={customStart}
          customEnd={customEnd}
          onApplyCustomRange={(from, to) => setParams({ period: 'custom', from, to })}
          lang={lang}
        />
      </PageHeader>

      {offline && <OfflineNotice />}

      <CashboxListCard
        cashboxes={snapshot.cashboxes}
        onMove={(cashbox, type) => movement.openFor(cashbox, type)}
        onEdit={editor.openFor}
        onDelete={editor.remove}
      />

      <CashboxTransactionsCard transactions={snapshot.transactions} cashboxes={snapshot.cashboxes} lang={lang} />

      {editor.open && (
        <CashboxFormDialog
          key={editor.editing?.id ?? 'new'}
          onOpenChange={editor.setOpen}
          cashbox={editor.editing}
          onSubmit={editor.save}
          isSaving={editor.saving}
          lang={lang}
        />
      )}
      <MovementDialog movement={movement} snapshot={snapshot} lang={lang} />
      {editor.confirmDialog}
    </div>
  )
}

function OfflineNotice() {
  const t = useTranslations('finance')
  return (
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
      <AlertCircle className="size-5 shrink-0 text-amber-600" />
      <div className="space-y-1">
        <p className="font-semibold">{t('cashboxTableMissing')}</p>
        <p className="opacity-90">{t('cashboxTableMissingHint')}</p>
      </div>
    </div>
  )
}
