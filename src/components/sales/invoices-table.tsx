'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, FileText, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const STATUS_TONES: Record<string, StatusTone> = {
  draft: 'slate',
  sent: 'blue',
  paid: 'emerald',
  overdue: 'rose',
  cancelled: 'slate',
}

interface InvoicesTableProps {
  /** Only the current page's rows — the server applied search and paging. */
  invoices: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function InvoicesTable({
  invoices,
  lang,
  page,
  pageSize,
  total,
  totalPages,
}: InvoicesTableProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('sales')
  const router = useRouter()



  // No client-side filtering or slicing: `invoices` IS the current page.
  const paginated = invoices

  return (
    <>
      <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <TableSearch />
          <span className="text-xs text-muted-foreground">{total} {tCommon('rows')}</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                <TableHead className="w-10 text-center font-semibold text-slate-500 dark:text-slate-400">#</TableHead>
                <TableHead className="w-45">{t('invoiceNumber')}</TableHead>
                <TableHead>{t('customer')}</TableHead>
                <TableHead className="text-right tabular-nums">{tCommon('total')}</TableHead>
                <TableHead className="hidden md:table-cell text-right tabular-nums">{t('status.paid')}</TableHead>
                <TableHead className="hidden md:table-cell text-right">{tCommon('date')}</TableHead>
                <TableHead>{tCommon('status')}</TableHead>
                <TableHead className="hidden lg:table-cell">{tCommon('assignedTo')}</TableHead>
                <TableHead className="hidden xl:table-cell">{tCommon('createdBy')}</TableHead>
                <TableHead className="w-17.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    {tCommon('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((invoice, index) => (
                  <TableRow 
                    key={invoice.id} 
                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/${lang}/sales/invoices/${invoice.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                      {(page - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {invoice.invoice_number}
                          </div>
                          {invoice.sales_orders?.order_number && (
                            <div className="text-xs text-muted-foreground">
                              Ord: {invoice.sales_orders.order_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{invoice.customers?.name || '-'}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(invoice.total_amount)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-muted-foreground tabular-nums">
                      {formatCurrency(invoice.paid_amount)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                      {formatDateTime(invoice.created_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge tone={STATUS_TONES[invoice.status] ?? 'slate'} label={t(`status.${invoice.status}`)} />
                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.customer_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/${lang}/finance/cashbox?action=kirim&type=debt_collection&customerId=${invoice.customer_id}`)}
                            className="h-7 border-violet-200 dark:border-violet-900/50 text-violet-700 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/30 hover:bg-violet-100/70 dark:hover:bg-violet-950/50 hover:text-violet-800 dark:hover:text-violet-300 font-medium text-[10px] rounded-md transition-all px-2 mt-1"
                          >
                            To&apos;lov qilish
                          </Button>
                        )}
                      </div>
                    </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {invoice.assignee?.full_name || tCommon('unassigned')}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        {invoice.creator?.full_name || '—'}
                      </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => router.push(`/${lang}/sales/invoices/${invoice.id}/edit`)}>
                            <Pencil className="h-4 w-4 mr-2 text-slate-500" />
                            {tCommon('edit')}
                          </DropdownMenuItem>
                          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/${lang}/finance/cashbox?action=kirim&type=debt_collection&customerId=${invoice.customer_id}`)}
                              className="text-violet-600 focus:text-violet-700 font-medium"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              To&apos;lov qilish (Kassa orqali)
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
          </TableBody>
        </Table>
      </div>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </CardContent>
    </Card>
    </>
  )
}
