'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_CUSTOM_COLUMNS } from '@/lib/printer/receipt'
import { DEFAULT_PRINTER_CONFIG, getPrinterConfig, type PrinterConfig } from '@/lib/printer/storage'

const MM_PER_COLUMN = 80 / 48

const rollWidthMm = (config: PrinterConfig) => {
  if (config.paperWidth === '58mm') return 58
  if (config.paperWidth === 'custom') return Math.round((config.customColumns || DEFAULT_CUSTOM_COLUMNS) * MM_PER_COLUMN)
  return 80
}

/** Receipt settings from Settings → Receipt; read after mount because they live in localStorage. */
export function useReceiptConfig() {
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG)
  useEffect(() => {
    const timer = setTimeout(() => setConfig(getPrinterConfig()), 0)
    return () => clearTimeout(timer)
  }, [])
  return { config, widthMm: rollWidthMm(config) }
}
