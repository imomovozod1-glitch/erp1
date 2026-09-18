'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Truck, PackageCheck, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateDelivery } from '@/lib/data/revalidate'
import { setDeliveryStatus, distributionErrorMessage } from '@/lib/distribution-actions'
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
import { formatCurrency, formatDate, isoDate } from '@/lib/utils'
import { DELIVERY_STATUS_TONES, orderStatusTone, type DeliveryStatus } from '@/lib/statuses'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { TableSearch, TablePagination, TableFilterChips } from '@/components/shared/table-pagination'

interface DeliveriesTableProps {
  /** Only the current page's rows — the server already applied search/filter/paging. */
  deliveries: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  status: 'all' | DeliveryStatus
  canEdit: boolean
}

export function DeliveriesTable({
  deliveries,
  lang,
  page,
  pageSize,
  total,
  totalPages,
  status,
  canEdit,
}: DeliveriesTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const [confirmAction, confirmDialog] = useConfirmDelete()
  const [busyId, setBusyId] = useState<string | null>(null)

  /**
   * Moving a delivery also moves the sale behind it, inside one database
   * function — so the toast says what actually happened to BOTH, rather than
   * leaving the user to go and check the orders list.
   */
  const move = async (delivery: any, next: DeliveryStatus) => {
    setBusyId(delivery.id)
    try {
      const result = await setDeliveryStatus(createClient(), delivery.id, next, isoDate())
      toast.success(t('distribution.statusChanged'), {
        description: result.order_status
          ? t('distribution.orderFollowed', { status: t(`sales.status.${result.order_status}`) })
          : delivery.order_id
            ? t('distribution.orderUnchanged')
            : undefined,
      })
      await invalidateDelivery()
    } catch (error) {
      toast.error(distributionErrorMessage(t, error, (e) => businessRpcErrorMessage(t, e)))
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (delivery: any) => {
    const confirmed = await confirmAction({
      title: t('distribution.cancelDelivery'),
      description: t('distribution.cancelDeliveryConfirm'),
      name: delivery.delivery_number,
    })
    if (!confirmed) return
    await move(delivery, 'cancelled')
  }

  const handleDelete = async (delivery: any) => {
    // A delivered parcel is the record that it arrived; it is cancelled, which
    // leaves the trail, never deleted.
    if (delivery.status === 'delivered') {
      toast.error(t('distribution.cannotDeleteDelivered'))
      return
    }
    if (!(await confirmAction({ name: delivery.delivery_number }))) return
    setBusyId(delivery.id)
    const supabase = createClient() as any
    const { error } = await supabase.from('deliveries').delete().eq('id', delivery.id)
    if (error) {
      toast.error(error.message || t('common.error'))
    } else {
      toast.success(t('common.success'))
      await invalidateDelivery()
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
                { value: 'pending', label: t('distribution.status_pending') },
                { value: 'in_transit', label: t('distribution.status_in_transit') },
                { value: 'delivered', label: t('distribution.status_delivered') },
                { value: 'cancelled', label: t('distribution.status_cancelled') },
              ]}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead className="w-10 text-center font-semibold">#</TableHead>
                <TableHead className="font-semibold">{t('distribution.deliveryNumber')}</TableHead>
                <TableHead>{t('distribution.customer')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('distribution.order')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('distribution.courier')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('distribution.plannedDate')}</TableHead>
                <TableHead className="hidden lg:table-cell text-right tabular-nums">{t('common.total')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Truck className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{t('common.noData')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                deliveries.map((delivery, index) => {
                  const detailHref = `/${lang}/distribution/deliveries/${delivery.id}`
                  const isPending = delivery.status === 'pending'
                  const isInTransit = delivery.status === 'in_transit'
                  const isOpen = isPending || isInTransit
                  return (
                    <TableRow
                      key={delivery.id}
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
                          {delivery.delivery_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{delivery.customer?.name ?? '—'}</p>
                          {delivery.address && (
                            <p className="max-w-50 truncate text-xs text-muted-foreground">{delivery.address}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {delivery.order ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{delivery.order.order_number}</span>
                            <StatusBadge
                              tone={orderStatusTone(delivery.order.status)}
                              label={t(`sales.status.${delivery.order.status}`)}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{t('distribution.noOrderLink')}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {delivery.agent?.full_name || t('common.unassigned')}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {delivery.planned_date ? formatDate(delivery.planned_date) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">
                        {delivery.order ? formatCurrency(Number(delivery.order.total_amount) || 0) : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={DELIVERY_STATUS_TONES[delivery.status as DeliveryStatus] ?? 'slate'}
                          label={t(`distribution.status_${delivery.status}`)}
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
                          <DropdownMenuContent align="end" className="w-52">
                            {canEdit && isPending && (
                              <DropdownMenuItem
                                onClick={() => move(delivery, 'in_transit')}
                                disabled={busyId === delivery.id}
                              >
                                <Truck className="mr-2 h-3.5 w-3.5" /> {t('distribution.markInTransit')}
                              </DropdownMenuItem>
                            )}
                            {canEdit && isInTransit && (
                              <DropdownMenuItem
                                onClick={() => move(delivery, 'delivered')}
                                disabled={busyId === delivery.id}
                              >
                                <PackageCheck className="mr-2 h-3.5 w-3.5" /> {t('distribution.markDelivered')}
                              </DropdownMenuItem>
                            )}
                            {canEdit && isOpen && (
                              <DropdownMenuItem
                                render={<Link href={`${detailHref}/edit`} prefetch={true} />}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" /> {t('common.edit')}
                              </DropdownMenuItem>
                            )}
                            {canEdit && isOpen && (
                              <DropdownMenuItem
                                onClick={() => handleCancel(delivery)}
                                disabled={busyId === delivery.id}
                              >
                                <Ban className="mr-2 h-3.5 w-3.5" /> {t('common.cancel')}
                              </DropdownMenuItem>
                            )}
                            {canEdit && delivery.status !== 'delivered' && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(delivery)}
                                disabled={busyId === delivery.id}
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
