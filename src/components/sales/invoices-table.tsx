'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Search, MoreHorizontal, Pencil, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-500',
}

interface InvoicesTableProps {
  invoices: any[]
  lang: string
}

export function InvoicesTable({ invoices, lang }: InvoicesTableProps) {
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = invoices.filter(
    (i) =>
      i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (i.customers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${tCommon('search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} {tCommon('rows')}</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-45">Hisob-faktura (Invoice)</TableHead>
                <TableHead>Mijoz</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead className="text-right">Umumiy Summa</TableHead>
                <TableHead className="text-right">To&apos;langan</TableHead>
                <TableHead className="text-right">Berilgan Sana</TableHead>
                <TableHead className="w-17.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {tCommon('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((invoice) => (
                  <TableRow key={invoice.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
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
                      <div className="font-medium text-slate-900">{invoice.customers?.name || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[invoice.status]}`}>
                        {invoice.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total_amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(invoice.paid_amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(invoice.issued_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => router.push(`/${lang}/sales/invoices/${invoice.id}/edit`)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {tCommon('edit')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
