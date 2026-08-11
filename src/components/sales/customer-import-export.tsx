'use client'

import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { ImportExportMenu } from '@/components/shared/import-export-menu'
import { pickField, type ExcelColumn } from '@/lib/excel-io'

interface CustomerImportExportProps {
  customers: any[]
}

const EXPORT_COLUMNS: ExcelColumn[] = [
  { header: 'Nomi', key: 'name' },
  { header: 'Telefon', key: 'phone' },
  { header: 'Email', key: 'email' },
  { header: 'Manzil', key: 'address' },
  { header: 'STIR', key: 'tin' },
  { header: 'Izoh', key: 'notes' },
  { header: 'Holat', key: 'statusLabel' },
]

const TEMPLATE_COLUMNS: ExcelColumn[] = [
  { header: 'Nomi', key: 'name', sample: 'Alisher Karimov' },
  { header: 'Telefon', key: 'phone', sample: '+998901234567' },
  { header: 'Email', key: 'email', sample: 'alisher@example.com' },
  { header: 'Manzil', key: 'address', sample: "Toshkent sh., Chilonzor t." },
  { header: 'STIR', key: 'tin', sample: '' },
  { header: 'Izoh', key: 'notes', sample: '' },
]

export function CustomerImportExport({ customers }: CustomerImportExportProps) {
  const supabase = createClient() as any

  const exportRows = customers.map((c) => ({
    ...c,
    statusLabel: c.is_active ? 'Faol' : 'Nofaol',
  }))

  const handleImport = async (rows: Record<string, any>[]) => {
    const newCustomers = rows
      .map((row) => {
        const name = pickField(row, 'Nomi', 'Ism', 'Name', 'Имя', 'Название')
        if (!name) return null
        return {
          name,
          phone: pickField(row, 'Telefon', 'Phone', 'Телефон') || null,
          email: pickField(row, 'Email', 'Электрон pochta', 'Почта') || null,
          address: pickField(row, 'Manzil', 'Address', 'Адрес') || null,
          tin: pickField(row, 'STIR', 'TIN', 'ИНН') || null,
          notes: pickField(row, 'Izoh', 'Notes', 'Комментарий') || null,
          is_active: true,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    if (newCustomers.length === 0) return { count: 0 }

    const { error } = await supabase.from('customers').insert(newCustomers)
    if (error) return { count: 0, error: error.message }
    await invalidateCustomers()
    return { count: newCustomers.length }
  }

  return (
    <ImportExportMenu
      data={exportRows}
      exportColumns={EXPORT_COLUMNS}
      templateColumns={TEMPLATE_COLUMNS}
      filenamePrefix="mijozlar"
      onImport={handleImport}
    />
  )
}
