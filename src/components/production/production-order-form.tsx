'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { formatCurrency, formatNumber, isoDate } from '@/lib/utils'
import { NumericInput } from '@/components/ui/numeric-input'
import { createClient } from '@/lib/supabase/client'
import { invalidateProductionOrders } from '@/lib/data/revalidate'
import { saveProductionOrder, productionErrorMessage } from '@/lib/production-actions'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { toast } from 'sonner'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isService } from '@/lib/product-kind'

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
  extra_cost: number
  product?: { id: string; name: string; unit: string } | null
  items?: { component_id: string; quantity: number }[]
}

interface Line {
  componentId: string
  quantity: number
}

interface ProductionOrderFormProps {
  assignableUsers: AssignableUser[]
  products: ProductionProductOption[]
  boms: ProductionBomOption[]
  initialData?: any
  initialItems?: any[]
  nextOrderNumber: string
  lang: string
}

/**
 * The production run, as a draft.
 *
 * Saving goes through `save_production_order` rather than browser writes: a
 * run and its component list must never be half-written, and the function is
 * also where the `production` permission is enforced. Nothing here moves
 * stock — that is the Complete button on the run's own page.
 *
 * Picking a composition fills the lines in, scaled to the quantity being
 * produced, and they stay editable: a real batch rarely takes exactly what the
 * recipe says.
 */
