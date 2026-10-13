'use client'

import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { ImportExportMenu } from '@/components/shared/import-export-menu'
import { pickField, type ExcelColumn } from '@/lib/excel-io'
import { useTranslations } from 'next-intl'
import { errorMessage } from '@/lib/error-message'

interface CustomerImportExportProps {
  customers: any[]
  lang: string
}

export function CustomerImportExport({ customers }: CustomerImportExportProps) {
  const supabase = createClient() as any
  const tRoot = useTranslations()
  const tSales = useTranslations('sales')
  const tc = useTranslations('common')

  const EXPORT_COLUMNS: ExcelColumn[] = [
    { header: tc('name'), key: 'name' },
    { header: tc('phone'), key: 'phone' },
    { header: tc('email'), key: 'email' },
    { header: tc('address'), key: 'address' },
    { header: tSales('tin'), key: 'tin' },
    { header: tc('notes'), key: 'notes' },
    { header: tc('status'), key: 'statusLabel' },
  ]

  const TEMPLATE_COLUMNS: ExcelColumn[] = [
    { header: tc('name'), key: 'name', sample: 'Alisher Karimov' },
    { header: tc('phone'), key: 'phone', sample: '+998901234567' },
    { header: tc('email'), key: 'email', sample: 'alisher@example.com' },
    { header: tc('address'), key: 'address', sample: "Toshkent sh., Chilonzor t." },
    { header: tSales('tin'), key: 'tin', sample: '' },
    { header: tc('notes'), key: 'notes', sample: '' },
  ]

  const activeLabel = tc('active')
  const inactiveLabel = tc('inactive')

  const exportRows = customers.map((c) => ({
    ...c,
    statusLabel: c.is_active ? activeLabel : inactiveLabel,
  }))

  const handleImport = async (rows: Record<string, any>[]) => {
    const newCustomers = rows
      .map((row) => {
        const name = pickField(row, tc('name'), 'Nomi', 'Ism', 'Name', 'Имя', 'Название')
        if (!name) return null
        return {
          name,
          phone: pickField(row, tc('phone'), 'Telefon', 'Phone', 'Телефон') || null,
          email: pickField(row, tc('email'), 'Email', 'Электрон pochta', 'Почта') || null,
          address: pickField(row, tc('address'), 'Manzil', 'Address', 'Адрес') || null,
          tin: pickField(row, tSales('tin'), 'STIR', 'TIN', 'ИНН') || null,
          notes: pickField(row, tc('notes'), 'Izoh', 'Notes', 'Комментарий') || null,
          is_active: true,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    if (newCustomers.length === 0) return { count: 0 }

    const { error } = await supabase.from('customers').insert(newCustomers)
    if (error) return { count: 0, error: errorMessage(tRoot, error, tc('error')) }
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
