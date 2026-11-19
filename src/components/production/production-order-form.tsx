'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Textarea } from '@/components/ui/textarea'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormFooter } from '@/components/shared/form-footer'
import { LabeledField } from '@/components/shared/labeled-field'
import { NameSelect } from '@/components/shared/name-select'
import { ProductionLinesTabs } from './production-lines-tabs'
import type { ProductionBomOption, ProductionProductOption, RunStatus } from './order-form/run-composition'
import { useRunForm, type RunFormState } from './order-form/use-run-form'

export type { ProductionBomOption, ProductionProductOption } from './order-form/run-composition'

interface ProductionOrderFormProps {
  assignableUsers: AssignableUser[]
  products: ProductionProductOption[]
  boms: ProductionBomOption[]
  initialData?: any
  initialItems?: any[]
  initialOutputs?: any[]
  nextOrderNumber: string
  lang: string
}

function MainCard({ form, users, lang }: { form: RunFormState; users: AssignableUser[]; lang: string }) {
  const t = useTranslations('production')
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{t('sectionMain')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <LabeledField id="order_number" label={t('orderNumber')} required>
          <Input id="order_number" value={form.orderNumber} onChange={(e) => form.setOrderNumber(e.target.value)} />
        </LabeledField>
        <LabeledField id="order_date" label={t('orderDate')}>
          <DatePicker id="order_date" value={form.orderDate} onChange={form.setOrderDate} lang={lang} placeholder={t('orderDate')} />
        </LabeledField>
        <div className="sm:col-span-2">
          <AssigneeSelect value={form.assignedTo} onChange={form.setAssignedTo} users={users} />
        </div>
      </CardContent>
    </Card>
  )
}

function MoreCard({ form, boms, initialBomName }: { form: RunFormState; boms: ProductionBomOption[]; initialBomName?: string }) {
  const t = useTranslations()
  // A run keeps its composition even after that composition is switched off.
  const options = form.bomId && !boms.some((b) => b.id === form.bomId) ? [...boms, { id: form.bomId, name: initialBomName ?? '—' }] : boms
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{t('production.sectionMore')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <LabeledField id="bom_id" label={t('production.bom')}>
          <NameSelect
            id="bom_id"
            value={form.bomId}
            onChange={form.chooseBom}
            options={options}
            placeholder={t('production.noBomTemplate')}
            clearLabel={t('production.noBomTemplate')}
          />
        </LabeledField>
        <LabeledField id="batches" label={t('production.batches')} required={!!form.bomId}>
          <NumericInput id="batches" value={form.batches} disabled={!form.bomId} onChange={form.changeBatches} />
        </LabeledField>
        <p className="-mt-2 text-[11px] leading-snug text-muted-foreground sm:col-span-2">
          {t(form.bomId ? 'production.batchesHint' : 'production.manualLinesHint')}
        </p>
        <LabeledField id="status" label={t('common.status')} required className="sm:col-span-2">
          <SegmentedControl<RunStatus>
            label={t('common.status')}
            value={form.status}
            onChange={form.setStatus}
            options={[
              { value: 'completed', label: t('production.status_completed') },
              { value: 'draft', label: t('production.status_draft') },
            ]}
          />
        </LabeledField>
        <LabeledField id="notes" label={t('common.notes')} className="sm:col-span-2">
          <Textarea id="notes" value={form.notes} onChange={(e) => form.setNotes(e.target.value)} rows={2} />
        </LabeledField>
      </CardContent>
    </Card>
  )
}

/**
 * The production run: code, owner, date, composition × batches, status, note, then the
 * material and output tabs. "Yakunlangan" completes the run right after saving; a refused
 * completion keeps it as a draft with the reason shown.
 */
export function ProductionOrderForm(props: ProductionOrderFormProps) {
  const { initialData, products, boms, lang, assignableUsers } = props
  const t = useTranslations()
  const form = useRunForm({ ...props, initial: initialData })
  return (
    <form onSubmit={form.submit} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <MainCard form={form} users={assignableUsers} lang={lang} />
        <MoreCard form={form} boms={boms} initialBomName={initialData?.bom?.name} />
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-2 pt-6">
          {form.bomId && <p className="text-[11px] leading-snug text-muted-foreground">{t('production.bomLinesHint')}</p>}
          <ProductionLinesTabs
            mode="order"
            products={products}
            materials={form.materials}
            outputs={form.outputs}
            onMaterialsChange={form.setMaterials}
            onOutputsChange={form.setOutputs}
            addAsExtra={Boolean(form.bomId)}
            disabled={form.submitting}
          />
        </CardContent>
      </Card>
      <FormFooter>
        <Button type="button" variant="outline" onClick={() => form.exitForm()} disabled={form.submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={form.submitting}>
          {form.submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </FormFooter>
    </form>
  )
}
