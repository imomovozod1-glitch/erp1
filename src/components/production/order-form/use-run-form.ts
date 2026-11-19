'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { invalidateProduction, invalidateProductionOrders } from '@/lib/data/revalidate'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { completeProductionOrder, productionErrorMessage, saveProductionOrder } from '@/lib/production-actions'
import { useRouteModalExit } from '@/lib/hooks/use-route-modal'
import { formatCurrency, isoDate } from '@/lib/utils'
import type { MaterialLine, OutputLine } from '../lines/lines-model'
import {
  applyComposition,
  initialBatches,
  runPayload,
  runProblem,
  savedMaterials,
  savedOutputs,
  type ProductionBomOption,
  type ProductionProductOption,
  type RunStatus,
} from './run-composition'

interface RunFormConfig {
  initial?: any
  initialItems?: any[]
  initialOutputs?: any[]
  products: ProductionProductOption[]
  boms: ProductionBomOption[]
  nextOrderNumber: string
  lang: string
}

export function useRunForm({ initial, initialItems, initialOutputs, products, boms, nextOrderNumber, lang }: RunFormConfig) {
  const t = useTranslations()
  const router = useRouter()
  const exitForm = useRouteModalExit(`/${lang}/production/orders`)
  const [submitting, setSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string>(initial?.order_number || nextOrderNumber)
  const [assignedTo, setAssignedTo] = useState<string | null>(initial?.assigned_to ?? null)
  const [orderDate, setOrderDate] = useState<string>(initial?.planned_date || isoDate())
  const [bomId, setBomId] = useState<string>(initial?.bom_id || '')
  const [batches, setBatches] = useState<number | ''>(() => initialBatches(initial, boms.find((b) => b.id === initial?.bom_id)))
  // A new run is usually recorded once done; a saved draft stays a draft unless changed.
  const [status, setStatus] = useState<RunStatus>(initial ? 'draft' : 'completed')
  const [notes, setNotes] = useState<string>(initial?.notes || '')
  const [materials, setMaterials] = useState<MaterialLine[]>(() => savedMaterials(initialItems))
  const [outputs, setOutputs] = useState<OutputLine[]>(() => savedOutputs(initialOutputs))
  const known = new Set(products.map((p) => p.id))

  const recompose = (bom: ProductionBomOption | undefined, times: number) => {
    const next = applyComposition({ materials, outputs }, bom, times, known)
    setMaterials(next.materials)
    setOutputs(next.outputs)
  }

  const chooseBom = (id: string) => {
    setBomId(id)
    recompose(boms.find((b) => b.id === id), Number(batches) || 1)
  }

  const changeBatches = (value: number | '') => {
    setBatches(value)
    const bom = boms.find((b) => b.id === bomId)
    if (bom && Number(value) > 0) recompose(bom, Number(value))
  }

  const failure = (error: unknown) => productionErrorMessage(t, error, (e) => businessRpcErrorMessage(t, e))

  const completeNow = async (supabase: any, id: string) => {
    try {
      const done = await completeProductionOrder(supabase, id, orderDate || isoDate())
      toast.success(t('production.completed', { cost: formatCurrency(Number(done.unit_cost) || 0) }))
      await invalidateProduction()
    } catch (error) {
      toast.error(`${t('production.savedAsDraft')} ${failure(error)}`)
      await invalidateProductionOrders()
    }
  }

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    const draft = { orderNumber, bomId, batches, orderDate, notes, assignedTo, materials, outputs }
    const problem = runProblem(draft)
    if (problem) return void toast.error(t(problem))
    setSubmitting(true)
    try {
      const supabase = createClient()
      const saved = await saveProductionOrder(supabase, runPayload(draft, initial?.id))
      if (status === 'completed') await completeNow(supabase, saved.id)
      else {
        toast.success(t('common.success'))
        await invalidateProductionOrders()
      }
      router.push(`/${lang}/production/orders/${saved.id}`)
    } catch (error) {
      toast.error(failure(error))
    } finally {
      setSubmitting(false)
    }
  }

  return {
    orderNumber, setOrderNumber, assignedTo, setAssignedTo, orderDate, setOrderDate,
    bomId, chooseBom, batches, changeBatches, status, setStatus, notes, setNotes,
    materials, setMaterials, outputs, setOutputs, submitting, submit, exitForm,
  }
}

export type RunFormState = ReturnType<typeof useRunForm>
