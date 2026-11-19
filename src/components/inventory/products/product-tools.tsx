'use client'

import { useRef } from 'react'
import { Download, Sparkles, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCan } from '@/components/providers/permissions-provider'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ExportButton } from '../catalog/catalog-parts'
import type { CatalogItem } from '../catalog/catalog-types'
import { useProductExcel } from './use-product-excel'

const TOOL_CLASS = 'h-9 gap-2 text-xs max-md:w-9 max-md:px-0'

export function ProductTools({ products, onScan }: { products: CatalogItem[]; onScan: () => void }) {
  const t = useTranslations('inventory')
  const canExport = useCan('inventory', 'export', 'products')
  const canCreate = useCan('inventory', 'create', 'products')
  const excel = useProductExcel(products)

  return (
    <>
      {canExport && <ExportButton onClick={excel.exportProducts} disabled={!products.length} />}
      {canCreate && <ImportMenu onFile={excel.importFile} onTemplate={excel.downloadTemplate} />}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onScan}
              className={`${TOOL_CLASS} border-violet-200 bg-brand-subtle text-violet-700 hover:text-violet-800 dark:border-violet-900/50 dark:text-violet-300`}
            >
              <Sparkles className="size-4" />
              <span className="max-md:sr-only">{t('importAI')}</span>
            </Button>
          }
        />
        <TooltipContent>{t('aiScanner.tooltip')}</TooltipContent>
      </Tooltip>
    </>
  )
}

interface ImportMenuProps {
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  onTemplate: () => void
}

function ImportMenu({ onFile, onTemplate }: ImportMenuProps) {
  const t = useTranslations('inventory')
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={input} type="file" accept=".xlsx, .xls" onChange={onFile} className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${TOOL_CLASS} border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100/70 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400`}
            />
          }
        >
          <Upload className="size-4" />
          <span className="max-md:sr-only">{t('importExcel')}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-1">
          <DropdownMenuItem onClick={() => input.current?.click()} className="gap-2">
            <Upload className="size-4 text-muted-foreground" />
            {t('uploadExcelFile')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTemplate} className="gap-2 font-medium text-emerald-700 dark:text-emerald-400">
            <Download className="size-4" />
            {t('downloadTemplateAction')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
