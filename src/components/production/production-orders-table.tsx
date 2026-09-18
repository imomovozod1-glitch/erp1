'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Factory, Ban, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateProduction } from '@/lib/data/revalidate'
import { cancelProductionOrder, productionErrorMessage } from '@/lib/production-actions'
import { businessRpcErrorMessage } from '@/lib/business-rpc'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { TableSearch, TablePagination, TableFilterChips } from '@/components/shared/table-pagination'

const STATUS_TONE = {
  draft: 'amber',
  completed: 'emerald',
  cancelled: 'rose',
} as const

interface ProductionOrdersTableProps {
  /** Only the current page's rows — the server already applied search/filter/paging. */
  orders: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  status: 'all' | 'draft' | 'completed' | 'cancelled'
}

export function ProductionOrdersTable({
  orders,
  lang,
  page,
  pageSize,
  total,
  totalPages,
  status,
}: ProductionOrdersTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const [confirmAction, confirmDialog] = useConfirmDelete()
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleCancel = async (order: any) => {
    const confirmed = await confirmAction({
      title: t('production.cancelTitle'),
      description: order.status === 'completed' ? t('production.cancelConfirm') : undefined,
      name: order.order_number,
    })
    if (!confirmed) return
    setBusyId(order.id)
    try {
      await cancelProductionOrder(createClient(), order.id)
      toast.success(t('production.cancelled'))
      await invalidateProduction()
    } catch (error) {
      toast.error(productionErrorMessage(t, error, (e) => businessRpcErrorMessage(t, e)))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (order: any) => {
    // A finished run is the paperwork behind stock movements and cost layers:
    // it is cancelled (which reverses them), never deleted.
    if (order.status === 'completed') {
      toast.error(t('production.cannotDeleteCompleted'))
      return
    }
    if (!(await confirmAction({ name: order.order_number }))) return
    setBusyId(order.id)
    const supabase = createClient() as any
    const { error } = await supabase.from('production_orders').delete().eq('id', order.id)
    if (error) {
      toast.error(error.message || t('common.error'))
    } else {
      toast.success(t('common.success'))
      await invalidateProduction()
    }
    setBusyId(null)
  }

  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <TableSearch />
            <TableFilterChips
              param="status"
              value={status}
              options={[
                { value: 'all', label: t('common.all') },
                { value: 'draft', label: t('production.status_draft') },
                { value: 'completed', label: t('production.status_completed') },
                { value: 'cancelled', label: t('production.status_cancelled') },
              ]}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead className="w-10 text-center font-semibold">#</TableHead>
                <TableHead className="font-semibold">{t('production.orderNumber')}</TableHead>
                <TableHead>{t('production.finishedProduct')}</TableHead>
                <TableHead className="text-right tabular-nums">{t('common.quantity')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('production.plannedDate')}</TableHead>
                <TableHead className="hidden lg:table-cell text-right tabular-nums">
                  {t('production.totalCost')}
                </TableHead>
                <TableHead className="hidden lg:table-cell text-right tabular-nums">
                  {t('production.unitCost')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">{t('common.assignedTo')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Factory className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{t('common.noData')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order, index) => {
                  const detailHref = `/${lang}/production/orders/${order.id}`
                  const isDraft = order.status === 'draft'
                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
                      onClick={() => router.push(detailHref)}
                    >
                      <TableCell className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                        {(page - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={detailHref}
                          className="font-semibold text-slate-800 transition-colors hover:text-violet-600 dark:text-slate-200 dark:hover:text-violet-400"
                        >
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>{order.product?.name ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(Number(order.quantity) || 0)} {order.product?.unit}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {order.planned_date ? formatDate(order.planned_date) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">
                        {order.status === 'completed' ? formatCurrency(Number(order.total_cost) || 0) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                        {order.status === 'completed' ? formatCurrency(Number(order.unit_cost) || 0) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {order.assignee?.full_name || t('common.unassigned')}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={STATUS_TONE[order.status as keyof typeof STATUS_TONE] ?? 'slate'}
                          label={t(`production.status_${order.status}`)}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <DropdownMenuTrigger
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                              }
                            />
                            <TooltipContent side="left">
                              <p>{t('common.actions')}</p>
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="w-44">
                            {isDraft && (
                              <DropdownMenuItem
                                render={<Link href={`/${lang}/production/orders/${order.id}/edit`} prefetch={true} />}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" /> {t('common.edit')}
                              </DropdownMenuItem>
                            )}
                            {/* Completing needs the shortage check and a
                                non-destructive confirmation, which live on the
                                run's own page — this only takes you there. */}
                            {isDraft && (
                              <DropdownMenuItem render={<Link href={detailHref} prefetch={true} />}>
                                <Play className="mr-2 h-3.5 w-3.5" /> {t('production.complete')}
                              </DropdownMenuItem>
                            )}
                            {order.status !== 'cancelled' && (
                              <DropdownMenuItem onClick={() => handleCancel(order)} disabled={busyId === order.id}>
                                <Ban className="mr-2 h-3.5 w-3.5" /> {t('common.cancel')}
                              </DropdownMenuItem>
                            )}
                            {order.status !== 'completed' && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(order)}
                                disabled={busyId === order.id}
                                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> {t('common.delete')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
        </CardContent>
      </Card>
      {confirmDialog}
    </TooltipProvider>
  )
}
