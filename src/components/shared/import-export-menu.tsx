'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportRowsToExcel, downloadExcelTemplate, readExcelFile, type ExcelColumn } from '@/lib/excel-io'

interface ImportExportMenuProps {
  /** Rows to export as-is (server already fetched these for the page). */
  data: Record<string, any>[]
  /** Header + key mapping used for the "Export" button. */
  exportColumns: ExcelColumn[]
  /** Header + sample mapping used for the "Download template" button — usually the import-expected headers. */
  templateColumns: ExcelColumn[]
  /** Base filename (without extension/language) for both export and template files. */
  filenamePrefix: string
  /** Receives the raw parsed rows from the uploaded file; returns how many were actually imported. */
  onImport: (rows: Record<string, any>[]) => Promise<{ count: number; error?: string }>
}

export function ImportExportMenu({ data, exportColumns, templateColumns, filenamePrefix, onImport }: ImportExportMenuProps) {
  const t = useTranslations('common')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = () => {
    exportRowsToExcel(data, exportColumns, `${filenamePrefix}.xlsx`)
  }

  const handleDownloadTemplate = () => {
    downloadExcelTemplate(templateColumns, `${filenamePrefix}_shablon.xlsx`)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setIsImporting(true)
    const loadingToast = toast.loading(t('importing'))
    try {
      const rows = await readExcelFile(file)
      if (rows.length === 0) {
        toast.error(t('importFileEmpty'), { id: loadingToast })
        return
      }

      const result = await onImport(rows)
      if (result.error) {
        toast.error(result.error, { id: loadingToast })
      } else if (result.count === 0) {
        toast.error(t('importNoValidRows'), { id: loadingToast })
      } else {
        toast.success(t('importSuccess', { count: result.count }), { id: loadingToast })
        router.refresh()
      }
    } catch {
      toast.error(t('importReadError'), { id: loadingToast })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={data.length === 0}
        className="h-7 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-xl"
      >
        <Download className="h-3.5 w-3.5" />
        {t('export')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isImporting}
              className="h-7 gap-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/70 hover:text-emerald-800 text-xs font-medium rounded-xl"
            />
          }
        >
          <Upload className="h-3.5 w-3.5" />
          {t('import')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-white rounded-lg shadow-md border p-1">
          <DropdownMenuItem
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer flex items-center gap-2 text-slate-700 hover:bg-slate-50 focus:bg-slate-50 rounded"
          >
            <Upload className="h-4 w-4 text-slate-500" />
            {t('chooseFile')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDownloadTemplate}
            className="cursor-pointer flex items-center gap-2 text-emerald-700 hover:bg-emerald-50 focus:bg-emerald-50 focus:text-emerald-800 rounded font-medium"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            {t('downloadTemplate')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
