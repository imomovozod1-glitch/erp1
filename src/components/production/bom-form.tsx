'use client'

import { useState } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { errorMessage } from '@/lib/error-message'
import type { Resolver } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'
import { LabeledField } from '@/components/shared/labeled-field'
import { StatusField } from '@/components/inventory/catalog-form/catalog-fields'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import { ProductionLinesTabs, type MaterialLine, type OutputLine } from '@/components/production/production-lines-tabs'
import { linesProblem } from './lines/lines-model'
import { MISSING_SCHEMA_CODES, saveBom, savedBomMaterials, savedBomOutputs } from './bom-save'
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
export function BomForm({
  initialData,
  initialItems,
  initialOutputs,
  products,
  presetProductId,
  lang,
  assignableUsers,
}: BomFormProps) {
  // The draft is keyed by the product it is for, so opening "add composition"
  // from one product never restores a half-written recipe for another.
  const FORM_ID = `bom-form-v2:${initialData?.id ?? presetProductId ?? 'new'}`
  const tRoot = useTranslations()
  const tCommon = useTranslations('common')
  const t = useTranslations('production')
  const exitForm = useRouteModalExit(`/${lang}/production/boms`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)

  const [materials, setMaterials] = useState<MaterialLine[]>(() => savedBomMaterials(initialItems))
  const [outputs, setOutputs] = useState<OutputLine[]>(() =>
    savedBomOutputs(initialOutputs, initialData, presetProductId)
  )

  const schema = z.object({
    name: z.string().min(1, tCommon('required')),
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
  })

  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = usePersistedForm<FormData>(FORM_ID, {
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      notes: initialData?.notes || '',
      is_active: initialData?.is_active ?? true,
    },
  })

  const onSubmit = async (data: FormData) => {
    const problem = linesProblem(materials, outputs)
    if (problem) return void toast.error(tRoot(problem))
    setIsSubmitting(true)
    try {
      await saveBom(createClient(), { ...data, assignedTo, materials, outputs }, initialData)
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
            <LabeledField id="name" label={t('bomName')} required error={errors.name?.message}>
              <Input id="name" {...register('name')} placeholder={t('bomNamePlaceholder')} />
            </LabeledField>

            <StatusField control={control} />

            <AssigneeSelect value={assignedTo} onChange={setAssignedTo} users={assignableUsers} />
          </div>

          <LabeledField id="notes" label={tCommon('description')}>
            <Textarea id="notes" {...register('notes')} rows={2} />
          </LabeledField>

          <ProductionLinesTabs
            mode="bom"
            products={products}
            materials={materials}
            outputs={outputs}
            onMaterialsChange={setMaterials}
            onOutputsChange={setOutputs}
            disabled={isSubmitting}
          />

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
