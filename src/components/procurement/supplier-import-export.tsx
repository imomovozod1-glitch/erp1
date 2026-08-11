'use client'

import { createClient } from '@/lib/supabase/client'
import { invalidateSuppliers } from '@/lib/data/revalidate'
import { ImportExportMenu } from '@/components/shared/import-export-menu'
import { pickField, type ExcelColumn } from '@/lib/excel-io'

interface SupplierImportExportProps {
  suppliers: any[]
}

const EXPORT_COLUMNS: ExcelColumn[] = [
  { header: 'Nomi', key: 'name' },
  { header: 'Telefon', key: 'phone' },
  { header: 'Email', key: 'email' },
  { header: "Bog'lovchi shaxs", key: 'contact_person' },
  { header: 'Manzil', key: 'address' },
  { header: 'Shahar', key: 'city' },
  { header: 'STIR', key: 'tin' },
  { header: 'Izoh', key: 'notes' },
  { header: 'Holat', key: 'statusLabel' },
]

const TEMPLATE_COLUMNS: ExcelColumn[] = [
  { header: 'Nomi', key: 'name', sample: 'ABC Trading LLC' },
  { header: 'Telefon', key: 'phone', sample: '+998901234567' },
  { header: 'Email', key: 'email', sample: 'info@abctrading.uz' },
  { header: "Bog'lovchi shaxs", key: 'contact_person', sample: 'Jasur Rahimov' },
  { header: 'Manzil', key: 'address', sample: "Toshkent sh., Yunusobod t." },
  { header: 'Shahar', key: 'city', sample: 'Toshkent' },
  { header: 'STIR', key: 'tin', sample: '' },
  { header: 'Izoh', key: 'notes', sample: '' },
]

export function SupplierImportExport({ suppliers }: SupplierImportExportProps) {
  const supabase = createClient() as any

  const exportRows = suppliers.map((s) => ({
    ...s,
    statusLabel: s.is_active ? 'Faol' : 'Nofaol',
  }))

  const handleImport = async (rows: Record<string, any>[]) => {
    const newSuppliers = rows
      .map((row) => {
        const name = pickField(row, 'Nomi', 'Name', 'Название')
        const phone = pickField(row, 'Telefon', 'Phone', 'Телефон')
        if (!name || !phone) return null
        return {
          name,
          phone,
          email: pickField(row, 'Email', 'Почта') || null,
          contact_person: pickField(row, "Bog'lovchi shaxs", 'Contact Person', 'Контактное лицо') || null,
          address: pickField(row, 'Manzil', 'Address', 'Адрес') || null,
          city: pickField(row, 'Shahar', 'City', 'Город') || null,
          tin: pickField(row, 'STIR', 'TIN', 'ИНН') || null,
          notes: pickField(row, 'Izoh', 'Notes', 'Комментарий') || null,
          is_active: true,
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    if (newSuppliers.length === 0) return { count: 0 }

    const { error } = await supabase.from('suppliers').insert(newSuppliers)
    if (error) return { count: 0, error: error.message }
    await invalidateSuppliers()
    return { count: newSuppliers.length }
  }

  return (
    <ImportExportMenu
      data={exportRows}
      exportColumns={EXPORT_COLUMNS}
      templateColumns={TEMPLATE_COLUMNS}
      filenamePrefix="yetkazib_beruvchilar"
      onImport={handleImport}
    />
  )
}
