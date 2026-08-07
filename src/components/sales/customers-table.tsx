'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Search, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateCustomers } from '@/lib/data/revalidate'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'

interface CustomersTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any[]
  lang: string
}

export function CustomersTable({ customers, lang }: CustomersTableProps) {
  
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? '').includes(search)
  )

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
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead>{tCommon('email')}</TableHead>
              <TableHead>{tCommon('phone')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-slate-50/50">
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
                  <TableCell>
                    <Badge
                      variant={customer.is_active ? 'default' : 'secondary'}
                      className={customer.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}
                    >
                      {customer.is_active ? tCommon('active') : tCommon('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${lang}/sales/customers/${customer.id}/edit`)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                        </DropdownMenuItem>
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
      </CardContent>
    </Card>
  )
}
