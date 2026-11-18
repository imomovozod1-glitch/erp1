'use client'

import { useState } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { errorMessage } from '@/lib/error-message'
import { Resolver, Controller } from 'react-hook-form'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateBoms } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import {
  ProductionLinesTabs,
  costShareTotal,
  type MaterialLine,
  type OutputLine,
} from '@/components/production/production-lines-tabs'
import { FormFooter } from '@/components/shared/form-footer'


export interface BomProductOption {
  id: string
  name: string
  unit: string
  cost_price: number
  stock?: number
  is_service?: boolean
}

interface BomFormProps {
  assignableUsers: AssignableUser[]
  products: BomProductOption[]
  initialData?: any
  initialItems?: any[]
  /** product_bom_outputs rows; empty for a composition saved before they existed. */
  initialOutputs?: any[]
  /** Set when the form was opened from a product's own page. */
  presetProductId?: string
  lang: string
}

/** Lower-level codes a database without migration_production_outputs.sql answers with. */
const MISSING_SCHEMA_CODES = new Set(['PGRST204', 'PGRST205', '42P01', '42703'])

/**
 * Tarkib — the recipe for one batch.
 *
 * Laid out like Bito's: the composition's name on top, then two tabs — the raw
 * materials that go in (each either scaling with the run or fixed) and the
 * finished products that come out, optionally with each one's share of the
 * cost. There is no extra-cost tab: a run's cost is what its materials were
 * carried at (complete_production_order).
 *
 * This writes no stock and no money, so it is an ordinary browser write (see
 * CLAUDE.md § Data layer): the header is saved, then both line lists are
 * replaced wholesale. `product_boms.product_id` / `output_quantity` mirror the
 * first finished product for every reader that predates product_bom_outputs.
 */
export function BomForm({ initialData, initialItems, initialOutputs, products, presetProductId, lang, assignableUsers }: BomFormProps) {
  // The draft is keyed by the product it is for, so opening "add composition"
  // from one product never restores a half-written recipe for another.
  const FORM_ID = `bom-form-v2:${initialData?.id ?? presetProductId ?? 'new'}`
  const tRoot = useTranslations()
  const tCommon = useTranslations('common')
  const t = useTranslations('production')
  const exitForm = useRouteModalExit(`/${lang}/production/boms`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const supabase = createClient() as any

  const [materials, setMaterials] = useState<MaterialLine[]>(() =>
    (initialItems ?? []).map((item: any) => ({
      productId: item.component_id,
      quantity: Number(item.quantity) || 0,
      consumption: item.consumption === 'fixed' ? 'fixed' : 'variable',
      isExtra: false,
    }))
  )
  const [outputs, setOutputs] = useState<OutputLine[]>(() => {
    if (initialOutputs && initialOutputs.length > 0) {
      return initialOutputs.map((row: any) => ({
        productId: row.product_id,
        quantity: Number(row.quantity) || 0,
        costShare: row.cost_share === null || row.cost_share === undefined ? null : Number(row.cost_share),
        isExtra: false,
      }))
    }
    const productId = initialData?.product_id ?? presetProductId
    return productId
      ? [{ productId, quantity: Number(initialData?.output_quantity) || 1, costShare: null, isExtra: false }]
      : []
  })

  const schema = z.object({
    name: z.string().min(1, tCommon('required')),
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
  })

  type FormData = z.infer<typeof schema>

  const { register, handleSubmit, control, formState: { errors } } = usePersistedForm<FormData>(FORM_ID, {
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      notes: initialData?.notes || '',
      is_active: initialData?.is_active ?? true,
    },
  })

  const onSubmit = async (data: any) => {
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
      const userRes = await supabase.auth.getUser()
      const userId: string | null = userRes.data?.user?.id ?? null

      const payload: Record<string, any> = {
        name: data.name.trim(),
        product_id: outputs[0].productId,
        output_quantity: outputs[0].quantity,
        notes: data.notes || null,
        is_active: data.is_active,
        assigned_to: assignedTo ?? initialData?.assigned_to ?? userId,
        created_by: initialData?.created_by ?? userId,
      }

      let bomId: string = initialData?.id
      if (bomId) {
        const { error } = await supabase.from('product_boms').update(payload).eq('id', bomId)
        if (error) throw error
        const [{ error: delItems }, { error: delOutputs }] = await Promise.all([
          supabase.from('product_bom_items').delete().eq('bom_id', bomId),
          supabase.from('product_bom_outputs').delete().eq('bom_id', bomId),
        ])
        if (delItems) throw delItems
        if (delOutputs) throw delOutputs
      } else {
        const { data: created, error } = await supabase.from('product_boms').insert([payload]).select('id').single()
        if (error) throw error
        bomId = created.id
      }

      // `tenant_id` is left out on purpose: the set_tenant_id() BEFORE INSERT
      // trigger stamps it (migration_production.sql).
      const [{ error: itemsError }, { error: outputsError }] = await Promise.all([
        supabase.from('product_bom_items').insert(
          materials.map((m) => ({ bom_id: bomId, component_id: m.productId, quantity: m.quantity, consumption: m.consumption }))
        ),
        supabase.from('product_bom_outputs').insert(
          outputs.map((o) => ({
            bom_id: bomId,
            product_id: o.productId,
            quantity: o.quantity,
            cost_share: useShares ? o.costShare : null,
          }))
        ),
      ])
      if (itemsError) throw itemsError
      if (outputsError) throw outputsError

      toast.success(tCommon('success'))
      await invalidateBoms()
      clearPersistedForm(FORM_ID)
      exitForm()
    } catch (error: any) {
      toast.error(
        MISSING_SCHEMA_CODES.has(error?.code)
          ? tRoot('production.migrationMissing')
          : errorMessage(tRoot, error, tCommon('error'))
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{initialData ? t('editBom') : t('addBom')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('bomName')} *</Label>
          <Input id="name" {...register('name')} placeholder={t('bomNamePlaceholder')} />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="is_active">{tCommon('status')}</Label>
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Select value={field.value ? 'true' : 'false'} onValueChange={(val) => field.onChange(val === 'true')}>
                <SelectTrigger id="is_active" className="w-full">
                  <SelectValue>{field.value ? tCommon('active') : tCommon('inactive')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{tCommon('active')}</SelectItem>
                  <SelectItem value="false">{tCommon('inactive')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <ProductionLinesTabs
        mode="bom"
        products={products}
        materials={materials}
        outputs={outputs}
        onMaterialsChange={setMaterials}
        onOutputsChange={setOutputs}
        disabled={isSubmitting}
      />

      <div className="space-y-2">
        <Label htmlFor="notes">{tCommon('description')}</Label>
        <Textarea id="notes" {...register('notes')} rows={3} />
      </div>

      <div className="max-w-sm">
        <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} />
      </div>

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
      </CardContent>
    </Card>
  )
}
