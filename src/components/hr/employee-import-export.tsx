'use client'

import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { invalidateEmployees } from '@/lib/data/revalidate'
import { formatDate, generateDocumentNumber } from '@/lib/utils'
import { ImportExportMenu } from '@/components/shared/import-export-menu'
import { pickField, type ExcelColumn } from '@/lib/excel-io'
import { errorMessage } from '@/lib/error-message'

interface EmployeeImportExportProps {
  employees: any[]
  lang: string
}

export function EmployeeImportExport({ employees }: EmployeeImportExportProps) {
  const tRoot = useTranslations()
  const supabase = createClient() as any

  // Headers follow the UI language; the import below still accepts the
  // headers of every language, so a file exported in one reads back in another.
  const EXPORT_COLUMNS: ExcelColumn[] = [
    { header: tRoot('hr.employeeCode'), key: 'employee_code' },
    { header: tRoot('hr.excel.fullName'), key: 'fullName' },
    { header: tRoot('hr.excel.phone'), key: 'phone' },
    { header: tRoot('hr.position'), key: 'position' },
    { header: tRoot('hr.excel.salary'), key: 'salary' },
    { header: tRoot('hr.excel.hiredAt'), key: 'hiredAtLabel' },
    { header: tRoot('common.status'), key: 'statusLabel' },
  ]

  const TEMPLATE_COLUMNS: ExcelColumn[] = [
    { header: tRoot('hr.employeeCode'), key: 'employee_code', sample: 'EMP-1001' },
    { header: tRoot('hr.excel.fullName'), key: 'fullName', sample: '' },
    { header: tRoot('hr.excel.phoneTemplate'), key: 'phone', sample: '+998901234567' },
    { header: tRoot('hr.position'), key: 'position', sample: 'Sotuvchi' },
    { header: tRoot('hr.excel.salary'), key: 'salary', sample: 3000000 },
    { header: tRoot('hr.excel.hiredAtTemplate'), key: 'hiredAtLabel', sample: '2026-01-15' },
  ]

  const activeLabel = tRoot('hr.statusEmployed')
  const inactiveLabel = tRoot('hr.statusTerminated')

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
      digits(pickField(
        row,
        tRoot('hr.excel.phoneTemplate'),
        "Telefon raqami (ixtiyoriy, mavjud foydalanuvchi bilan bog'lash uchun)",
        'Телефон (необязательно, для привязки к существующему пользователю)',
        'Phone (optional, to link an existing user)',
        tRoot('hr.excel.phone'),
        'Telefon raqami', 'Phone', 'Телефон'
      ))

    let profilesByPhone: Record<string, string> = {}
    if (rows.some((row) => readPhone(row))) {
      const { data: profiles } = await supabase.from('profiles').select('id, phone')
      profilesByPhone = Object.fromEntries(
        (profiles || []).filter((p: any) => digits(p.phone)).map((p: any) => [digits(p.phone), p.id])
      )
    }

    const newEmployees = rows
      .map((row) => {
        const employeeCode = pickField(row, tRoot('hr.employeeCode'), 'Xodim kodi', 'Employee Code', 'Код сотрудника')
        const hiredAt = pickField(
          row,
          tRoot('hr.excel.hiredAtTemplate'), tRoot('hr.excel.hiredAt'),
          'Ishga qabul qilingan sana (YYYY-MM-DD)', 'Дата приёма (YYYY-MM-DD)', 'Hired At (YYYY-MM-DD)',
          'Ishga qabul qilingan sana', 'Hired At', 'Дата приёма'
        )
        if (!hiredAt) return null
        const phone = readPhone(row)
        const salaryRaw = pickField(row, tRoot('hr.excel.salary'), 'Oylik maosh', 'Salary', 'Зарплата')
        return {
          // Optional, as in the form: a blank one is generated.
          employee_code: employeeCode || generateDocumentNumber('EMP'),
          profile_id: phone ? profilesByPhone[phone] || null : null,
          position: pickField(row, tRoot('hr.position'), 'Lavozim', 'Position', 'Должность') || null,
          salary: salaryRaw ? Number(salaryRaw.replace(/[^\d.]/g, '')) || 0 : 0,
          hired_at: hiredAt,
          is_active: true,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)

    if (newEmployees.length === 0) return { count: 0 }

    const { error } = await supabase.from('employees').insert(newEmployees)
    if (error) return { count: 0, error: errorMessage(tRoot, error, tRoot('common.error')) }
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
