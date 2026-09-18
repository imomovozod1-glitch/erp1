'use client'

import { useMemo, useState } from 'react'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { useTranslations } from 'next-intl'
import { Resolver, Controller } from 'react-hook-form'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { usePersistedForm, clearPersistedForm } from '@/lib/hooks/use-persisted-form'
import { NumericInput } from '@/components/ui/numeric-input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { invalidateBoms } from '@/lib/data/revalidate'
import { toast } from 'sonner'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssigneeSelect, type AssignableUser } from '@/components/shared/assignee-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'


export interface BomProductOption {
  id: string
  name: string
  unit: string
  cost_price: number
  is_service?: boolean
}

interface BomLine {
  componentId: string
  name: string
  unit: string
  costPrice: number
  quantity: number
}

interface BomFormProps {
  assignableUsers: AssignableUser[]
  products: BomProductOption[]
  initialData?: any
  initialItems?: any[]
  /** Set when the form was opened from a product's own page. */
  presetProductId?: string
  lang: string
}

/**
 * Tarkib — the recipe for one batch of a finished product.
 *
 * Shaped like `role-template-form.tsx`, because it is the same kind of object:
 * a reusable TEMPLATE whose detail grid (there a permissions matrix, here a
 * component list) a production run copies and may then adjust. Name at the
 * top, the grid under its own label, actions bottom-right.
 *
 * This writes no stock and no money, so unlike a production run it is an
 * ordinary browser write (see CLAUDE.md § Data layer): the header is
 * inserted/updated, then the component lines are replaced wholesale. A failure
 * between the two leaves a recipe the user can see is empty and re-save —
 * which is why the lines are deleted and re-inserted rather than diffed.
 */
