'use client'

import { useState } from 'react'
import { Search, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { CashboxRowActions } from './cashbox-actions'
import { CashboxMobileList } from './cashbox-mobile-list'
import { CashboxTable } from './cashbox-table'
import type { Cashbox } from './cashbox-types'

const matches = (cashbox: Cashbox, query: string) =>
  [cashbox.name, cashbox.description].some((field) => (field ?? '').toLowerCase().includes(query))

const totalOf = (cashboxes: Cashbox[]) => cashboxes.reduce((sum, cb) => sum + (Number(cb.balance) || 0), 0)

export function CashboxListCard({ cashboxes, ...actions }: CashboxRowActions & { cashboxes: Cashbox[] }) {
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')
  const visible = cashboxes.filter((cashbox) => matches(cashbox, search.toLowerCase()))
  const total = totalOf(visible)

  return (
    <Card className="border-0 shadow-sm max-md:bg-transparent max-md:shadow-none">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-4 max-md:border-0 max-md:px-3 max-md:pb-0">
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`${tCommon('search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9 md:h-9"
            />
          </div>
        </div>
        {visible.length === 0 ? (
          <EmptyCashboxes />
        ) : (
          <>
            <CashboxMobileList cashboxes={visible} total={total} {...actions} />
            <CashboxTable cashboxes={visible} total={total} {...actions} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyCashboxes() {
  const tCommon = useTranslations('common')
  return (
    <div data-slot="table-container" className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
      <Wallet className="size-8 opacity-40" />
      <p className="text-sm">{tCommon('noData')}</p>
    </div>
  )
}
