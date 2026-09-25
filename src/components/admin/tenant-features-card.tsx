'use client'

/**
 * Which unreleased features this one company gets.
 *
 * The list is the registry in src/lib/features.ts, not the row: a flag that has
 * been deleted from the code stops appearing here even while its key is still
 * sitting in the company's JSONB, which is what makes retiring a finished flag
 * a code-only change.
 *
 * Saved through the same PATCH the rest of this page uses, which clears the
 * `tenant:<id>` cache tag — so the company's own workspace picks the change up
 * on its next navigation rather than up to a minute later.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FEATURE_FLAGS, FEATURE_FLAG_KEYS, type FeatureFlag, type TenantFeatures } from '@/lib/features'

interface TenantFeaturesCardProps {
  tenantId: string
  features: TenantFeatures
}

export function TenantFeaturesCard({ tenantId, features }: TenantFeaturesCardProps) {
  const t = useTranslations('admin.tenants.detail')
  const router = useRouter()
  const [selected, setSelected] = useState<TenantFeatures>(features)
  const [isSaving, setIsSaving] = useState(false)

  if (FEATURE_FLAG_KEYS.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('featuresEmpty')}</p>
  }

  const isDirty = FEATURE_FLAG_KEYS.some((key) => (selected[key] === true) !== (features[key] === true))

  const toggle = (flag: FeatureFlag, on: boolean) => {
    setSelected((prev) => ({ ...prev, [flag]: on }))
  }

  const save = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: selected }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error || t('featuresError'))
        return
      }
      toast.success(t('featuresSaved'))
      router.refresh()
    } catch {
      toast.error(t('featuresError'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {FEATURE_FLAG_KEYS.map((key) => (
          <label key={key} className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={selected[key] === true}
              onCheckedChange={(checked) => toggle(key, checked === true)}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                {FEATURE_FLAGS[key].label}
              </span>
              <span className="block text-xs text-muted-foreground">{FEATURE_FLAGS[key].description}</span>
            </span>
          </label>
        ))}
      </div>

      <Button type="button" size="sm" onClick={save} disabled={isSaving || !isDirty}>
        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        {t('featuresSave')}
      </Button>
    </div>
  )
}
