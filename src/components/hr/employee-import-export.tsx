'use client'

import { createClient } from '@/lib/supabase/client'
import { invalidateEmployees } from '@/lib/data/revalidate'
import { formatDate, generateDocumentNumber } from '@/lib/utils'
import { ImportExportMenu } from '@/components/shared/import-export-menu'
import { pickField, type ExcelColumn } from '@/lib/excel-io'

interface EmployeeImportExportProps {
  employees: any[]
  lang: string
}

const EXPORT_COLUMNS: ExcelColumn[] = [
  { header: 'Xodim kodi', key: 'employee_code' },
  { header: "F.I.Sh.", key: 'fullName' },
  { header: 'Telefon raqami', key: 'phone' },
  { header: 'Lavozim', key: 'position' },
  { header: 'Oylik maosh', key: 'salary' },
  { header: 'Ishga qabul qilingan sana', key: 'hiredAtLabel' },
  { header: 'Holat', key: 'statusLabel' },
]

const TEMPLATE_COLUMNS: ExcelColumn[] = [
  { header: 'Xodim kodi', key: 'employee_code', sample: 'EMP-1001' },
  { header: "F.I.Sh.", key: 'fullName', sample: '' },
  { header: "Telefon raqami (ixtiyoriy, mavjud foydalanuvchi bilan bog'lash uchun)", key: 'phone', sample: '+998901234567' },
  { header: 'Lavozim', key: 'position', sample: 'Sotuvchi' },
  { header: 'Oylik maosh', key: 'salary', sample: 3000000 },
  { header: 'Ishga qabul qilingan sana (YYYY-MM-DD)', key: 'hiredAtLabel', sample: '2026-01-15' },
]

export function EmployeeImportExport({ employees, lang }: EmployeeImportExportProps) {
  const supabase = createClient() as any

  const activeLabel = lang === 'uz' ? 'Ishlamoqda' : lang === 'ru' ? 'Работает' : 'Employed'
  const inactiveLabel = lang === 'uz' ? "Bo'shatilgan" : lang === 'ru' ? 'Уволен' : 'Terminated'

  const exportRows = employees.map((e) => ({
    ...e,
    fullName: e.full_name || '',
    phone: e.profiles?.phone || '',
    hiredAtLabel: e.hired_at ? formatDate(e.hired_at) : '',
    statusLabel: e.is_active ? activeLabel : inactiveLabel,
  }))

  const handleImport = async (rows: Record<string, any>[]) => {
    // Employees can optionally link to an existing user account (profiles row) by
    // phone — the login itself — compared digits-only so "+998 90 123-45-67" and
    // "998901234567" match. Importing never creates new login accounts.
    const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')
    const readPhone = (row: Record<string, any>) =>
      digits(pickField(row, "Telefon raqami (ixtiyoriy, mavjud foydalanuvchi bilan bog'lash uchun)", 'Telefon raqami', 'Phone', 'Телефон'))

    let profilesByPhone: Record<string, string> = {}
    if (rows.some((row) => readPhone(row))) {
      const { data: profiles } = await supabase.from('profiles').select('id, phone')
      profilesByPhone = Object.fromEntries(
        (profiles || []).filter((p: any) => digits(p.phone)).map((p: any) => [digits(p.phone), p.id])
      )
    }

    const newEmployees = rows
      .map((row) => {
        const employeeCode = pickField(row, 'Xodim kodi', 'Employee Code', 'Код сотрудника')
        const hiredAt = pickField(row, 'Ishga qabul qilingan sana (YYYY-MM-DD)', 'Ishga qabul qilingan sana', 'Hired At', 'Дата приёма')
        if (!hiredAt) return null
        const phone = readPhone(row)
        const salaryRaw = pickField(row, 'Oylik maosh', 'Salary', 'Зарплата')
        return {
          // Optional, as in the form: a blank one is generated.
          employee_code: employeeCode || generateDocumentNumber('EMP'),
          profile_id: phone ? profilesByPhone[phone] || null : null,
          position: pickField(row, 'Lavozim', 'Position', 'Должность') || null,
          salary: salaryRaw ? Number(salaryRaw.replace(/[^\d.]/g, '')) || 0 : 0,
          hired_at: hiredAt,
          is_active: true,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)

    if (newEmployees.length === 0) return { count: 0 }

    const { error } = await supabase.from('employees').insert(newEmployees)
    if (error) return { count: 0, error: error.message }
    await invalidateEmployees()
    return { count: newEmployees.length }
  }

  return (
    <ImportExportMenu
      data={exportRows}
      exportColumns={EXPORT_COLUMNS}
      templateColumns={TEMPLATE_COLUMNS}
      filenamePrefix="xodimlar"
      onImport={handleImport}
    />
  )
}
