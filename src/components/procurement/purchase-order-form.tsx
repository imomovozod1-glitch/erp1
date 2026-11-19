'use client'

import { Loader2, Sparkles, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormFooter } from '@/components/shared/form-footer'
import { ItemPicker } from '@/components/shared/item-picker'
import { LabeledField } from '@/components/shared/labeled-field'
import { NameSelect } from '@/components/shared/name-select'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { PurchaseCashbox, PurchaseProduct } from './purchase-form/purchase-lines'
import { PurchaseLinesTable } from './purchase-form/purchase-lines-table'
import { usePurchaseForm, type PurchaseFormState } from './purchase-form/use-purchase-form'

interface PurchaseOrderFormProps {
  assignableUsers: AssignableUser[]
  suppliers: { id: string; name: string }[]
  products: PurchaseProduct[]
  cashboxes?: PurchaseCashbox[]
  lang: string
}

function PaymentField({ form, cashboxes }: { form: PurchaseFormState; cashboxes: PurchaseCashbox[] }) {
  const t = useTranslations('procurement')
  const { cashbox, total } = form
  return (
    <LabeledField id="cashbox" label={t('payment.fromCashbox')}>
      <NameSelect
        id="cashbox"
        value={cashbox?.id ?? ''}
        onChange={(id) => form.setCashboxId(id || null)}
        options={cashboxes}
        placeholder={t('payment.onAccount')}
        clearLabel={t('payment.onAccount')}
        meta={(box) => <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(Number(box.balance) || 0)}</span>}
      />
      <p className="text-xs text-muted-foreground">
        {cashbox ? t('payment.paidFromHint', { amount: formatCurrency(total), cashbox: cashbox.name }) : t('payment.onAccountHint')}
      </p>
      {cashbox && (Number(cashbox.balance) || 0) < total && (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{t('payment.notEnoughInCashbox')}</p>
      )}
    </LabeledField>
  )
}

function SupplierCard({ form, suppliers, cashboxes, users }: { form: PurchaseFormState; suppliers: { id: string; name: string }[]; cashboxes: PurchaseCashbox[]; users: AssignableUser[] }) {
  const t = useTranslations()
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('procurement.supplier')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LabeledField id="supplier" label={t('procurement.selectSupplier')} required>
          <NameSelect id="supplier" value={form.supplierId} onChange={form.setSupplierId} options={suppliers} placeholder={t('common.select')} />
        </LabeledField>
        <PaymentField form={form} cashboxes={cashboxes} />
        <AssigneeSelect value={form.assignedTo} onChange={form.setAssignedTo} users={users} />
        <LabeledField id="notes" label={t('common.notes')}>
          <Textarea id="notes" value={form.notes} onChange={(e) => form.setNotes(e.target.value)} placeholder={t('common.notes')} rows={3} />
        </LabeledField>
      </CardContent>
    </Card>
  )
}

function ScanCard({ form }: { form: PurchaseFormState }) {
  const t = useTranslations()
  return (
    <Card className="border bg-brand-subtle shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
          {t('procurement.scanInvoice')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{t('procurement.scanInvoiceDesc')}</p>
        <label
          aria-disabled={form.scanning}
          className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-200 text-violet-700 transition-colors hover:border-violet-400 hover:bg-violet-50/50 aria-disabled:pointer-events-none aria-disabled:opacity-70 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/40"
        >
          <input type="file" accept="image/*" onChange={form.scanInvoice} disabled={form.scanning} className="hidden" />
          {form.scanning ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-6" />}
          <span className="text-sm font-medium">{t(form.scanning ? 'procurement.scan.analyzing' : 'common.uploadImage')}</span>
        </label>
      </CardContent>
    </Card>
  )
}

function ProductPicker({ form }: { form: PurchaseFormState }) {
  const t = useTranslations()
  const options = form.products.map((p) => ({
    id: p.id,
    name: p.name,
    keywords: p.sku ?? '',
    meta: `${t('procurement.quantity')}: ${formatNumber(Number(p.stock) || 0)} ${p.unit ?? ''}`.trim(),
    trailing: formatCurrency(Number(p.cost_price) || 0),
    badge: form.lines.find((l) => l.productId === p.id)?.quantity ?? null,
  }))
  return (
    <Card className="overflow-visible border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('procurement.addItem')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ItemPicker
          options={options}
          onPick={(option) => form.addProduct(option.id)}
          placeholder={`${t('procurement.selectProduct')}...`}
          emptyLabel={t('common.noData')}
          hint={t('procurement.clickToAddItemHint')}
        />
      </CardContent>
    </Card>
  )
}

export function PurchaseOrderForm({ suppliers, products, cashboxes = [], lang, assignableUsers }: PurchaseOrderFormProps) {
  const t = useTranslations('common')
  const form = usePurchaseForm({ suppliers, products, cashboxes, lang })
  return (
    <form onSubmit={form.submit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SupplierCard form={form} suppliers={suppliers} cashboxes={cashboxes} users={assignableUsers} />
        <ScanCard form={form} />
      </div>
      <ProductPicker form={form} />
      <PurchaseLinesTable form={form} />
      <FormFooter>
        <Button type="button" variant="outline" onClick={() => form.exitForm()} disabled={form.submitting}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={form.submitting || !form.canSubmit}>
          {t(form.submitting ? 'loading' : 'save')}
        </Button>
      </FormFooter>
    </form>
  )
}
