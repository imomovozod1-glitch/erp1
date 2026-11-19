'use client'

import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { NamedCategory } from './scan-save'
import { ScannerReviewStep } from './scanner-review-step'
import { ScannerUploadStep } from './scanner-upload-step'
import { useStockScanner, type StockScanner } from './use-stock-scanner'

interface AIStockScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories?: NamedCategory[]
  lang?: string
}

export function AIStockScannerModal({ open, onOpenChange, categories = [] }: AIStockScannerModalProps) {
  const t = useTranslations()
  const scanner = useStockScanner(categories, () => onOpenChange(false))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-brand-subtle p-2 text-violet-600 dark:text-violet-400">
              <Sparkles className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold">{t('inventory.aiScanner.title')}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">{t('inventory.aiScanner.description')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {scanner.step === 'upload' ? <ScannerUploadStep scanner={scanner} /> : <ScannerReviewStep scanner={scanner} />}
        </div>
        <DialogFooter className="-mx-6 mt-auto -mb-6 rounded-b-xl px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={scanner.scanning || scanner.saving}>
            {t('common.close')}
          </Button>
          <PrimaryAction scanner={scanner} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PrimaryAction({ scanner }: { scanner: StockScanner }) {
  const t = useTranslations()
  const busy = scanner.step === 'upload' ? scanner.scanning : scanner.saving
  const Icon = busy ? Loader2 : scanner.step === 'upload' ? Sparkles : CheckCircle2
  const label =
    scanner.step === 'upload'
      ? t(busy ? 'inventory.aiScanner.analyzing' : 'inventory.aiScanner.readWithAi')
      : t(busy ? 'common.saving' : 'inventory.aiScanner.saveAll')
  const disabled = busy || (scanner.step === 'upload' ? !scanner.file : !scanner.items.length)
  return (
    <Button type="button" onClick={scanner.step === 'upload' ? scanner.scan : scanner.save} disabled={disabled}>
      <Icon className={busy ? 'size-4 animate-spin' : 'size-4'} />
      {label}
    </Button>
  )
}
