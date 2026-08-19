'use client'

import { useState, useEffect } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Search, Users, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { LocationMapDialog } from '@/components/shared/location-map-dialog'
import { formatCurrency } from '@/lib/utils'

interface CustomersTableProps {
  customers: any[]
  lang: string
}

export function CustomersTable({ customers, lang }: CustomersTableProps) {
  
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [mapCustomer, setMapCustomer] = useState<{ name: string; address: string; latitude?: number | null; longitude?: number | null } | null>(null)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? '').includes(search)
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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

  const startItem = filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, filtered.length);

  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${tCommon('search')}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {lang === 'uz' ? `${filtered.length} tadan ${startItem}-${endItem} ko'rsatilmoqda` : lang === 'ru' ? `Показано ${startItem}-${endItem} из ${filtered.length}` : `Showing ${startItem}-${endItem} of ${filtered.length}`}
            </span>
          </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500">#</TableHead>
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead>{tCommon('email')}</TableHead>
              <TableHead>{tCommon('phone')}</TableHead>
              <TableHead>{lang === 'uz' ? 'Toifa' : lang === 'ru' ? 'Категория' : 'Category'}</TableHead>
              <TableHead className="text-right">{lang === 'uz' ? "Balans qoldig'i" : lang === 'ru' ? 'Остаток баланса' : 'Balance'}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
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
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${lang}/customers/${customer.id}`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 text-xs">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                          {customer.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-slate-800">{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.email ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.phone ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.customer_categories?.name ?? '—'}</TableCell>
                  <TableCell className="text-right">
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="cursor-pointer"
            >
              {lang === 'uz' ? 'Orqaga' : lang === 'ru' ? 'Назад' : 'Previous'}
            </Button>
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="cursor-pointer"
            >
              {lang === 'uz' ? 'Oldinga' : lang === 'ru' ? 'Вперед' : 'Next'}
            </Button>
          </div>
        )}
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
