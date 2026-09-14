'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Contact,
  Layers,
  Table2,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { ReportBuilder } from '@/components/reports/report-builder'
import { PageHeader } from '@/components/shared/page-header'

/**
 * The Reports hub.
 *
 * Two tabs, restored: a catalogue of the reports the business actually asks
 * for, and the builder for the question nobody anticipated.
 *
 * The first tab used to be one enormous overview — a dozen configurable KPI
 * tiles, a revenue chart, a top-products list, recent orders, low stock and a
 * sold-products table, all on one screen with a view-settings dialog to hide
 * the parts you didn't want. Every visitor paid for every block and nobody
 * could point at "the employee report", because there wasn't one. It is now a
 * menu: five focused reports, each with its own period, its own daily chart
 * and its own table.
 */

interface ReportCard {
  key: 'sales' | 'employees' | 'customers' | 'products' | 'abc'
  href: string
  icon: LucideIcon
}

const REPORT_CARDS: ReportCard[] = [
  { key: 'sales', href: 'reports/sales', icon: TrendingUp },
  { key: 'employees', href: 'reports/employees', icon: Users },
  { key: 'customers', href: 'reports/customers', icon: Contact },
  { key: 'products', href: 'reports/products', icon: Boxes },
  { key: 'abc', href: 'reports/abc', icon: Layers },
]

export function ReportsTabs({ today, lang }: { today: string; lang: string }) {
  const tInfo = useTranslations('pageInfo')
  const t = useTranslations('reports')

  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog')

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? 'bg-white text-violet-600 shadow-sm dark:bg-slate-700 dark:text-violet-400'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
    }`

  return (
    <div>
      <PageHeader
        title={t('title')}
        info={tInfo('analytics')}
        breadcrumbs={[{ label: 'ERP', href: `/${lang}/dashboard` }, { label: t('title') }]}
      >
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button type="button" onClick={() => setTab('catalog')} className={tabClass(tab === 'catalog')}>
            <BarChart3 className="h-3.5 w-3.5" />
            {t('catalog')}
          </button>
          <button type="button" onClick={() => setTab('custom')} className={tabClass(tab === 'custom')}>
            <Table2 className="h-3.5 w-3.5" />
            {t('custom')}
          </button>
        </div>
      </PageHeader>

      {tab === 'catalog' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {REPORT_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.key}
                href={`/${lang}/${card.href}`}
                prefetch={false}
                className="group flex flex-col justify-between gap-6 rounded-xl border border-slate-200 bg-white p-5 transition-colors duration-200 hover:border-violet-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-600"
              >
                <div className="flex items-start gap-4">
                  <span className="shrink-0 rounded-lg bg-slate-100 p-2.5 text-slate-600 transition-colors group-hover:bg-violet-50 group-hover:text-violet-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-violet-950/40 dark:group-hover:text-violet-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                      {t(`cards.${card.key}.title`)}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {t(`cards.${card.key}.desc`)}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-400">
                  {t('openReport')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            )
          })}
        </div>
      ) : (
        <ReportBuilder today={today} />
      )}
    </div>
  )
}
