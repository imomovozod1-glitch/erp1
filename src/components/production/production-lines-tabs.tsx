'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LinePicker, useLinesContext } from './lines/line-parts'
import { bumpOrAdd, sharesOn, withShares, type LinesMode, type LinesProductOption, type MaterialLine, type OutputLine } from './lines/lines-model'
import { MaterialsTable } from './lines/materials-tab'
import { OutputsTable } from './lines/outputs-tab'

export { costShareTotal, type Consumption, type LinesProductOption, type MaterialLine, type OutputLine } from './lines/lines-model'

interface ProductionLinesTabsProps {
  mode: LinesMode
  products: LinesProductOption[]
  materials: MaterialLine[]
  outputs: OutputLine[]
  onMaterialsChange: (next: MaterialLine[]) => void
  onOutputsChange: (next: OutputLine[]) => void
  /** Lines added now count as additions to the composition (order mode, with one chosen). */
  addAsExtra?: boolean
  disabled?: boolean
}

/**
 * "Xomashyo" (what goes in) and "Tayyor mahsulot" (what comes out) as tabs. Rows are
 * added by clicking a product in the picker; a product never sits on both sides, since
 * being made out of itself would fold its cost back into its own average.
 */
export function ProductionLinesTabs(props: ProductionLinesTabsProps) {
  const { mode, products, materials, outputs, onMaterialsChange, onOutputsChange, addAsExtra = false, disabled } = props
  const t = useTranslations('production')
  const ctx = useLinesContext(mode, products, disabled)
  const notBoth = (): false => {
    toast.error(t('outputAlsoMaterial'))
    return false
  }

  const addMaterial = (id: string) => {
    if (outputs.some((o) => o.productId === id)) return notBoth()
    onMaterialsChange(bumpOrAdd(materials, id, { productId: id, quantity: 1, consumption: 'variable', isExtra: addAsExtra }))
  }

  const addOutput = (id: string) => {
    if (materials.some((m) => m.productId === id)) return notBoth()
    const next = bumpOrAdd(outputs, id, { productId: id, quantity: 1, costShare: null, isExtra: addAsExtra })
    onOutputsChange(sharesOn(outputs) && next.length !== outputs.length ? withShares(next, true) : next)
  }

  const count = (n: number) => <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{n}</span>

  return (
    <Tabs defaultValue="materials" className="gap-4">
      <TabsList variant="line" className="h-10 w-full justify-start gap-4 border-b border-border/60 bg-transparent p-0">
        <TabsTrigger value="materials" className="h-10 flex-none px-1 text-sm font-semibold">
          {t('tabMaterials')}
          {count(materials.length)}
        </TabsTrigger>
        <TabsTrigger value="outputs" className="h-10 flex-none px-1 text-sm font-semibold">
          {t('tabOutputs')}
          {count(outputs.length)}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="materials" className="space-y-3">
        {mode === 'bom' && <p className="text-[11px] leading-snug text-muted-foreground">{t('consumptionHint')}</p>}
        <MaterialsTable ctx={ctx} materials={materials} onChange={onMaterialsChange} />
        <LinePicker
          ctx={ctx}
          excluded={outputs.map((o) => o.productId)}
          quantityOf={(id) => materials.find((m) => m.productId === id)?.quantity ?? null}
          onPick={addMaterial}
        />
      </TabsContent>
      <TabsContent value="outputs" className="space-y-3">
        <p className="text-[11px] leading-snug text-muted-foreground">{t('costShareHint')}</p>
        <OutputsTable ctx={ctx} outputs={outputs} onChange={onOutputsChange} />
        <LinePicker
          ctx={ctx}
          excluded={materials.map((m) => m.productId)}
          quantityOf={(id) => outputs.find((o) => o.productId === id)?.quantity ?? null}
          onPick={addOutput}
        />
      </TabsContent>
    </Tabs>
  )
}
