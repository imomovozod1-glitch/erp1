'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DetailBanner, KpiGrid, KpiTile } from '@/components/shared/detail-page'
import { formatCurrency, getInitials } from '@/lib/utils'
import { CustomerActivityTabs } from './customer-activity-tabs'
import { customerMetrics, exportCustomer, type CustomerActivity } from './customer-metrics'
import { CustomerProfileCard } from './customer-profile-card'

const LocationMapDialog = dynamic(() => import('@/components/shared/location-map-dialog').then((m) => m.LocationMapDialog), {
  ssr: false,
})

interface CustomerDetailClientProps extends CustomerActivity {
  lang: string
  customer: any
}

const balanceTone = (balance: number) =>
  balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : balance < 0 ? 'text-rose-600 dark:text-rose-400' : undefined

const signedAmount = (value: number) => `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatCurrency(Math.abs(value))}`

function CustomerKpis({ customer, activity }: { customer: any; activity: CustomerActivity }) {
  const t = useTranslations()
  const detail = (key: string, values?: Record<string, number>) => t(`sales.customerDetail.${key}`, values)
  const m = customerMetrics(customer, activity)
  return (
    <KpiGrid>
      <KpiTile label={detail('totalPurchases')} value={formatCurrency(m.purchases)}>
        {detail('salesCount', { count: activity.salesOrders.length })}
      </KpiTile>
      <KpiTile label={detail('totalPaid')} value={formatCurrency(m.paid)} valueClassName="text-emerald-700 dark:text-emerald-400">
        {detail('invoicesCount', { count: activity.invoices.length })}
      </KpiTile>
      <KpiTile label={t('sales.balanceRemaining')} value={signedAmount(m.balance)} valueClassName={balanceTone(m.balance)}>
        <span className="tabular-nums">
          {t('sales.debt')}: {formatCurrency(m.debt)} · {t('sales.credit')}: {formatCurrency(m.credit)}
        </span>
      </KpiTile>
      <KpiTile label={t('common.status')} value={t(customer.is_active ? 'common.active' : 'common.inactive')}>
        {detail('contact')}: {customer.phone || '—'}
      </KpiTile>
    </KpiGrid>
  )
}

export function CustomerDetailClient({ lang, customer, salesOrders, invoices, transactions }: CustomerDetailClientProps) {
  const t = useTranslations()
  const [mapOpen, setMapOpen] = useState(false)
  const activity = { salesOrders, invoices, transactions }
  const avatar = (
    <Avatar className="size-14">
      <AvatarFallback className="bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-400">
        {getInitials(customer.name)}
      </AvatarFallback>
    </Avatar>
  )
  return (
    <div className="space-y-6">
      <DetailBanner
        leading={avatar}
        title={customer.name}
        subtitle={customer.phone || customer.email || undefined}
        active={customer.is_active}
        onExport={() => exportCustomer(customer, activity, t)}
      />
      <CustomerKpis customer={customer} activity={activity} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CustomerProfileCard customer={customer} onOpenMap={() => setMapOpen(true)} />
        <div className="lg:col-span-2">
          <CustomerActivityTabs activity={activity} lang={lang} />
        </div>
      </div>
      <LocationMapDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        address={customer.address}
        latitude={customer.latitude}
        longitude={customer.longitude}
        title={customer.name}
        lang={lang}
      />
    </div>
  )
}
