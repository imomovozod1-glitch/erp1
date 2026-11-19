import { exportRowsToExcel } from '@/lib/excel-io'
import type { CatalogItem } from './catalog-types'

type Translate = (key: string) => string

export interface ExportColumn {
  header: string
  key: string
}

export async function exportCatalog(items: CatalogItem[], t: Translate, columns: ExportColumn[], fileName: string) {
  const rows = items.map((item) => ({
    ...item,
    categoryName: item.categories?.name ?? '',
    statusLabel: t(item.is_active ? 'common.active' : 'common.inactive'),
  }))
  await exportRowsToExcel(rows, columns, fileName)
}
