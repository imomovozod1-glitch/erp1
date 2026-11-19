'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormFooter } from '@/components/shared/form-footer'
import { ItemPicker } from '@/components/shared/item-picker'
import { NameSelect } from '@/components/shared/name-select'
import { isService } from '@/lib/product-kind'
import { cn, formatCurrency } from '@/lib/utils'
import { PaymentMethodPicker } from './payment-method-picker'
import { SaleLinesTable } from './sale-lines-table'
import type { SaleProduct } from './sale-lines'
import { useSaleForm, type SaleFormState } from './use-sale-form'

interface SaleFormProps {
  products: SaleProduct[]
  customers: { id: string; name: string }[]
  assignableUsers: AssignableUser[]
  lang: string
}

function Section({ title, className, children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cn('border shadow-sm', className)}>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn('space-y-3', !title && 'pt-6')}>{children}</CardContent>
    </Card>
  )
}

function ProductPicker({ products, form }: { products: SaleProduct[]; form: SaleFormState }) {
  const t = useTranslations()
  const options = products.map((p) => ({
    id: p.id,
    name: p.name,
    keywords: p.sku ?? '',
    meta: isService(p) ? t('inventory.service') : `${t('sales.availableStock')}: ${p.stock} ${p.unit}`,
    trailing: formatCurrency(p.price),
    badge: form.items.find((i) => i.productId === p.id)?.quantity ?? null,
    disabled: !isService(p) && p.stock <= 0,
  }))
  return (
    <ItemPicker
      options={options}
      onPick={(option) => {
        const product = products.find((p) => p.id === option.id)
        return product ? form.addProduct(product) : false
      }}
      placeholder={`${t('sales.selectProduct')}...`}
      emptyLabel={t('sales.noProductsFound')}
      hint={t('sales.clickToAddHint')}
    />
  )
}

export function SaleForm({ products, customers, assignableUsers, lang }: SaleFormProps) {
  const t = useTranslations()
  const form = useSaleForm(products, customers, lang)
  const debtWithoutCustomer = form.paymentMethod === 'debt' && !form.customerId

  return (
    <form onSubmit={form.submit} className="space-y-6">
      <Section title={t('sales.customer')}>
        <div className="max-w-sm">
          <NameSelect value={form.customerId} onChange={form.setCustomerId} options={customers} placeholder={t('common.select')} clearLabel={t('common.select')} />
        </div>
      </Section>
      <Section>
        <div className="max-w-sm">
          <AssigneeSelect value={form.assignedTo} onChange={form.setAssignedTo} users={assignableUsers} />
        </div>
      </Section>
      <Section title={t('pos.paymentMethod')}>
        <PaymentMethodPicker value={form.paymentMethod} onChange={form.setPaymentMethod} />
        {debtWithoutCustomer && <p className="text-xs font-medium text-amber-600">{t('sales.selectCustomerForDebtHint')}</p>}
      </Section>
      <Section title={t('sales.addItem')} className="overflow-visible">
        <ProductPicker products={products} form={form} />
      </Section>
      <SaleLinesTable form={form} />
      <FormFooter>
        <Button type="button" variant="outline" onClick={() => form.exitForm()} disabled={form.submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={form.submitting || !form.items.length || debtWithoutCustomer}>
          {t(form.submitting ? 'common.loading' : 'common.save')}
        </Button>
      </FormFooter>
    </form>
  )
}
