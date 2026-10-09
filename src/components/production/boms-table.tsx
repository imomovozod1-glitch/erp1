'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Power, Layers } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateBoms } from '@/lib/data/revalidate'
import { Card, CardContent } from '@/components/ui/card'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { formatNumber } from '@/lib/utils'

interface BomRow {
  id: string
  name: string
  is_active: boolean
  output_quantity: number
  product?: { name: string; unit: string } | null
  items?: { id: string }[] | null
}

interface BomsTableProps {
  /** Only the current page's rows — the server applied search and paging. */
  boms: BomRow[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Tarkiblar — the compositions list.
 *
 * Deliberately built like `role-templates-table.tsx` rather than like the
 * product or sales tables: a composition is a reusable TEMPLATE, the same kind
 * of thing a role template is — each row says the one thing that matters at a
 * glance, how many components it holds, the way a role says how many modules
 * it grants. Paged and searched on the server (`getBomsPage`): `boms` is only
 * the page being shown.
 */
export function BomsTable({ boms, lang, page, pageSize, total, totalPages }: BomsTableProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('production')
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null)

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setIsUpdatingStatus(id)
    const supabase = createClient() as any
    const { error } = await supabase.from('product_boms').update({ is_active: !currentStatus }).eq('id', id)
    if (error) {
      toast.error(error.message || tCommon('error'))
    } else {
      toast.success(tCommon('success'))
      await invalidateBoms()
    }
    setIsUpdatingStatus(null)
  }

  const handleDelete = async (id: string) => {
    const bom = boms.find((b) => b.id === id)
    if (!(await confirmDelete({ name: bom?.name }))) return

    setIsDeleting(id)
    const supabase = createClient() as any
    const { error } = await supabase.from('product_boms').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') {
        // A production run still points at it (production_orders.bom_id), so
        // the recipe is archived rather than removed.
        const { error: updateError } = await supabase
          .from('product_boms')
          .update({ is_active: false })
          .eq('id', id)
        if (updateError) {
          toast.error(tCommon('error'))
        } else {
          toast.success(t('bomInUse'))
          await invalidateBoms()
        }
      } else {
        toast.error(error.message || tCommon('error'))
      }
    } else {
      toast.success(tCommon('success'))
      await invalidateBoms()
    }
    setIsDeleting(null)
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex flex-wrap items-center gap-3">
            <TableSearch />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500 dark:text-slate-400">#</TableHead>
              <TableHead className="font-semibold">{t('bomName')}</TableHead>
              <TableHead>{t('finishedProduct')}</TableHead>
              <TableHead className="hidden md:table-cell text-right tabular-nums">{t('outputQuantity')}</TableHead>
              <TableHead>{t('components')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {boms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Layers className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              boms.map((bom, index) => (
                <TableRow
                  key={bom.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${lang}/production/boms/${bom.id}/edit`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                    {(page - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{bom.name}</p>
                  </TableCell>
                  <TableCell>{bom.product?.name ?? '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">
                    {formatNumber(Number(bom.output_quantity) || 0)} {bom.product?.unit}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {t('bomComponentsCount', { count: bom.items?.length ?? 0 })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={bom.is_active ? 'emerald' : 'slate'}
                      label={bom.is_active ? tCommon('active') : tCommon('inactive')}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          render={<Link href={`/${lang}/production/boms/${bom.id}/edit`} prefetch={true} />}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(bom.id, bom.is_active)}
                          disabled={isUpdatingStatus === bom.id}
                        >
                          <Power className="mr-2 h-3.5 w-3.5" />{' '}
                          {bom.is_active ? tCommon('inactive') : tCommon('active')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(bom.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                          disabled={isDeleting === bom.id}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> {tCommon('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </CardContent>
      {confirmDialog}
    </Card>
  )
}