export function BomForm({ initialData, initialItems, products, presetProductId, lang, assignableUsers }: BomFormProps) {
  // The draft is keyed by the product it is for, so opening "add composition"
  // from one product never restores a half-written recipe for another.
  const FORM_ID = `bom-form-v1:${initialData?.id ?? presetProductId ?? 'new'}`
  const tCommon = useTranslations('common')
  const t = useTranslations('production')
  const exitForm = useRouteModalExit(`/${lang}/production/boms`)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(initialData?.assigned_to ?? null)
  const supabase = createClient() as any

  const [lines, setLines] = useState<BomLine[]>(() =>
    (initialItems ?? []).map((item: any) => ({
      componentId: item.component_id,
      name: item.component?.name ?? '',
      unit: item.component?.unit ?? '',
      costPrice: Number(item.component?.cost_price) || 0,
      quantity: Number(item.quantity) || 0,
    }))
  )
  const [pickedComponent, setPickedComponent] = useState('')
  const [pickedQuantity, setPickedQuantity] = useState<number | ''>(1)

  const schema = z.object({
    name: z.string().min(1, tCommon('required')),
    product_id: z.string().min(1, tCommon('required')),
    output_quantity: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number().positive(tCommon('required'))
    ),
    extra_cost: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number().min(0).optional()
    ),
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
  })

  type FormData = z.infer<typeof schema>

  const { register, handleSubmit, watch, control, formState: { errors } } = usePersistedForm<FormData>(FORM_ID, {
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: {
      name: initialData?.name || '',
      product_id: initialData?.product_id || presetProductId || '',
      output_quantity: initialData?.output_quantity ?? 1,
      extra_cost: initialData?.extra_cost ?? '' as any,
      notes: initialData?.notes || '',
      is_active: initialData?.is_active ?? true,
    },
  })

  const productId = watch('product_id')
  const outputQuantity = Number(watch('output_quantity')) || 0
  const extraCost = Number(watch('extra_cost')) || 0

  // What the batch looks like it will cost at today's cost prices. The real
  // figure is only known when a run is completed and the stock layers are
  // actually drawn down, which is why this is labelled an estimate.
  const componentsCost = useMemo(
    () => lines.reduce((sum, l) => sum + l.costPrice * l.quantity, 0),
    [lines]
  )
  const batchCost = componentsCost + extraCost
  const perUnitCost = outputQuantity > 0 ? batchCost / outputQuantity : 0

  const addLine = () => {
    if (!pickedComponent) return
    const quantity = Number(pickedQuantity) || 0
    if (quantity <= 0) return
    if (pickedComponent === productId) {
      toast.error(t('selfComponent'))
      return
    }
    if (lines.some((l) => l.componentId === pickedComponent)) {
      toast.error(t('componentExists'))
      return
    }
    const product = products.find((p) => p.id === pickedComponent)
    if (!product) return
    setLines((current) => [
      ...current,
      {
        componentId: product.id,
        name: product.name,
        unit: product.unit,
        costPrice: Number(product.cost_price) || 0,
        quantity,
      },
    ])
    setPickedComponent('')
    setPickedQuantity(1)
  }

  const onSubmit = async (data: any) => {
    if (lines.length === 0) {
      toast.error(t('noComponents'))
      return
    }
    setIsSubmitting(true)
    try {
      const userRes = await supabase.auth.getUser()
      const userId: string | null = userRes.data?.user?.id ?? null

      const payload: Record<string, any> = {
        name: data.name.trim(),
        product_id: data.product_id,
        output_quantity: data.output_quantity,
        extra_cost: data.extra_cost ?? 0,
        notes: data.notes || null,
        is_active: data.is_active,
        assigned_to: assignedTo ?? initialData?.assigned_to ?? userId,
        created_by: initialData?.created_by ?? userId,
      }

      let bomId: string = initialData?.id
      if (bomId) {
        const { error } = await supabase.from('product_boms').update(payload).eq('id', bomId)
        if (error) throw error
        const { error: delError } = await supabase.from('product_bom_items').delete().eq('bom_id', bomId)
        if (delError) throw delError
      } else {
        const { data: created, error } = await supabase.from('product_boms').insert([payload]).select('id').single()
        if (error) throw error
        bomId = created.id
      }

      // `tenant_id` is left out on purpose: the set_tenant_id() BEFORE INSERT
      // trigger stamps it (migration_production.sql).
      const { error: itemsError } = await supabase.from('product_bom_items').insert(
        lines.map((l) => ({ bom_id: bomId, component_id: l.componentId, quantity: l.quantity }))
      )
      if (itemsError) throw itemsError

      toast.success(tCommon('success'))
      await invalidateBoms()
      clearPersistedForm(FORM_ID)
      exitForm()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const availableComponents = products.filter(
    (p) => p.id !== productId && !lines.some((l) => l.componentId === p.id)
  )

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
          <Label htmlFor="product_id">{t('finishedProduct')} *</Label>
          <Controller
            control={control}
            name="product_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="product_id" className="w-full">
                  <SelectValue placeholder={tCommon('select')}>
                    {field.value ? products.find((p) => p.id === field.value)?.name : tCommon('select')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.product_id && <p className="text-sm text-red-500">{errors.product_id.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="output_quantity">{t('outputQuantity')} *</Label>
          <Controller
            control={control}
            name="output_quantity"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="output_quantity" value={value} onChange={onChange} />
            )}
          />
          <p className="text-[11px] text-muted-foreground leading-snug">{t('outputHint')}</p>
          {errors.output_quantity && <p className="text-sm text-red-500">{errors.output_quantity.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="extra_cost">{t('extraCost')}</Label>
          <Controller
            control={control}
            name="extra_cost"
            render={({ field: { onChange, value } }) => (
              <NumericInput id="extra_cost" value={value} onChange={onChange} />
            )}
          />
          <p className="text-[11px] text-muted-foreground leading-snug">{t('extraCostHint')}</p>
          {errors.extra_cost && <p className="text-sm text-red-500">{errors.extra_cost.message}</p>}
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

      {/* Components */}
      <div className="space-y-3">
        <Label>{t('components')} *</Label>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1 space-y-1">
            <Label className="text-xs">{t('component')}</Label>
            <Select value={pickedComponent} onValueChange={(val) => setPickedComponent(val ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tCommon('select')}>
                  {pickedComponent ? products.find((p) => p.id === pickedComponent)?.name : tCommon('select')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableComponents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.cost_price)}
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

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead>{t('component')}</TableHead>
                <TableHead className="text-right tabular-nums">{tCommon('quantity')}</TableHead>
                <TableHead className="text-right tabular-nums">{t('unitCost')}</TableHead>
                <TableHead className="text-right tabular-nums">{tCommon('total')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t('noComponents')}
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => (
                  <TableRow key={line.componentId}>
                    <TableCell className="font-medium">{line.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(line.quantity)} {line.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(line.costPrice)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(line.costPrice * line.quantity)}
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
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {lines.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/60 bg-linear-to-r from-slate-50 to-slate-100 p-4 shadow-inner dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/60">
            <div className="flex flex-wrap gap-8">
              <div className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('batchCost')}
                </span>
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {formatCurrency(batchCost)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('perUnitCost')} · {t('estimated')}
                </span>
                <span className="text-lg font-bold tracking-tight text-violet-600 dark:text-violet-400">
                  {formatCurrency(perUnitCost)}
                </span>
              </div>
            </div>
            <p className="basis-full text-[11px] leading-snug text-slate-400 dark:text-slate-500">
              {t('estimatedHint')}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{tCommon('description')}</Label>
        <Textarea id="notes" {...register('notes')} rows={3} />
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
