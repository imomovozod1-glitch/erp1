import { buildReceiptBytes, type ReceiptOrder, type ReceiptCompanyInfo, type ReceiptLabels } from './receipt'
import { getPrinterConfig } from './storage'
import { getPairedUsbPrinter, sendViaUsb, sendViaBluetooth } from './transport'

export type PrintResult =
  | { ok: true; via: 'usb' | 'bluetooth' }
  | { ok: false; reason: 'no-device-paired' | 'send-failed' | 'not-configured'; fallbackToSystemPrint: true }

/**
 * Bluetooth needs a user gesture on every connect on most browsers (no
 * "getDevices()"-style silent reconnect exists for Web Bluetooth the way it
 * does for WebUSB), so the paired BluetoothDevice handle has to be kept
 * alive in memory across print calls rather than re-requested from
 * storage — the settings page stores it here once paired.
 */
let pairedBluetoothDevice: BluetoothDevice | null = null

export function setPairedBluetoothDevice(device: BluetoothDevice | null): void {
  pairedBluetoothDevice = device
}

export function getPairedBluetoothDevice(): BluetoothDevice | null {
  return pairedBluetoothDevice
}

/**
 * Attempts a direct ESC/POS print via the configured USB or Bluetooth
 * printer. Returns a result the caller uses to decide whether to fall back
 * to window.print() — this function never calls window.print() itself, so
 * it stays testable/pure and the fallback stays visible at the call site.
 */
export async function printReceiptDirect(
  order: ReceiptOrder,
  company: ReceiptCompanyInfo,
  labels: ReceiptLabels
): Promise<PrintResult> {
  const config = getPrinterConfig()

  if (config.connectionType !== 'usb' && config.connectionType !== 'bluetooth') {
    return { ok: false, reason: 'not-configured', fallbackToSystemPrint: true }
  }

  const bytes = buildReceiptBytes(order, company, labels, {
    paperWidth: config.paperWidth,
    cyrillic: config.cyrillic,
    codepage: config.codepage,
    openDrawer: config.openDrawerOnSale,
  })

  try {
    if (config.connectionType === 'usb') {
      const device = await getPairedUsbPrinter()
      if (!device) return { ok: false, reason: 'no-device-paired', fallbackToSystemPrint: true }
      await sendViaUsb(device, bytes)
      return { ok: true, via: 'usb' }
    }

    // bluetooth
    if (!pairedBluetoothDevice) return { ok: false, reason: 'no-device-paired', fallbackToSystemPrint: true }
    await sendViaBluetooth(pairedBluetoothDevice, bytes)
    return { ok: true, via: 'bluetooth' }
  } catch {
    return { ok: false, reason: 'send-failed', fallbackToSystemPrint: true }
  }
}
