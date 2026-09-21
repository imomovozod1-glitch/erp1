'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Printer,
  Usb,
  Bluetooth,
  Wifi,
  Monitor,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ReceiptText,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  getPrinterConfig,
  savePrinterConfig,
  type PrinterConfig,
  type PrinterConnectionType,
} from '@/lib/printer/storage'

/** The boolean receipt-content settings, in the order they appear on the slip. */
const RECEIPT_TOGGLES = [
  { key: 'showCashier', labelKey: 'showCashier' },
  { key: 'showCustomer', labelKey: 'showCustomer' },
  { key: 'showPaymentMethod', labelKey: 'showPaymentMethod' },
  { key: 'showBarcode', labelKey: 'showBarcode' },
  { key: 'showPoweredBy', labelKey: 'showPoweredBy' },
] as const satisfies readonly { key: keyof PrinterConfig; labelKey: string }[]
import {
  type PaperWidth,
  CUSTOM_COLUMNS_MIN,
  CUSTOM_COLUMNS_MAX,
  DEFAULT_CUSTOM_COLUMNS,
} from '@/lib/printer/receipt'
import {
  isWebUsbSupported,
  isWebBluetoothSupported,
  requestUsbPrinter,
  getPairedUsbPrinter,
  sendViaUsb,
  requestBluetoothPrinter,
  sendViaBluetooth,
} from '@/lib/printer/transport'
import { buildReceiptBytes } from '@/lib/printer/receipt'
import { setPairedBluetoothDevice, getPairedBluetoothDevice } from '@/lib/printer/print'

const CONNECTION_TYPES: { value: PrinterConnectionType; icon: typeof Usb }[] = [
  { value: 'usb', icon: Usb },
  { value: 'bluetooth', icon: Bluetooth },
  { value: 'network', icon: Wifi },
  { value: 'system', icon: Monitor },
]

