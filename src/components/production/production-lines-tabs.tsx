'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { isService } from '@/lib/product-kind'
import { Button } from '@/components/ui/button'
import { NumericInput } from '@/components/ui/numeric-input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ItemPicker } from '@/components/shared/item-picker'

export type Consumption = 'variable' | 'fixed'

export interface LinesProductOption {
  id: string
  name: string
  unit: string
  stock?: number
  is_service?: boolean
}

export interface MaterialLine {
  productId: string
  quantity: number
  /** Recipe line: scales with the run or stays the same (product_bom_items.consumption). */
  consumption: Consumption
  /** Added to this run by hand rather than carried in from the composition. */
  isExtra: boolean
}

export interface OutputLine {
  productId: string
  quantity: number
  /** Share of the run's cost, in percent — `null` while the share switch is off. */
  costShare: number | null
  isExtra: boolean
}

interface ProductionLinesTabsProps {
  /** `bom` edits a recipe (consumption type), `order` a run (stock on hand, totals). */
  mode: 'bom' | 'order'
  products: LinesProductOption[]
  materials: MaterialLine[]
  outputs: OutputLine[]
  onMaterialsChange: (next: MaterialLine[]) => void
  onOutputsChange: (next: OutputLine[]) => void
  /** Lines added now count as additions to the composition (order mode, with one chosen). */
  addAsExtra?: boolean
  disabled?: boolean
}

/** 100 split evenly, the remainder on the last row, so the shares always add up. */
function evenShares(count: number): number[] {
  if (count === 0) return []
  const each = Math.floor((100 / count) * 100) / 100
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? Number((100 - each * (count - 1)).toFixed(2)) : each
  )
}

export function costShareTotal(outputs: OutputLine[]): number {
  return Number(outputs.reduce((sum, o) => sum + (Number(o.costShare) || 0), 0).toFixed(2))
}

/**
 * The two line grids every production screen shares — "Xomashyo" (what goes
 * in) and "Tayyor mahsulot" (what comes out) — as tabs, the way the composition
 * and the run are laid out in Bito.
 *
 * Rows are added by clicking a product in the search box under the table
 * (`ItemPicker`, CLAUDE.md § Conventions) at a quantity of 1; a second click on
 * the same product bumps it. A product cannot sit on both sides: being made out
 * of itself would fold its cost back into its own average.
 */