export function ProductionOrderForm({
  initialData,
  initialItems,
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
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const supabase = createClient() as any

  const [orderNumber, setOrderNumber] = useState<string>(initialData?.order_number || nextOrderNumber)
  const [bomId, setBomId] = useState<string>(initialData?.bom_id || '')
  const [productId, setProductId] = useState<string>(initialData?.product_id || '')
  const [quantity, setQuantity] = useState<number | ''>(initialData?.quantity ?? 1)
  const [plannedDate, setPlannedDate] = useState<string>(initialData?.planned_date || isoDate())
  const [extraCost, setExtraCost] = useState<number | ''>(initialData?.extra_cost ?? '')
  const [notes, setNotes] = useState<string>(initialData?.notes || '')

  const [lines, setLines] = useState<Line[]>(() =>
    (initialItems ?? []).map((item: any) => ({
      componentId: item.component_id,
      quantity: Number(item.quantity) || 0,
    }))
  )
  const [pickedComponent, setPickedComponent] = useState('')
  const [pickedQuantity, setPickedQuantity] = useState<number | ''>(1)

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  )

  /**
   * The component list a composition produces for a given run size: its
   * per-batch figures times how many batches this run is. Always derived from
   * the composition itself and never from the lines currently on screen, so
   * changing the quantity repeatedly cannot accumulate rounding drift.
   */
  const deriveLines = (bom: ProductionBomOption | undefined, runQuantity: number): Line[] => {
    if (!bom) return []
    const batches = runQuantity / (Number(bom.output_quantity) || 1)
    return (bom.items ?? []).map((item) => ({
      componentId: item.component_id,
      quantity: Number((Number(item.quantity) * batches).toFixed(3)),
    }))
  }

  /**
   * Picking a composition REPLACES the component list — exactly the way
   * picking a role template replaces an employee's permission matrix in
   * `employee-form.tsx`. The template decides the grid; the grid is yours to
   * adjust afterwards. Choosing "no composition" empties it rather than
   * leaving the last one's lines behind pretending to be hand-entered.
   */
  const handleSelectBom = (value: string | null) => {
    const next = !value || value === 'none' ? null : value
    setBomId(next ?? '')
    const chosen = boms.find((b) => b.id === next)
    if (!chosen) {
      setLines([])
      return
    }
    setProductId(chosen.product_id)
    setExtraCost(Number(chosen.extra_cost) || '')
    setLines(deriveLines(chosen, Number(quantity) || 0))
  }

  /**
   * A new run size re-derives the lines from the composition. A hand edit to a
   * line is lost when the quantity changes, which is the honest trade: scaling
   * whatever is on screen by the ratio instead would compound rounding and
   * keep edits that no longer mean anything at the new size. With no
   * composition selected the lines are purely manual and quantity leaves them
   * alone.
   */
  const changeQuantity = (value: number | '') => {
    setQuantity(value)
    if (!bomId) return
    setLines(deriveLines(boms.find((b) => b.id === bomId), Number(value) || 0))
  }

  const addLine = () => {
    if (!pickedComponent) return
    const qty = Number(pickedQuantity) || 0
    if (qty <= 0) return
    if (pickedComponent === productId) {
      toast.error(t('selfComponent'))
      return
    }
    if (lines.some((l) => l.componentId === pickedComponent)) {
      toast.error(t('componentExists'))
      return
    }
    setLines((current) => [...current, { componentId: pickedComponent, quantity: qty }])
    setPickedComponent('')
    setPickedQuantity(1)
  }

  const componentsCost = lines.reduce(
    (sum, l) => sum + (Number(productById.get(l.componentId)?.cost_price) || 0) * l.quantity,
    0
  )
  const totalCost = componentsCost + (Number(extraCost) || 0)
  const perUnit = (Number(quantity) || 0) > 0 ? totalCost / (Number(quantity) as number) : 0

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId || !orderNumber.trim()) {
      toast.error(tCommon('required'))
      return
    }
    if ((Number(quantity) || 0) <= 0) {
      toast.error(tCommon('required'))
      return
    }
    if (lines.length === 0) {
      toast.error(t('noComponents'))
      return
    }

    setIsSubmitting(true)
    try {
      const result = await saveProductionOrder(supabase, {
        id: initialData?.id,
        order_number: orderNumber.trim(),
        bom_id: bomId || null,
        product_id: productId,
        quantity: Number(quantity),
        planned_date: plannedDate || null,
        extra_cost: Number(extraCost) || 0,
        notes: notes.trim() || null,
        assigned_to: assignedTo,
        items: lines.map((l) => ({ component_id: l.componentId, quantity: l.quantity })),
      })
      toast.success(tCommon('success'))
      await invalidateProductionOrders()
      router.push(`/${lang}/production/orders/${result.id}`)
    } catch (error) {
      toast.error(productionErrorMessage(tRoot, error, (e) => businessRpcErrorMessage(tRoot, e)))
    } finally {
      setIsSubmitting(false)
    }
  }

  const availableComponents = products.filter(
    (p) => p.id !== productId && !lines.some((l) => l.componentId === p.id)
  )
  // A run puts its output ON the shelf, and a service has no shelf — the RPC
  // would write stock onto a row the services constraint pins at zero. Services
  // stay available as COMPONENTS (subcontracted work), just not as the output.
  const producibleProducts = products.filter((p) => !isService(p))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{initialData ? t('editOrder') : t('addOrder')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="order_number">{t('orderNumber')} *</Label>
          <Input id="order_number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bom_id">{t('selectBomTemplate')}</Label>
          <Select value={bomId || 'none'} onValueChange={handleSelectBom}>
            <SelectTrigger id="bom_id" className="w-full">
              <SelectValue placeholder={t('selectBomTemplate')}>
                {bomId ? boms.find((b) => b.id === bomId)?.name : t('noBomTemplate')}
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
          <Label htmlFor="product_id">{t('finishedProduct')} *</Label>
          {bomId ? (
            /* The composition already says what it makes. Leaving this
               selectable let a run be filed as "from the cream recipe" while
               producing something else, which would make `bom_id` a lie about
               what happened. */
            <div
              id="product_id"
              className="flex h-9 w-full items-center rounded-md border border-input bg-slate-50 px-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
            >
              {productById.get(productId)?.name ?? '—'}
            </div>
          ) : (
            <Select value={productId} onValueChange={(val) => setProductId(val ?? '')}>
              <SelectTrigger id="product_id" className="w-full">
                <SelectValue placeholder={tCommon('select')}>
                  {productId ? productById.get(productId)?.name : tCommon('select')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {producibleProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {bomId && <p className="text-[11px] leading-snug text-muted-foreground">{t('productFromBomHint')}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">{t('produceQuantity')} *</Label>
          <NumericInput id="quantity" value={quantity} onChange={(val) => changeQuantity(val as any)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="planned_date">{t('plannedDate')}</Label>
          <Input id="planned_date" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="extra_cost">{t('extraCost')}</Label>
          <NumericInput id="extra_cost" value={extraCost} onChange={(val) => setExtraCost(val as any)} />
          <p className="text-[11px] leading-snug text-muted-foreground">{t('extraCostHint')}</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label>{t('components')} *</Label>
        {bomId && <p className="text-[11px] leading-snug text-muted-foreground">{t('bomAppliedHint')}</p>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1 space-y-1">
            <Label className="text-xs">{t('component')}</Label>
            <Select value={pickedComponent} onValueChange={(val) => setPickedComponent(val ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tCommon('select')}>
                  {pickedComponent ? productById.get(pickedComponent)?.name : tCommon('select')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableComponents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {isService(p) ? '' : ` — ${formatNumber(p.stock)} ${p.unit}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs">{tCommon('quantity')}</Label>
            <NumericInput value={pickedQuantity} onChange={(val) => setPickedQuantity(val as any)} />
          </div>
          <Button type="button" variant="outline" onClick={addLine} disabled={!pickedComponent}>
            <Plus className="mr-2 h-4 w-4" /> {t('addComponent')}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead>{t('component')}</TableHead>
                <TableHead className="text-right tabular-nums">{t('required')}</TableHead>
                <TableHead className="text-right tabular-nums">{t('available')}</TableHead>
                <TableHead className="text-right tabular-nums">{t('unitCost')}</TableHead>
                <TableHead className="text-right tabular-nums">{tCommon('total')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {t('noComponents')}
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => {
                  const product = productById.get(line.componentId)
                  const service = isService(product)
                  const short = !service && (Number(product?.stock) || 0) < line.quantity
                  return (
                    <TableRow key={line.componentId}>
                      <TableCell className="font-medium">{product?.name ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-28">
                            <NumericInput
                              value={line.quantity}
                              onChange={(val) =>
                                setLines((current) =>
                                  current.map((l) =>
                                    l.componentId === line.componentId
                                      ? { ...l, quantity: Number(val) || 0 }
                                      : l
                                  )
                                )
                              }
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{product?.unit}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {service ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={short ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>
                            {formatNumber(Number(product?.stock) || 0)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(product?.cost_price) || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency((Number(product?.cost_price) || 0) * line.quantity)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLines((c) => c.filter((l) => l.componentId !== line.componentId))}
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {lines.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/60 bg-linear-to-r from-slate-50 to-slate-100 p-4 shadow-inner dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/60">
            <div className="flex flex-wrap gap-8">
              <div className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('totalCost')} · {t('estimated')}
                </span>
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalCost)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('perUnitCost')} · {t('estimated')}
                </span>
                <span className="text-lg font-bold tracking-tight text-violet-600 dark:text-violet-400">
                  {formatCurrency(perUnit)}
                </span>
              </div>
              {initialData?.status && (
                <div className="space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {tCommon('status')}
                  </span>
                  <StatusBadge tone="amber" label={t(`status_${initialData.status}`)} />
                </div>
              )}
            </div>
            <p className="basis-full text-[11px] leading-snug text-slate-400 dark:text-slate-500">
              {t('estimatedHint')}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{tCommon('notes')}</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="max-w-sm">
        <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} />
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => exitForm()} disabled={isSubmitting}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tCommon('save')}
        </Button>
      </div>
        </form>
      </CardContent>
    </Card>
  )
}
