'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AlertCircle, Layers } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { invalidateCompanySettings } from '@/lib/data/revalidate'
import type { CostingMethod } from '@/lib/inventory-costing'

/**
 * Global default for FIFO/LIFO/AVECO inventory costing — kept in its own
 * Supabase-backed `company_settings` row rather than folded into
 * `CompanyForm`'s localStorage-only fields, since this number directly
 * determines real profit/COGS figures across the whole app.
 */
export function InventoryCostingForm() {
  const t = useTranslations('settings')
  const tInv = useTranslations('inventory')
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [method, setMethod] = useState<CostingMethod>('fifo')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      const supabase = createClient() as any
      const { data, error } = await supabase
        .from('company_settings')
        .select('id, default_costing_method')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) {
        setTableMissing(true)
      } else if (data) {
        setSettingsId(data.id)
        setMethod(data.default_costing_method)
      }
      setIsLoading(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const handleChange = async (value: CostingMethod | null) => {
    if (!value) return
    setMethod(value)
    setIsSaving(true)
    try {
      const supabase = createClient() as any
      if (settingsId) {
        const { error } = await supabase
          .from('company_settings')
          .update({ default_costing_method: value })
          .eq('id', settingsId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert({ default_costing_method: value })
          .select('id')
          .single()
        if (error) throw error
        setSettingsId(data.id)
      }
      await invalidateCompanySettings()
      toast.success(t('costingMethodSaved'))
    } catch (err: any) {
      toast.error(err.message || t('costingMethodSaveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-600" />
          {t('inventoryCosting')}
        </CardTitle>
        <CardDescription>{t('inventoryCostingDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tableMissing && (
          <div className="flex gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <p>{t('companySettingsTableMissing')}</p>
          </div>
        )}
        <div className="space-y-1.5 max-w-xs">
          <Select value={method} onValueChange={handleChange} disabled={isLoading || isSaving || tableMissing}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fifo">{tInv('fifo')}</SelectItem>
              <SelectItem value="lifo">{tInv('lifo')}</SelectItem>
              <SelectItem value="aveco">{tInv('aveco')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