export function ProductionLinesTabs({
  mode,
  products,
  materials,
  outputs,
  onMaterialsChange,
  onOutputsChange,
  addAsExtra = false,
  disabled,
}: ProductionLinesTabsProps) {
  const tRoot = useTranslations()
  const tCommon = useTranslations('common')
  const t = useTranslations('production')
  const productById = new Map(products.map((p) => [p.id, p]))
  const showStock = mode === 'order'
  const useShares = outputs.length > 0 && outputs.every((o) => o.costShare !== null)

  const typeOf = (id: string) =>
    isService(productById.get(id)) ? tRoot('inventory.service') : t('typeGoods')

  const stockLabel = (id: string) => {
    const product = productById.get(id)
    return isService(product) ? '—' : formatNumber(Number(product?.stock) || 0)
  }

  const addMaterial = (id: string) => {
    if (outputs.some((o) => o.productId === id)) {
      return notBoth()
    }
    const at = materials.findIndex((m) => m.productId === id)
    if (at >= 0) {
      onMaterialsChange(materials.map((m, i) => (i === at ? { ...m, quantity: m.quantity + 1 } : m)))
      return
    }
    onMaterialsChange([...materials, { productId: id, quantity: 1, consumption: 'variable', isExtra: addAsExtra }])
  }

  const addOutput = (id: string) => {
    if (materials.some((m) => m.productId === id)) {
      return notBoth()
    }
    const at = outputs.findIndex((o) => o.productId === id)
    if (at >= 0) {
      onOutputsChange(outputs.map((o, i) => (i === at ? { ...o, quantity: o.quantity + 1 } : o)))
      return
    }
    const next = [...outputs, { productId: id, quantity: 1, costShare: null, isExtra: addAsExtra }]
    onOutputsChange(useShares ? withShares(next, true) : next)
  }

  const withShares = (rows: OutputLine[], on: boolean) => {
    const shares = evenShares(rows.length)
    return rows.map((o, i) => ({ ...o, costShare: on ? shares[i] : null }))
  }

  // The pickers already leave out what is on the other side; this covers a
  // list that went stale between renders. `false` keeps the picker open.
  const notBoth = (): false => {
    toast.error(t('outputAlsoMaterial'))
    return false
  }

  const materialOptions = products
    .filter((p) => !outputs.some((o) => o.productId === p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      meta: isService(p) ? tRoot('inventory.service') : `${t('available')}: ${formatNumber(Number(p.stock) || 0)} ${p.unit}`,
      badge: materials.find((m) => m.productId === p.id)?.quantity ?? null,
    }))
  // An output goes onto the shelf, so a service cannot be one.
  const outputOptions = products
    .filter((p) => !isService(p) && !materials.some((m) => m.productId === p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      meta: `${t('available')}: ${formatNumber(Number(p.stock) || 0)} ${p.unit}`,
      badge: outputs.find((o) => o.productId === p.id)?.quantity ?? null,
    }))

  const materialsTotal = materials.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
  const outputsTotal = outputs.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)
  const shareTotal = costShareTotal(outputs)

  const badgeFor = (line: { isExtra: boolean; consumption?: Consumption }) => (
    <>
      {mode === 'order' && line.consumption === 'fixed' && (
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          {t('consumption_fixed')}
        </span>
      )}
      {line.isExtra && (
        <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
          {t('extraMaterialShort')}
        </span>
      )}
    </>
  )

  const removeButton = (onClick: () => void, size: 'sm' | 'lg') => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={tCommon('delete')}
      disabled={disabled}
      onClick={onClick}
      className={
        (size === 'sm' ? 'h-8 w-8 ' : '-mr-1 -mt-1 h-10 w-10 ') +
        'shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30'
      }
    >
      <Trash2 className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </Button>
  )

  const consumptionSelect = (line: MaterialLine, index: number) => (
    <Select
      value={line.consumption}
      disabled={disabled}
      onValueChange={(value) =>
        onMaterialsChange(
          materials.map((m, i) => (i === index ? { ...m, consumption: (value as Consumption) ?? 'variable' } : m))
        )
      }
    >
      <SelectTrigger className="h-9 w-full min-w-36" aria-label={t('colConsumption')}>
        <SelectValue>{t(`consumption_${line.consumption}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="variable">{t('consumption_variable')}</SelectItem>
        <SelectItem value="fixed">{t('consumption_fixed')}</SelectItem>
      </SelectContent>
    </Select>
  )

  const setMaterialQty = (index: number, value: unknown) =>
    onMaterialsChange(materials.map((m, i) => (i === index ? { ...m, quantity: Number(value) || 0 } : m)))
  const setOutputQty = (index: number, value: unknown) =>
    onOutputsChange(outputs.map((o, i) => (i === index ? { ...o, quantity: Number(value) || 0 } : o)))
  const setOutputShare = (index: number, value: unknown) =>
    onOutputsChange(outputs.map((o, i) => (i === index ? { ...o, costShare: Number(value) || 0 } : o)))

  const shareSwitch = (
    <span className="inline-flex items-center gap-2">
      {t('colCostShare')}
      <Switch
        checked={useShares}
        disabled={disabled || outputs.length === 0}
        onCheckedChange={(on) => onOutputsChange(withShares(outputs, on))}
        aria-label={t('colCostShare')}
      />
    </span>
  )

  return (
    <Tabs defaultValue="materials" className="gap-4">
      <TabsList variant="line" className="h-10 w-full justify-start gap-4 border-b border-border/60 bg-transparent p-0">
        <TabsTrigger value="materials" className="h-10 flex-none px-1 text-sm font-semibold">
          {t('tabMaterials')}
          <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{materials.length}</span>
        </TabsTrigger>
        <TabsTrigger value="outputs" className="h-10 flex-none px-1 text-sm font-semibold">
          {t('tabOutputs')}
          <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{outputs.length}</span>
        </TabsTrigger>
      </TabsList>

      {/* ---------------- Xomashyo ---------------- */}
      <TabsContent value="materials" className="space-y-3">
        {mode === 'bom' && <p className="text-[11px] leading-snug text-muted-foreground">{t('consumptionHint')}</p>}

        <div className="overflow-x-auto rounded-2xl border max-md:hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead className="w-10">№</TableHead>
                <TableHead>{t('colProduct')}</TableHead>
                <TableHead>{t('colType')}</TableHead>
                <TableHead>{t('colUnit')}</TableHead>
                {mode === 'bom' && <TableHead className="w-44">{t('colConsumption')}</TableHead>}
                {showStock && <TableHead className="text-right">{t('colStock')}</TableHead>}
                <TableHead className="w-48 text-right">{t('colQuantity')} *</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {t('noComponents')}
                  </TableCell>
                </TableRow>
              ) : (
                materials.map((line, index) => {
                  const product = productById.get(line.productId)
                  const short =
                    showStock && !isService(product) && (Number(product?.stock) || 0) < line.quantity
                  return (
                    <TableRow key={line.productId}>
                      <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {product?.name ?? '—'}
                          {badgeFor(line)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{typeOf(line.productId)}</TableCell>
                      <TableCell className="text-muted-foreground">{product?.unit}</TableCell>
                      {mode === 'bom' && <TableCell>{consumptionSelect(line, index)}</TableCell>}
                      {showStock && (
                        <TableCell
                          className={`text-right tabular-nums ${short ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}`}
                        >
                          {stockLabel(line.productId)}
                        </TableCell>
                      )}
                      <TableCell>
                        <NumericInput
                          value={line.quantity}
                          disabled={disabled}
                          onChange={(value) => setMaterialQty(index, value)}
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        {removeButton(() => onMaterialsChange(materials.filter((_, i) => i !== index)), 'sm')}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
              {mode === 'order' && materials.length > 0 && (
                <TableRow className="bg-slate-50/60 font-semibold dark:bg-slate-800/40">
                  <TableCell />
                  <TableCell colSpan={3}>{tCommon('total')}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatNumber(materialsTotal)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Phones: a card per line, wired to the same handlers. */}
        <div className="space-y-3 md:hidden">
          {materials.length === 0 ? (
            <p className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              {t('noComponents')}
            </p>
          ) : (
            materials.map((line, index) => {
              const product = productById.get(line.productId)
              return (
                <div key={line.productId} className="rounded-2xl border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">
                        {index + 1}. {product?.name ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {typeOf(line.productId)} · {product?.unit}
                        {showStock && ` · ${t('colStock')}: ${stockLabel(line.productId)}`}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">{badgeFor(line)}</div>
                    </div>
                    {removeButton(() => onMaterialsChange(materials.filter((_, i) => i !== index)), 'lg')}
                  </div>
                  <div className="mt-2 grid gap-2">
                    {mode === 'bom' && consumptionSelect(line, index)}
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {t('colQuantity')}
                      <NumericInput
                        value={line.quantity}
                        disabled={disabled}
                        onChange={(value) => setMaterialQty(index, value)}
                        className="text-right"
                      />
                    </label>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <ItemPicker
          options={materialOptions}
          onPick={(option) => addMaterial(option.id)}
          placeholder={tCommon('search')}
          emptyLabel={tCommon('noData')}
          hint={t('pickToAddHint')}
          disabled={disabled}
        />
      </TabsContent>

      {/* ---------------- Tayyor mahsulot ---------------- */}
      <TabsContent value="outputs" className="space-y-3">
        <p className="text-[11px] leading-snug text-muted-foreground">{t('costShareHint')}</p>

        <div className="overflow-x-auto rounded-2xl border max-md:hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead className="w-10">№</TableHead>
                <TableHead>{t('colProduct')}</TableHead>
                <TableHead>{t('colType')}</TableHead>
                <TableHead>{t('colUnit')}</TableHead>
                {showStock && <TableHead className="text-right">{t('colStock')}</TableHead>}
                <TableHead className="w-44">{shareSwitch}</TableHead>
                <TableHead className="w-48 text-right">{t('colQuantity')} *</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {outputs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {t('noOutputs')}
                  </TableCell>
                </TableRow>
              ) : (
                outputs.map((line, index) => {
                  const product = productById.get(line.productId)
                  return (
                    <TableRow key={line.productId}>
                      <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {product?.name ?? '—'}
                          {badgeFor(line)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t('tabOutputs')}</TableCell>
                      <TableCell className="text-muted-foreground">{product?.unit}</TableCell>
                      {showStock && (
                        <TableCell className="text-right tabular-nums">{stockLabel(line.productId)}</TableCell>
                      )}
                      <TableCell>
                        <NumericInput
                          value={line.costShare ?? 100}
                          disabled={disabled || !useShares}
                          onChange={(value) => setOutputShare(index, value)}
                          className="h-9 text-right"
                          aria-label={t('colCostShare')}
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          value={line.quantity}
                          disabled={disabled}
                          onChange={(value) => setOutputQty(index, value)}
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        {removeButton(() => onOutputsChange(outputs.filter((_, i) => i !== index)), 'sm')}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
              {outputs.length > 0 && (mode === 'order' || useShares) && (
                <TableRow className="bg-slate-50/60 font-semibold dark:bg-slate-800/40">
                  <TableCell />
                  <TableCell colSpan={showStock ? 4 : 3}>{tCommon('total')}</TableCell>
                  <TableCell
                    className={`tabular-nums ${useShares && Math.abs(shareTotal - 100) > 0.01 ? 'text-rose-600 dark:text-rose-400' : ''}`}
                  >
                    {useShares ? `${formatNumber(shareTotal)}%` : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(outputsTotal)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 md:hidden">
          <div className="flex items-center justify-between rounded-2xl border bg-card px-3 py-2 text-sm font-medium">
            {shareSwitch}
            {useShares && (
              <span
                className={`tabular-nums ${Math.abs(shareTotal - 100) > 0.01 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}
              >
                {t('costShareTotal', { sum: formatNumber(shareTotal) })}
              </span>
            )}
          </div>
          {outputs.length === 0 ? (
            <p className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              {t('noOutputs')}
            </p>
          ) : (
            outputs.map((line, index) => {
              const product = productById.get(line.productId)
              return (
                <div key={line.productId} className="rounded-2xl border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">
                        {index + 1}. {product?.name ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product?.unit}
                        {showStock && ` · ${t('colStock')}: ${stockLabel(line.productId)}`}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">{badgeFor(line)}</div>
                    </div>
                    {removeButton(() => onOutputsChange(outputs.filter((_, i) => i !== index)), 'lg')}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {useShares && (
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {t('colCostShare')}
                        <NumericInput
                          value={line.costShare ?? 0}
                          disabled={disabled}
                          onChange={(value) => setOutputShare(index, value)}
                          className="text-right"
                        />
                      </label>
                    )}
                    <label className={`space-y-1 text-xs text-muted-foreground ${useShares ? '' : 'col-span-2'}`}>
                      {t('colQuantity')}
                      <NumericInput
                        value={line.quantity}
                        disabled={disabled}
                        onChange={(value) => setOutputQty(index, value)}
                        className="text-right"
                      />
                    </label>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <ItemPicker
          options={outputOptions}
          onPick={(option) => addOutput(option.id)}
          placeholder={tCommon('search')}
          emptyLabel={tCommon('noData')}
          hint={t('pickToAddHint')}
          disabled={disabled}
        />
      </TabsContent>
    </Tabs>
  )
}
