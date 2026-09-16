'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ConfirmOptions {
  /** What is being deleted, shown in quotes in the default description. */
  name?: string | null
  title?: string
  description?: string
  confirmLabel?: string
}

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (confirmed: boolean) => void
}

/**
 * Asks before anything is deleted — the one confirmation every delete button
 * in the app goes through, instead of `window.confirm` in some places and
 * nothing at all in others.
 *
 *   const [confirmDelete, confirmDialog] = useConfirmDelete()
 *   const handleDelete = async (id) => {
 *     if (!(await confirmDelete({ name: row.name }))) return
 *     ...
 *   }
 *   return <>{...}{confirmDialog}</>
 *
 * Resolves `true` only when the user presses the red button; closing the
 * dialog any other way (Cancel, Esc, clicking outside) resolves `false`.
 */
export function useConfirmDelete() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirmDelete = useCallback(
    (options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve })
      }),
    []
  )

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed)
    setPending(null)
  }

  const dialog = (
    <ConfirmDeleteDialog
      open={pending !== null}
      options={pending?.options ?? {}}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )

  return [confirmDelete, dialog] as const
}

function ConfirmDeleteDialog({
  open,
  options,
  onConfirm,
  onCancel,
}: {
  open: boolean
  options: ConfirmOptions
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useTranslations('common')

  const description =
    options.description ??
    (options.name ? t('confirmDeleteNamed', { name: options.name }) : t('confirmDeleteGeneric'))

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md rounded-2xl border-0 bg-white p-6 shadow-xl dark:bg-slate-900">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {options.title ?? t('confirmDeleteTitle')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6 py-4">
          <Button variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button onClick={onConfirm} className="gap-2 bg-rose-600 text-white hover:bg-rose-700" autoFocus>
            <Trash2 className="h-4 w-4" />
            {options.confirmLabel ?? t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
