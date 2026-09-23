'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ReceiptText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getPrinterConfig, savePrinterConfig, type PrinterConfig } from '@/lib/printer/storage'
import {
  type PaperWidth,
  CUSTOM_COLUMNS_MIN,
  CUSTOM_COLUMNS_MAX,
  DEFAULT_CUSTOM_COLUMNS,
} from '@/lib/printer/receipt'

/** The boolean receipt-content settings, in the order they appear on the slip. */
const RECEIPT_TOGGLES = [
  { key: 'showCashier', labelKey: 'showCashier' },
  { key: 'showCustomer', labelKey: 'showCustomer' },
  { key: 'showPaymentMethod', labelKey: 'showPaymentMethod' },
  { key: 'showBarcode', labelKey: 'showBarcode' },
  { key: 'showPoweredBy', labelKey: 'showPoweredBy' },
] as const satisfies readonly { key: keyof PrinterConfig; labelKey: string }[]

/**
 * Receipt settings: what the slip says, and how wide the roll is.
 *
 * The transport card that used to sit above this one — browser capability
 * probes, USB/Bluetooth pairing, a GATT UUID field, a network host — is gone.
 * Printing goes through the browser's own print dialog (`connectionType`
 * defaults to `system`, and printReceiptDirect falls back to it for anything
 * else), so that card configured a path nobody here was taking while being the
 * first and largest thing on the page.
 *
 * Paper width moved down here with it: it is not a property of the connection,
 * it is the shape of the receipt — it decides the ESC/POS column count
 * (resolveColumns) and the page width the browser lays the slip out on
 * (src/components/pos/pos-client.tsx).
 */
export function PrinterSettings() {
  const tCommon = useTranslations('common')
  const t = useTranslations('settings.printer')
  const tPos = useTranslations('pos')

  const [config, setConfig] = useState<PrinterConfig>(getPrinterConfig())

  const updateConfig = (patch: Partial<PrinterConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    savePrinterConfig(next)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            {t('receiptSection')}
          </CardTitle>
          <CardDescription>{t('receiptSectionDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t('paperWidth')}</Label>
            <div className="flex gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 w-fit">
              {(['58mm', '80mm', 'custom'] as PaperWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => updateConfig({ paperWidth: w })}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                    config.paperWidth === w
                      ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  {w === 'custom' ? t('paperWidthCustom') : w}
                </button>
              ))}
            </div>
            {config.paperWidth === 'custom' && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={CUSTOM_COLUMNS_MIN}
                  max={CUSTOM_COLUMNS_MAX}
                  value={config.customColumns}
                  onChange={(e) => updateConfig({ customColumns: Number(e.target.value) || DEFAULT_CUSTOM_COLUMNS })}
                  className="h-8 w-24 text-xs rounded-lg"
                />
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t('customColumnsHint', { min: CUSTOM_COLUMNS_MIN, max: CUSTOM_COLUMNS_MAX })}
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-header">{t('headerText')}</Label>
              <Input
                id="receipt-header"
                value={config.headerText}
                onChange={(e) => updateConfig({ headerText: e.target.value })}
                placeholder={t('headerTextPlaceholder')}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-footer">{t('footerText')}</Label>
              <Input
                id="receipt-footer"
                value={config.footerText}
                onChange={(e) => updateConfig({ footerText: e.target.value })}
                placeholder={t('footerTextPlaceholder')}
                className="h-9 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('receiptLines')}</Label>
            <div className="flex flex-wrap gap-2">
              {RECEIPT_TOGGLES.map(({ key, labelKey }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateConfig({ [key]: !config[key] } as Partial<PrinterConfig>)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                    config[key]
                      ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  )}
                >
                  <span
                    className={cn(
                      'h-3.5 w-3.5 rounded-full border-2',
                      config[key] ? 'border-violet-600 bg-violet-600' : 'border-slate-300 dark:border-slate-600'
                    )}
                  />
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview — the same lines the ESC/POS builder emits, so a
              toggle can be judged without burning a strip of paper. */}
          <div className="space-y-2">
            <Label>{t('receiptPreview')}</Label>
            <div className="mx-auto w-full max-w-[19rem] rounded-xl border border-dashed border-slate-300 bg-white p-4 text-[11px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="text-center text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('testCompanyName')}
              </p>
              {config.headerText && <p className="text-center">{config.headerText}</p>}
              <div className="my-2 border-t border-dashed border-slate-300 dark:border-slate-700" />
              <PreviewRow label={t('labelReceipt')} value="#0001" />
              <PreviewRow label={tCommon('date')} value="—" />
              {config.showCashier && <PreviewRow label={t('labelCashier')} value={tCommon('testPrint')} />}
              {config.showCustomer && <PreviewRow label={tPos('customer')} value="—" />}
              <div className="my-2 border-t border-dashed border-slate-300 dark:border-slate-700" />
              <PreviewRow label={t('testItemName')} value="1 000" />
              <div className="my-2 border-t border-dashed border-slate-300 dark:border-slate-700" />
              <PreviewRow label={tCommon('total')} value="1 000" strong />
              {config.showPaymentMethod && <PreviewRow label={t('labelPaymentMethod')} value="CASH" />}
              <p className="mt-3 text-center">{config.footerText || t('testThankYou')}</p>
              {config.showBarcode && (
                <p className="mt-1 text-center font-mono tracking-widest text-slate-400">|| | |||| | || |||</p>
              )}
              {config.showPoweredBy && (
                <p className="mt-1 text-center text-[9px] font-bold text-slate-400">powered by Falco ERP</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** One label/value line of the preview slip. */
function PreviewRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'font-bold text-slate-900 dark:text-slate-100')}>
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  )
}
