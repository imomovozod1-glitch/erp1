'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'

/**
 * Runs one list-row action at a time: marks the row busy, shows the message the action
 * returns (a refusal it already showed returns null), refreshes the list, reports failures.
 */
export function useRowAction(invalidate: () => Promise<unknown>) {
  const t = useTranslations()
  const [busyId, setBusyId] = useState<string | null>(null)
  const run = async (id: string, action: () => Promise<string | null>) => {
    setBusyId(id)
    try {
      const message = await action()
      if (message === null) return
      toast.success(message)
      await invalidate()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setBusyId(null)
    }
  }
  return { busyId, run }
}
