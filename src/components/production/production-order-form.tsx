'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { formatCurrency, isoDate } from '@/lib/utils'
import { NumericInput } from '@/components/ui/numeric-input'
import { createClient } from '@/lib/supabase/client'
import { invalidateProduction, invalidateProductionOrders } from '@/lib/data/revalidate'
import { saveProductionOrder, completeProductionOrder, productionErrorMessage } from '@/lib/production-actions'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { FormFooter } from '@/components/shared/form-footer'
import {
  ProductionLinesTabs,
  costShareTotal,
  type MaterialLine,
  type OutputLine,
} from '@/components/production/production-lines-tabs'

export interface ProductionProductOption {
  id: string
  name: string
  unit: string
  cost_price: number
  stock: number
  is_service?: boolean
}

export interface ProductionBomOption {
  id: string
  name: string
  product_id: string
  output_quantity: number
  product?: { id: string; name: string; unit: string } | null
  items?: { component_id: string; quantity: number; consumption?: string | null }[]
  /** product_bom_outputs; absent on a database without migration_production_outputs.sql. */
  outputs?: { product_id: string; quantity: number; cost_share: number | null; created_at?: string }[]
}

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

type RunStatus = 'completed' | 'draft'

/** A composition's outputs, oldest first — the first one is the run's "main" product. */
function bomOutputs(bom: ProductionBomOption) {
  const rows = [...(bom.outputs ?? [])].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
  return rows.length > 0
    ? rows
    : [{ product_id: bom.product_id, quantity: Number(bom.output_quantity) || 1, cost_share: null }]
}

const round3 = (value: number) => Number(value.toFixed(3))

/**
 * The production run.
 *
 * Only what a run needs (Bito's form, trimmed): its code, who is responsible,
 * the date, the composition and how many times it is run, the status, and a
 * note. Under it the same two tabs as the composition — raw materials and
 * finished products. With a composition chosen they are filled in from it:
 * variable materials and the outputs multiplied by "Miqdori", fixed materials
 * as they are. With none, both are entered by hand.
 *
 * Saving goes through `save_production_order`; "Yakunlangan" then completes
 * the run straight away (`complete_production_order` — materials leave stock,
 * the products arrive, each costed at its share). If completing is refused, the
 * run is kept as a draft with the reason shown.
 */
