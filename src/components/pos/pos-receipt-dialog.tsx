'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, Loader2, Printer } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { PrinterConfig } from '@/lib/printer/storage'

/** One sold line, already priced, as the receipt prints it. */
export interface ReceiptLine {
  name: string
  quantity: number
  price: number
  /** Per-line discount, in percent. */
  discount: number
  total: number
}

/** A completed sale, in the shape the receipt prints it. */
export interface ReceiptOrder {
  orderNumber: string
  date: string
  cashier: string
  customerName: string
  items: ReceiptLine[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
}

/**
 * The thermal-receipt preview shown after a completed sale.
 *
 * Lifted out of `pos-client.tsx`, which had grown past 1400 lines. This is the
 * one part of that screen that owns no state at all — the sale is already
 * finished by the time it renders — so it is pure output driven by props, and
 * it belongs next to the till rather than inside it.
 *
 * Typing `order` properly is the point of the move as much as the line count:
 * the block was reading fields off an `any`, which is how
 * `checkoutSuccessOrder?.discount > 0` (a comparison against `undefined`) went
 * unnoticed.
 *
 * `id="pos-thermal-receipt"` must stay exactly as it is — the print stylesheet
 * in the parent hides everything except that subtree.
 */
export function PosReceiptDialog({
  order,
  status = 'saved',
  company,
  config,
  onClose,
  onPrint,
}: {
  /** The completed sale, or null when no receipt is showing. */
  order: ReceiptOrder | null
  /**
   * Whether the sale behind this receipt has landed in the database yet. The
   * receipt is shown the instant the button is pressed, so it has to be able
   * to say "not saved" — the cashier has already taken the money by then.
   */
  status?: 'saving' | 'saved' | 'failed'
  company: { name: string; phone?: string }
  config: PrinterConfig
  onClose: () => void
  onPrint: () => void
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('pos')

  return (
    <Dialog
      open={order !== null}
      onOpenChange={(val) => {
        if (!val) onClose()
      }}
    >
      {order && (
        <DialogContent className="max-w-md rounded-2xl bg-slate-100 dark:bg-slate-800 border-0 shadow-2xl p-6">
          <DialogHeader className="no-print">
            <div
              className={`mb-1 flex items-center gap-2 ${
                status === 'failed'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {status === 'saving' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : status === 'failed' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              <DialogTitle className="text-lg font-bold">{t('orderSuccess')}</DialogTitle>
            </div>
            {status === 'failed' && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {t('saveFailed')}
              </p>
            )}
          </DialogHeader>

          {/* Receipt container */}
          <div
            id="pos-thermal-receipt"
            className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs mx-auto max-w-[320mm]"
          >
            <div className="text-center space-y-1 mb-4">
              <h2 className="text-base font-bold text-slate-800">{company.name}</h2>
              {config.headerText && (
                <p className="text-[10px] text-slate-500">{config.headerText}</p>
              )}
              {company.phone && <p className="text-[10px] text-slate-400">{company.phone}</p>}
              <div className="border-b border-dashed border-slate-200 my-2" />
            </div>

            <div className="space-y-1 text-xs text-slate-600 mb-3">
              <div className="flex justify-between">
                <span>{t('receipt')}:</span>
                <span className="font-bold text-slate-800">#{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>{tCommon('date')}:</span>
                <span>{order.date}</span>
              </div>
              {config.showCashier && (
                <div className="flex justify-between">
                  <span>{t('cashier')}:</span>
                  <span>{order.cashier}</span>
                </div>
              )}
              {config.showCustomer && (
                <div className="flex justify-between">
                  <span>{t('customer')}:</span>
                  <span className="font-medium text-slate-700">{order.customerName}</span>
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-200 my-2" />

            {/* Sold lines */}
            <div className="space-y-2 text-xs mb-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between text-slate-800 font-medium">
                    <span>{item.name}</span>
                    <span className="tabular-nums">{formatCurrency(item.total)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span className="tabular-nums">
                      {item.quantity} x {formatCurrency(item.price)}
                      {item.discount > 0 ? ` (-${item.discount}%)` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-slate-200 my-2" />

            {/* Totals */}
            <div className="space-y-1.5 text-xs text-slate-600 mb-4">
              <div className="flex justify-between">
                <span>{t('subtotal')}:</span>
                <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>{t('discount')}:</span>
                  <span className="tabular-nums">-{formatCurrency(order.discount)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between">
                  <span>{t('tax')}:</span>
                  <span className="tabular-nums">{formatCurrency(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-800 pt-1 border-t border-slate-100">
                <span>{t('total')}:</span>
                <span className="tabular-nums">{formatCurrency(order.total)}</span>
              </div>
              {config.showPaymentMethod && (
                <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                  <span>{t('paymentMethod')}:</span>
                  <span className="uppercase">{order.paymentMethod}</span>
                </div>
              )}
            </div>

            {/* Footer barcode mockup */}
            <div className="text-center space-y-1.5 pt-2 border-t border-dashed border-slate-200">
              {config.showBarcode && (
                <div className="inline-block tracking-widest font-mono text-[9px] bg-slate-100 text-slate-500 px-3 py-1 rounded">
                  |||| | ||||| | || |||| | | ||| | |||
                </div>
              )}
              <p className="text-[10px] text-slate-400">{config.footerText || t('thankYou')}</p>
              {config.showPoweredBy && (
                <p className="text-[9px] text-slate-400 font-bold">powered by ERP System</p>
              )}
            </div>
          </div>

          <DialogFooter className="no-print pt-4 gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl flex-1 h-11"
            >
              {tCommon('close')}
            </Button>
            <Button
              onClick={onPrint}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl flex-1 h-11"
            >
              <Printer className="h-4 w-4 mr-2" />
              {t('printReceipt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
