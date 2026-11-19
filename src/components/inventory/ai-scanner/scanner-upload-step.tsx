'use client'

import { AlertCircle, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StockScanner } from './use-stock-scanner'

export function ScannerUploadStep({ scanner }: { scanner: StockScanner }) {
  const t = useTranslations('inventory.aiScanner')
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex min-h-75 flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{t('imageLabel')}</p>
        <Dropzone scanner={scanner} />
        {scanner.file && (
          <Button type="button" variant="outline" size="sm" onClick={scanner.reset} className="self-start text-xs">
            {t('chooseAnother')}
          </Button>
        )}
      </div>
      <ScannerGuide />
    </div>
  )
}

function Dropzone({ scanner }: { scanner: StockScanner }) {
  const t = useTranslations('inventory.aiScanner')
  return (
    <div
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all',
        scanner.preview
          ? 'border-violet-300 bg-violet-50/20 dark:border-violet-800 dark:bg-violet-950/20'
          : 'border-border bg-muted/40 hover:border-violet-400 dark:hover:border-violet-700'
      )}
    >
      {scanner.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={scanner.preview} alt={t('previewAlt')} className="max-h-65 w-auto rounded-lg object-contain shadow-sm" />
      ) : (
        <label className="flex size-full cursor-pointer flex-col items-center justify-center text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-full border bg-card text-violet-600 shadow-sm dark:text-violet-400">
            <UploadCloud className="size-7" />
          </span>
          <span className="text-sm font-semibold text-foreground">{t('uploadPrompt')}</span>
          <span className="mt-1 text-xs text-muted-foreground">{t('formatsHint')}</span>
          <input type="file" accept="image/*" className="hidden" onChange={scanner.pickFile} />
        </label>
      )}
    </div>
  )
}

const STEPS = ['step1', 'step2', 'step3'] as const

function ScannerGuide() {
  const t = useTranslations('inventory.aiScanner')
  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border bg-muted/40 p-5">
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileSpreadsheet className="size-4 text-violet-600 dark:text-violet-400" />
          {t('howItWorks')}
        </h4>
        <ol className="space-y-2.5 text-xs text-muted-foreground">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-400">
                {index + 1}
              </span>
              {t(step)}
            </li>
          ))}
        </ol>
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50 p-3 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        {t('qualityTip')}
      </p>
    </div>
  )
}
