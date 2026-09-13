import { DEFAULT_CUSTOM_COLUMNS, type PaperWidth } from './receipt'

/**
 * A receipt printer is a physical device wired to one specific computer or
 * tablet — unlike tenant-wide settings (measurement units, costing method,
 * etc.), it has no business being shared across every device a tenant's
 * staff logs in from, so this lives in localStorage rather than the
 * database. Deliberately per-browser-profile, matching how USB/Bluetooth
 * pairing permissions themselves are already scoped by the browser.
 */

export type PrinterConnectionType = 'usb' | 'bluetooth' | 'network' | 'system'

export interface PrinterConfig {
  connectionType: PrinterConnectionType
  paperWidth: PaperWidth
  /** Character columns per line, used only when paperWidth === 'custom'. */
  customColumns: number
  cyrillic: boolean
  codepage: number
  openDrawerOnSale: boolean
  /** Network printer's IP — recorded for reference; see printer-settings.tsx for why raw network printing isn't possible from a browser tab. */
  networkIp?: string
  /** Bluetooth GATT UUIDs — the common default works for most cheap thermal-printer BLE modules, but firmware varies; exposed here so an unusual model can be reconfigured without a code change. */
  bleServiceUuid: string
  bleCharacteristicUuid: string

  // ─── Receipt content ──────────────────────────────────────────────────────
  // What is actually PRINTED on the slip, as opposed to how the bytes reach
  // the printer. Kept in the same record because both are edited on the same
  // screen and both are per-device: a shop with a counter printer and a
  // delivery-desk printer wants a different footer on each.

  /** Extra line under the company name — a branch name, a slogan, a tax id. */
  headerText: string
  /** Closing line. Empty falls back to the translated "thank you". */
  footerText: string
  showCashier: boolean
  showCustomer: boolean
  showPaymentMethod: boolean
  /** The decorative barcode strip and "powered by" line on the on-screen/HTML receipt. */
  showBarcode: boolean
  showPoweredBy: boolean
}

export const DEFAULT_BLE_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
export const DEFAULT_BLE_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb'

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  connectionType: 'system',
  paperWidth: '80mm',
  customColumns: DEFAULT_CUSTOM_COLUMNS,
  cyrillic: false,
  codepage: 17,
  openDrawerOnSale: false,
  bleServiceUuid: DEFAULT_BLE_SERVICE_UUID,
  bleCharacteristicUuid: DEFAULT_BLE_CHARACTERISTIC_UUID,
  headerText: '',
  footerText: '',
  showCashier: true,
  showCustomer: true,
  showPaymentMethod: true,
  showBarcode: true,
  showPoweredBy: true,
}

const STORAGE_KEY = 'erp_printer_config'

export function getPrinterConfig(): PrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PRINTER_CONFIG
    return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PRINTER_CONFIG
  }
}

export function savePrinterConfig(config: PrinterConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // localStorage unavailable (private mode etc.) — config just won't persist across reloads
  }
}
