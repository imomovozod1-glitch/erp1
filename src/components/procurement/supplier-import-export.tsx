'use client'

import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { invalidateSuppliers } from '@/lib/data/revalidate'
import { ImportExportMenu } from '@/components/shared/import-export-menu'
import { pickField, type ExcelColumn } from '@/lib/excel-io'
import { errorMessage } from '@/lib/error-message'

interface SupplierImportExportProps {
  suppliers: any[]
  lang: string
}

export function SupplierImportExport({ suppliers }: SupplierImportExportProps) {
  const tRoot = useTranslations()
  const supabase = createClient() as any

  // Headers follow the UI language; the import below still accepts the
  // headers of every language, so a file exported in one reads back in another.
  const EXPORT_COLUMNS: ExcelColumn[] = [
    { header: tRoot('common.name'), key: 'name' },
    { header: tRoot('common.phone'), key: 'phone' },
    { header: tRoot('common.email'), key: 'email' },
    { header: tRoot('procurement.contactPerson'), key: 'contact_person' },
    { header: tRoot('common.address'), key: 'address' },
    { header: tRoot('common.city'), key: 'city' },
    { header: tRoot('procurement.tin'), key: 'tin' },
    { header: tRoot('common.notes'), key: 'notes' },
    { header: tRoot('common.status'), key: 'statusLabel' },
  ]

  const TEMPLATE_COLUMNS: ExcelColumn[] = [
    { header: tRoot('common.name'), key: 'name', sample: 'ABC Trading LLC' },
    { header: tRoot('common.phone'), key: 'phone', sample: '+998901234567' },
    { header: tRoot('common.email'), key: 'email', sample: 'info@abctrading.uz' },
    { header: tRoot('procurement.contactPerson'), key: 'contact_person', sample: 'Jasur Rahimov' },
    { header: tRoot('common.address'), key: 'address', sample: "Toshkent sh., Yunusobod t." },
    { header: tRoot('common.city'), key: 'city', sample: 'Toshkent' },
    { header: tRoot('procurement.tin'), key: 'tin', sample: '' },
    { header: tRoot('common.notes'), key: 'notes', sample: '' },
  ]

  const activeLabel = tRoot('common.active')
  const inactiveLabel = tRoot('common.inactive')

  const exportRows = suppliers.map((s) => ({
    ...s,
    statusLabel: s.is_active ? activeLabel : inactiveLabel,
  }))

  const handleImport = async (rows: Record<string, any>[]) => {
    const newSuppliers = rows
      .map((row) => {
        const name = pickField(row, tRoot('common.name'), 'Nomi', 'Name', 'Название')
        const phone = pickField(row, tRoot('common.phone'), 'Telefon', 'Phone', 'Телефон')
        if (!name || !phone) return null
        return {
          name,
          phone,
          email: pickField(row, tRoot('common.email'), 'Email', 'Elektron pochta', 'Электронная почта', 'Почта') || null,
          contact_person: pickField(row, tRoot('procurement.contactPerson'), "Bog'lovchi shaxs", 'Aloqa shaxsi', 'Contact Person', 'Контактное лицо') || null,
          address: pickField(row, tRoot('common.address'), 'Manzil', 'Address', 'Адрес') || null,
          city: pickField(row, tRoot('common.city'), 'Shahar', 'City', 'Город') || null,
          tin: pickField(row, tRoot('procurement.tin'), 'STIR', 'TIN', 'ИНН') || null,
          notes: pickField(row, tRoot('common.notes'), 'Izoh', 'Izohlar', 'Notes', 'Примечания', 'Комментарий') || null,
          is_active: true,
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    if (newSuppliers.length === 0) return { count: 0 }

    const { error } = await supabase.from('suppliers').insert(newSuppliers)
    if (error) return { count: 0, error: errorMessage(tRoot, error, tRoot('common.error')) }
    await invalidateSuppliers()
    return { count: newSuppliers.length }
  }

  return (
    <ImportExportMenu
      // The list is server-paginated, so `suppliers` is one page; export must
      // still cover every supplier.
      fetchAllRows={async () => {
        const { data } = await createClient().from('suppliers').select('*').order('created_at', { ascending: false })
        return data ?? []
      }}
      data={exportRows}
      exportColumns={EXPORT_COLUMNS}
      templateColumns={TEMPLATE_COLUMNS}
      filenamePrefix="yetkazib_beruvchilar"
      onImport={handleImport}
    />
  )
}
