'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Layers } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { invalidateTenant } from '@/lib/data/revalidate'
import type { CostingMethod } from '@/lib/inventory-costing'

/**
 * Per-tenant default for FIFO/LIFO/AVECO inventory costing — lives on the
 * tenant's own `tenants.costing_method` row (see `supabase/migration_multi_tenant.sql`).
 * The super-admin panel can also set this per tenant; RLS lets a tenant only
 * read/update its own row, and only the `costing_method` column (column-level
 * GRANT) — subdomain, status, billing fields stay vendor-controlled.
 *
 * No `.eq('id', ...)` filter is needed below: the browser client carries the
 * real user session, and RLS's `tenant_read_own`/`tenant_update_own` policies
 * already scope every query here to exactly the caller's own tenant row.
 */
export function InventoryCostingForm() {
  const t = useTranslations('settings')
  const tInv = useTranslations('inventory')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [method, setMethod] = useState<CostingMethod>('fifo')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      const supabase = createClient() as any
      const { data } = await supabase
        .from('tenants')
        .select('id, costing_method')
        .limit(1)
        .maybeSingle()

      if (data) {
        setTenantId(data.id)
        setMethod(data.costing_method)
      }
      setIsLoading(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const handleChange = async (value: CostingMethod | null) => {
    if (!value || !tenantId) return
    setMethod(value)
    setIsSaving(true)
    try {
      const supabase = createClient() as any
      const { error } = await supabase
        .from('tenants')
        .update({ costing_method: value })
        .eq('id', tenantId)
      if (error) throw error
      await invalidateTenant(tenantId)
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
        <div className="space-y-1.5 max-w-xs">
          <Select value={method} onValueChange={handleChange} disabled={isLoading || isSaving || !tenantId}>
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
