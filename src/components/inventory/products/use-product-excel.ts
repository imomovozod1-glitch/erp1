'use client'

import type { ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'
import { invalidateMovements, invalidateProducts } from '@/lib/data/revalidate'
import { getMeasurementUnits } from '@/lib/units'
import { exportCatalog } from '../catalog/catalog-export'
import type { CatalogItem } from '../catalog/catalog-types'
import { parseProductRows, type ImportedProduct } from './product-import-parse'
import { saveImportedProducts } from './product-import-save'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const isSpreadsheet = (file: File) => /\.(xlsx|xls|csv)$/i.test(file.name) && file.size <= MAX_FILE_BYTES

async function readFirstSheet(file: File) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Record<string, unknown>[]
}

export function useProductExcel(products: CatalogItem[]) {
  const t = useTranslations()

  const field = (key: string) => t(`inventory.excel.${key}`)

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const units = await getMeasurementUnits(createClient())
    const sample = {
      [field('name')]: field('sampleName'),
      [field('sku')]: 'SKU-000001',
      [field('price')]: 15000,
      [field('costPrice')]: 10000,
      [field('incomingCost')]: 9500,
      [field('stock')]: 100,
      [field('minStock')]: 10,
      [field('unit')]: units[0] || t('inventory.aiScanner.defaultUnit'),
      [field('description')]: field('sampleDescription'),
    }
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([sample]), 'Products')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(units.map((u) => ({ [field('allowedUnits')]: u }))), field('unitsSheet'))
    XLSX.writeFile(workbook, 'mahsulotlar_shablon.xlsx')
  }

  const exportProducts = () =>
    exportCatalog(
      products,
      t,
      [
        { header: field('name'), key: 'name' },
        { header: field('sku'), key: 'sku' },
        { header: t('inventory.category'), key: 'categoryName' },
        { header: field('price'), key: 'price' },
        { header: field('costPrice'), key: 'cost_price' },
        { header: field('stock'), key: 'stock' },
        { header: field('minStock'), key: 'min_stock' },
        { header: field('unit'), key: 'unit' },
        { header: t('common.status'), key: 'statusLabel' },
      ],
      'mahsulotlar.xlsx'
    )

  const save = async (supabase: any, imported: ImportedProduct[]) => {
    const loading = toast.loading(t('inventory.importingData'))
    try {
      await saveImportedProducts(supabase, imported)
      toast.success(t('inventory.productsImported', { count: imported.length }))
      await invalidateProducts()
      await invalidateMovements()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      toast.dismiss(loading)
    }
  }

  const importRows = async (rows: Record<string, unknown>[]) => {
    if (!rows.length) return void toast.error(t('common.error'))
    const supabase = createClient()
    const units = await getMeasurementUnits(supabase)
    const { products: imported, invalidUnits } = parseProductRows(rows, units)
    if (invalidUnits.length) {
      const list = invalidUnits.map((r) => `${r.name} ("${r.unit || field('emptyUnit')}")`).join(', ')
      return void toast.error(t('inventory.excel.unitMismatch', { rows: list, units: units.join(', ') }), { duration: 8000 })
    }
    if (!imported.length) return void toast.error(t('inventory.noValidProducts'))
    await save(supabase, imported)
  }

  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!isSpreadsheet(file)) return void toast.error(t('common.error'))
    try {
      await importRows(await readFirstSheet(file))
    } catch {
      toast.error(t('inventory.excelReadError'))
    }
  }

  return { downloadTemplate, exportProducts, importFile }
}