export function PrinterSettings() {
  const tCommon = useTranslations('common')
  const t = useTranslations('settings.printer')
  // Receipt labels come from the same namespace the POS receipt uses, so the
  // test print is worded exactly like a real one.
  const tPos = useTranslations('pos')

  const [config, setConfig] = useState<PrinterConfig>(getPrinterConfig())
  const [usbSupported, setUsbSupported] = useState(false)
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [pairedUsbName, setPairedUsbName] = useState<string | null>(null)
  const [pairedBtName, setPairedBtName] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    getPairedUsbPrinter().then((d) => {
      setUsbSupported(isWebUsbSupported())
      setBluetoothSupported(isWebBluetoothSupported())
      setPairedUsbName(d?.productName || (d ? tCommon('active') : null))
      const bt = getPairedBluetoothDevice()
      if (bt) setPairedBtName(bt.name || tCommon('active'))
    })
  }, [tCommon])

  const updateConfig = (patch: Partial<PrinterConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    savePrinterConfig(next)
  }

  const handlePairUsb = async () => {
    setIsConnecting(true)
    try {
      const device = await requestUsbPrinter()
      setPairedUsbName(device.productName || tCommon('active'))
      updateConfig({ connectionType: 'usb' })
      toast.success(t('pairSuccess'))
    } catch {
      // user cancelled the picker, or no device was selected — not an error worth surfacing
    } finally {
      setIsConnecting(false)
    }
  }

  const handlePairBluetooth = async () => {
    setIsConnecting(true)
    try {
      const device = await requestBluetoothPrinter()
      setPairedBluetoothDevice(device)
      setPairedBtName(device.name || tCommon('active'))
      updateConfig({ connectionType: 'bluetooth' })
      toast.success(t('pairSuccess'))
    } catch {
      // cancelled picker
    } finally {
      setIsConnecting(false)
    }
  }

  const handleTestPrint = async () => {
    setIsTesting(true)
    try {
      const bytes = buildReceiptBytes(
        {
          orderNumber: 'TEST-0001',
          date: new Date().toLocaleString(),
          cashier: tCommon('testPrint') || 'Test',
          customerName: '—',
          items: [{ name: t('testItemName'), quantity: 1, price: 1000, discount: 0, total: 1000 }],
          subtotal: 1000,
          discount: 0,
          tax: 0,
          total: 1000,
          paymentMethod: 'cash',
        },
        { name: t('testCompanyName') },
        {
          receipt: t('labelReceipt'),
          date: tCommon('date'),
          cashier: t('labelCashier'),
          customer: tPos('customer'),
          subtotal: t('labelSubtotal'),
          discount: tPos('discount'),
          tax: t('labelTax'),
          total: tCommon('total'),
          paymentMethod: t('labelPaymentMethod'),
          thankYou: t('testThankYou'),
        },
        {
          paperWidth: config.paperWidth,
          customColumns: config.customColumns,
          cyrillic: config.cyrillic,
          codepage: config.codepage,
          openDrawer: false,
          content: {
            headerText: config.headerText,
            footerText: config.footerText,
            showCashier: config.showCashier,
            showCustomer: config.showCustomer,
            showPaymentMethod: config.showPaymentMethod,
          },
        }
      )

      if (config.connectionType === 'usb') {
        const device = await getPairedUsbPrinter()
        if (!device) throw new Error('no-device')
        await sendViaUsb(device, bytes)
      } else if (config.connectionType === 'bluetooth') {
        const device = getPairedBluetoothDevice()
        if (!device) throw new Error('no-device')
        await sendViaBluetooth(device, bytes)
      } else {
        toast.info(t('testPrintSystemHint'))
        setIsTesting(false)
        return
      }
      toast.success(t('testPrintSuccess'))
    } catch {
      toast.error(t('testPrintFailed'))
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Printer className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Browser capability status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs">
              {usbSupported ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
              )}
              <span className="text-slate-600 dark:text-slate-300">{t('usbSupportLabel')}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs">
              {bluetoothSupported ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
              )}
              <span className="text-slate-600 dark:text-slate-300">{t('bluetoothSupportLabel')}</span>
            </div>
          </div>

          {/* Connection type selector */}
          <div className="space-y-2">
            <Label>{t('connectionType')}</Label>
            <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 w-fit">
              {CONNECTION_TYPES.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateConfig({ connectionType: value })}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                    config.connectionType === value
                      ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`connectionType_${value}`)}
                </button>
              ))}
            </div>
          </div>

          {/* USB pairing */}
          {config.connectionType === 'usb' && (
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              {!usbSupported ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {t('usbUnsupportedWarning')}
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {pairedUsbName ? `${t('pairedDevice')}: ${pairedUsbName}` : t('noDevicePaired')}
                    </span>
                    <Button size="sm" variant="outline" onClick={handlePairUsb} disabled={isConnecting} className="rounded-lg text-xs">
                      {t('pairUsbButton')}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('usbDriverHint')}</p>
                </>
              )}
            </div>
          )}

          {/* Bluetooth pairing */}
          {config.connectionType === 'bluetooth' && (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              {!bluetoothSupported ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {t('bluetoothUnsupportedWarning')}
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {pairedBtName ? `${t('pairedDevice')}: ${pairedBtName}` : t('noDevicePaired')}
                    </span>
                    <Button size="sm" variant="outline" onClick={handlePairBluetooth} disabled={isConnecting} className="rounded-lg text-xs">
                      {t('pairBluetoothButton')}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('bluetoothSppWarning')}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('bluetoothReconnectHint')}</p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500 dark:text-slate-400">{t('bleServiceUuid')}</Label>
                      <Input
                        value={config.bleServiceUuid}
                        onChange={(e) => updateConfig({ bleServiceUuid: e.target.value })}
                        className="h-8 text-[11px] font-mono rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500 dark:text-slate-400">{t('bleCharacteristicUuid')}</Label>
                      <Input
                        value={config.bleCharacteristicUuid}
                        onChange={(e) => updateConfig({ bleCharacteristicUuid: e.target.value })}
                        className="h-8 text-[11px] font-mono rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Network */}
          {config.connectionType === 'network' && (
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {t('networkLimitationWarning')}
              </p>
              <div className="space-y-1 pt-1">
                <Label className="text-[11px] text-slate-500 dark:text-slate-400">{t('networkIpLabel')}</Label>
                <Input
                  value={config.networkIp || ''}
                  onChange={(e) => updateConfig({ networkIp: e.target.value })}
                  placeholder="192.168.1.100"
                  className="h-8 text-xs rounded-lg font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('networkDriverHint')}</p>
            </div>
          )}

          {config.connectionType === 'system' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('systemHint')}</p>
            </div>
          )}

          {/* Paper width */}
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

          {/* Cyrillic + drawer toggles */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => updateConfig({ cyrillic: !config.cyrillic })}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                config.cyrillic
                  ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              )}
            >
              <span className={cn('h-3.5 w-3.5 rounded-full border-2', config.cyrillic ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-600')} />
              {t('cyrillicToggle')}
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ openDrawerOnSale: !config.openDrawerOnSale })}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                config.openDrawerOnSale
                  ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              )}
            >
              <span className={cn('h-3.5 w-3.5 rounded-full border-2', config.openDrawerOnSale ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-600')} />
              {t('openDrawerToggle')}
            </button>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              onClick={handleTestPrint}
              disabled={isTesting || (config.connectionType === 'usb' && !pairedUsbName) || (config.connectionType === 'bluetooth' && !pairedBtName)}
              className="bg-violet-600 hover:bg-violet-500 rounded-xl h-10 px-5 text-xs font-semibold"
            >
              {isTesting ? tCommon('loading') : t('testPrintButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── What gets printed on the slip ──────────────────────────────────
          Separate card from the transport settings above: a shop owner edits
          the wording of their receipt far more often than they re-pair a
          printer, and mixing the two put a slogan field next to a GATT UUID. */}
      <Card className="border-slate-200/60 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            {t('receiptSection')}
          </CardTitle>
          <CardDescription>{t('receiptSectionDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
