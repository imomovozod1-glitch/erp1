'use client'

import { useState } from 'react'
import { List, Map as MapIcon } from 'lucide-react'
import { CustomersTable } from './customers-table'
import { AllCustomersMap } from './all-customers-map'

interface CustomersViewTabsProps {
  /** Current page of customers, for the list tab. */
  customers: any[]
  /** Every customer that has coordinates, for the map tab. */
  mapCustomers: any[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  lang: string
}

export function CustomersViewTabs({
  customers,
  mapCustomers,
  lang,
  page,
  pageSize,
  total,
  totalPages,
}: CustomersViewTabsProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list')

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'list'
              ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
          }`}
        >
          <List className="h-3.5 w-3.5" />
          {lang === 'uz' ? "Ro'yxat" : lang === 'ru' ? 'Список' : 'List'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'map'
              ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
          }`}
        >
          <MapIcon className="h-3.5 w-3.5" />
          {lang === 'uz' ? 'Xarita' : lang === 'ru' ? 'Карта' : 'Map'}
        </button>
      </div>

      {activeTab === 'list' ? (
        <CustomersTable
          customers={customers}
          lang={lang}
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
        />
      ) : (
        <AllCustomersMap customers={mapCustomers} lang={lang} />
      )}
    </div>
  )
}
