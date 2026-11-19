'use client'

import { Landmark, Mail, Phone, Tags } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LocationLine, ProfileCard, ProfileLine } from '@/components/shared/profile-lines'

export function CustomerProfileCard({ customer, onOpenMap }: { customer: any; onOpenMap: () => void }) {
  const t = useTranslations()
  return (
    <ProfileCard title={t('sales.customerDetail.profile')}>
      {customer.customer_categories?.name && (
        <ProfileLine icon={Tags} label={t('sales.category')}>
          {customer.customer_categories.name}
        </ProfileLine>
      )}
      {customer.phone && (
        <ProfileLine icon={Phone} label={t('common.phone')}>
          {customer.phone}
        </ProfileLine>
      )}
      {customer.email && (
        <ProfileLine icon={Mail} label={t('common.email')}>
          <span className="break-all">{customer.email}</span>
        </ProfileLine>
      )}
      {customer.tin && (
        <ProfileLine icon={Landmark} label={t('sales.tin')}>
          {customer.tin}
        </ProfileLine>
      )}
      <LocationLine row={customer} label={t('common.address')} openLabel={t('sales.customerDetail.viewLargerMap')} onOpen={onOpenMap} />
      {customer.notes && (
        <div className="border-t pt-3">
          <span className="mb-1 block text-xs text-muted-foreground">{t('common.description')}</span>
          <p className="text-xs leading-relaxed text-muted-foreground">{customer.notes}</p>
        </div>
      )}
    </ProfileCard>
  )
}
