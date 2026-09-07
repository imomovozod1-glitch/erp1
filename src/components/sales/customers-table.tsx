'use client'

import { useState } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Users, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import dynamic from 'next/dynamic'

// react-leaflet/leaflet touch `window` at module-evaluation time, not just
// render time — a static import here crashes this page's SSR entirely
// (ReferenceError: window is not defined). Matches the existing ssr:false
// pattern already used for MapPicker in supplier-form.tsx/sale-form.tsx.
const LocationMapDialog = dynamic(
  () => import('@/components/shared/location-map-dialog').then((mod) => mod.LocationMapDialog),
  { ssr: false }
)
import { formatCurrency } from '@/lib/utils'

interface CustomersTableProps {
  /** Only the current page's rows — the server applied search and paging. */
  customers: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function CustomersTable({
  customers,
  lang,
  page,
  pageSize,
  total,
  totalPages,
}: CustomersTableProps) {
  
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [mapCustomer, setMapCustomer] = useState<{ name: string; address: string; latitude?: number | null; longitude?: number | null } | null>(null)



  // No client-side filtering or slicing: `customers` IS the current page.
  const paginated = customers

  const handleDelete = async (id: string) => {
    setIsDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') {
        toast.error(lang === 'uz' ? 'Mijozning qarzi yoki tranzaksiyalari borligi sababli o\'chirib bo\'lmaydi' : 'Cannot delete customer with existing records (debt/transactions)')
      } else {
        toast.error(tCommon('error'))
      }
    } else {
      toast.success(tCommon('success'))
      await invalidateCustomers()
      router.refresh()
    }
    setIsDeleting(null)
  }


  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between p-4 border-b">
            <TableSearch />
          </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500 dark:text-slate-400">#</TableHead>
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead className="hidden md:table-cell">{tCommon('email')}</TableHead>
              <TableHead>{tCommon('phone')}</TableHead>
              <TableHead className="hidden md:table-cell">{lang === 'uz' ? 'Toifa' : lang === 'ru' ? 'Категория' : 'Category'}</TableHead>
              <TableHead className="text-right tabular-nums">{lang === 'uz' ? "Balans qoldig'i" : lang === 'ru' ? 'Остаток баланса' : 'Balance'}</TableHead>
                <TableHead className="hidden lg:table-cell">{tCommon('assignedTo')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((customer, index) => (
                <TableRow 
                  key={customer.id} 
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${lang}/customers/${customer.id}`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                    {(page - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 text-xs">
                          {customer.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{customer.email ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.phone ?? '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{customer.customer_categories?.name ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(() => {
                      const balance = (Number(customer.credit_balance) || 0) - (Number(customer.total_debt) || 0)
                      if (balance === 0) return <span className="text-muted-foreground">—</span>
                      return (
                        <span className={`font-semibold ${balance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {balance > 0 ? '+' : '-'}{formatCurrency(Math.abs(balance))}
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={customer.is_active ? 'emerald' : 'slate'}
                      label={customer.is_active ? tCommon('active') : tCommon('inactive')}
                    />
                  </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {customer.assignee?.full_name || tCommon('unassigned')}
                      </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            }
                          />
                          <TooltipContent side="left">
                            <p>{lang === 'uz' ? 'Harakatlar' : lang === 'ru' ? 'Действия' : 'Actions'}</p>
                          </TooltipContent>
                        </Tooltip>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${lang}/customers/${customer.id}/edit`)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                        </DropdownMenuItem>
                        {(customer.address || (customer.latitude && customer.longitude)) && (
                          <DropdownMenuItem onClick={() => setMapCustomer({ name: customer.name, address: customer.address, latitude: customer.latitude, longitude: customer.longitude })}>
                            <MapPin className="mr-2 h-3.5 w-3.5" />
                            {lang === 'uz' ? 'Xaritada ko\'rish' : lang === 'ru' ? 'Показать на карте' : 'View on map'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(customer.id)}
                          disabled={isDeleting === customer.id}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
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
    </Card>
    {mapCustomer && (
      <LocationMapDialog
        open={!!mapCustomer}
        onOpenChange={(open) => { if (!open) setMapCustomer(null) }}
        address={mapCustomer.address}
        latitude={mapCustomer.latitude}
        longitude={mapCustomer.longitude}
        title={mapCustomer.name}
        lang={lang}
      />
    )}
    </TooltipProvider>
  )
}