export function ProductionOrderForm({
  initialData,
  initialItems,
  initialOutputs,
  products,
  boms,
  nextOrderNumber,
  lang,
  assignableUsers,
}: ProductionOrderFormProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('production')
  const tRoot = useTranslations()
  const router = useRouter()
  const exitForm = useRouteModalExit(`/${lang}/production/orders`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient() as any

  const initialBom = boms.find((b) => b.id === initialData?.bom_id)
  const [orderNumber, setOrderNumber] = useState<string>(initialData?.order_number || nextOrderNumber)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const [orderDate, setOrderDate] = useState<string>(initialData?.planned_date || isoDate())
  // Kept even when the composition has been switched off since: the run still
  // came from it. Re-deriving needs it in the list, so that is guarded below.
  const [bomId, setBomId] = useState<string>(initialData?.bom_id || '')
  const [batches, setBatches] = useState<number | ''>(() => {
    if (initialData?.batches) return Number(initialData.batches)
    // A run saved before `batches` existed: how many batches its quantity was.
    if (initialBom) return round3((Number(initialData?.quantity) || 0) / (Number(initialBom.output_quantity) || 1)) || 1
    return 1
  })
  // A new run is usually recorded once it is done; a saved draft stays a draft
  // unless the user says otherwise.
  const [status, setStatus] = useState<RunStatus>(initialData ? 'draft' : 'completed')
  const [notes, setNotes] = useState<string>(initialData?.notes || '')

  const [materials, setMaterials] = useState<MaterialLine[]>(() =>
    (initialItems ?? []).map((item: any) => ({
      productId: item.component_id,
      quantity: Number(item.quantity) || 0,
      consumption: item.is_fixed ? 'fixed' : 'variable',
      isExtra: Boolean(item.is_extra),
    }))
  )
  const [outputs, setOutputs] = useState<OutputLine[]>(() =>
    (initialOutputs ?? []).map((row: any) => ({
      productId: row.product_id,
      quantity: Number(row.quantity) || 0,
      costShare: row.cost_share === null || row.cost_share === undefined ? null : Number(row.cost_share),
      isExtra: Boolean(row.is_extra),
    }))
  )

  const productIds = useMemo(() => new Set(products.map((p) => p.id)), [products])

  /**
   * The lines a composition gives for a run of `times` batches. Always derived
   * from the composition, never from what is on screen, so changing "Miqdori"
   * repeatedly cannot accumulate rounding drift.
   */
  const derive = (bom: ProductionBomOption, times: number) => ({
    materials: (bom.items ?? [])
      .filter((item) => productIds.has(item.component_id))
      .map<MaterialLine>((item) => {
        const fixed = item.consumption === 'fixed'
        return {
          productId: item.component_id,
          quantity: round3(Number(item.quantity) * (fixed ? 1 : times)),
          consumption: fixed ? 'fixed' : 'variable',
          isExtra: false,
        }
      }),
    outputs: bomOutputs(bom)
      .filter((row) => productIds.has(row.product_id))
      .map<OutputLine>((row) => ({
        productId: row.product_id,
        quantity: round3(Number(row.quantity) * times),
        costShare: row.cost_share === null || row.cost_share === undefined ? null : Number(row.cost_share),
        isExtra: false,
      })),
  })

  /**
   * Re-derives the composition's lines and keeps what was added by hand: an
   * addition belongs to this run and was entered at a quantity the user chose.
   */
  const applyBom = (bom: ProductionBomOption | undefined, times: number) => {
    const extraMaterials = materials.filter((m) => m.isExtra)
    const extraOutputs = outputs.filter((o) => o.isExtra)
    if (!bom) {
      setMaterials(extraMaterials.map((m) => ({ ...m, isExtra: false })))
      setOutputs(extraOutputs.map((o) => ({ ...o, isExtra: false })))
      return
    }
    const next = derive(bom, times)
    const taken = new Set([...extraMaterials, ...extraOutputs].map((l) => l.productId))
    const recipeOutputs = next.outputs.filter((o) => !taken.has(o.productId))
    const keptOutputs = extraOutputs.filter((o) => !next.materials.some((m) => m.productId === o.productId))
    const mergedOutputs = [...recipeOutputs, ...keptOutputs]
    // Shares from the composition only add up while its outputs are all there.
    const sharesHold = mergedOutputs.every((o) => o.costShare !== null)
    setMaterials([
      ...next.materials.filter((m) => !taken.has(m.productId)),
      ...extraMaterials.filter((m) => !next.outputs.some((o) => o.productId === m.productId)),
    ])
    setOutputs(sharesHold ? mergedOutputs : mergedOutputs.map((o) => ({ ...o, costShare: null })))
  }

  const handleSelectBom = (value: string | null) => {
    const next = !value || value === 'none' ? '' : value
    setBomId(next)
    applyBom(boms.find((b) => b.id === next), Number(batches) || 1)
  }

  const changeBatches = (value: number | '') => {
    setBatches(value)
    const bom = boms.find((b) => b.id === bomId)
    if (bom && Number(value) > 0) applyBom(bom, Number(value))
  }

  const onSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!orderNumber.trim()) {
      toast.error(tCommon('required'))
      return
    }
    if (bomId && !(Number(batches) > 0)) {
      toast.error(tCommon('required'))
      return
    }
    if (materials.length === 0 || materials.some((m) => !(m.quantity > 0))) {
      toast.error(t('noComponents'))
      return
    }
    if (outputs.length === 0 || outputs.some((o) => !(o.quantity > 0))) {
      toast.error(t('noOutputs'))
      return
    }
    const useShares = outputs.every((o) => o.costShare !== null)
    if (useShares && Math.abs(costShareTotal(outputs) - 100) > 0.01) {
      toast.error(t('costShareSum'))
      return
    }

    setIsSubmitting(true)
    try {
      const result = await saveProductionOrder(supabase, {
        id: initialData?.id,
        order_number: orderNumber.trim(),
        bom_id: bomId || null,
        batches: bomId ? Number(batches) : null,
        product_id: outputs[0].productId,
        quantity: outputs[0].quantity,
        planned_date: orderDate || null,
        notes: notes.trim() || null,
        assigned_to: assignedTo,
        items: materials.map((m) => ({
          component_id: m.productId,
          quantity: m.quantity,
          is_extra: m.isExtra,
          is_fixed: m.consumption === 'fixed',
        })),
        outputs: outputs.map((o) => ({
          product_id: o.productId,
          quantity: o.quantity,
          cost_share: useShares ? o.costShare : null,
          is_extra: o.isExtra,
        })),
      })
      if (status === 'completed') {
        try {
          const done = await completeProductionOrder(supabase, result.id, orderDate || isoDate())
          toast.success(t('completed', { cost: formatCurrency(Number(done.unit_cost) || 0) }))
          await invalidateProduction()
        } catch (error) {
          toast.error(
            `${t('savedAsDraft')} ${productionErrorMessage(tRoot, error, (err) => businessRpcErrorMessage(tRoot, err))}`
          )
          await invalidateProductionOrders()
        }
      } else {
        toast.success(tCommon('success'))
        await invalidateProductionOrders()
      }
      router.push(`/${lang}/production/orders/${result.id}`)
    } catch (error) {
      toast.error(productionErrorMessage(tRoot, error, (err) => businessRpcErrorMessage(tRoot, err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{t('sectionMain')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="order_number">{t('orderNumber')} *</Label>
              <Input id="order_number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order_date">{t('orderDate')}</Label>
              <Input id="order_date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{t('sectionMore')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bom_id">{t('bom')}</Label>
              <Select value={bomId || 'none'} onValueChange={handleSelectBom}>
                <SelectTrigger id="bom_id" className="w-full">
                  <SelectValue placeholder={t('selectBomTemplate')}>
                    {bomId ? (boms.find((b) => b.id === bomId)?.name ?? initialData?.bom?.name) : t('noBomTemplate')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noBomTemplate')}</SelectItem>
                  {boms.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batches">{t('batches')}{bomId ? ' *' : ''}</Label>
              <NumericInput
                id="batches"
                value={batches}
                disabled={!bomId}
                onChange={(value) => changeBatches(value)}
              />
            </div>
            <p className="-mt-2 text-[11px] leading-snug text-muted-foreground sm:col-span-2">
              {bomId ? t('batchesHint') : t('manualLinesHint')}
            </p>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="status">{tCommon('status')} *</Label>
              <Select value={status} onValueChange={(value) => setStatus((value as RunStatus) ?? 'completed')}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue>{t(`status_${status}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">{t('status_completed')}</SelectItem>
                  <SelectItem value="draft">{t('status_draft')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">{tCommon('notes')}</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-2 pt-6">
          {bomId && <p className="text-[11px] leading-snug text-muted-foreground">{t('bomLinesHint')}</p>}
          <ProductionLinesTabs
            mode="order"
            products={products}
            materials={materials}
            outputs={outputs}
            onMaterialsChange={setMaterials}
            onOutputsChange={setOutputs}
            addAsExtra={Boolean(bomId)}
            disabled={isSubmitting}
          />
        </CardContent>
      </Card>

      <FormFooter>
        <Button type="button" variant="outline" onClick={() => exitForm()} disabled={isSubmitting}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tCommon('save')}
        </Button>
      </FormFooter>
    </form>
  )
}
