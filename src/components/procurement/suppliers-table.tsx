'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MoreHorizontal, Pencil, Search, Truck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface SuppliersTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suppliers: any[]
  lang: string
}

export function SuppliersTable({ suppliers, lang }: SuppliersTableProps) {
  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? '').toLowerCase().includes(search.toLowerCase())
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
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead>{tCommon('email')}</TableHead>
              <TableHead>{tCommon('phone')}</TableHead>
              <TableHead>{t('contactPerson')}</TableHead>
              <TableHead>{t('tin')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Truck className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((supplier) => (
                <TableRow key={supplier.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.email ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.phone ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.contact_person ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.tin ?? '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={supplier.is_active ? 'default' : 'secondary'}
                      className={supplier.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}
                    >
                      {supplier.is_active ? tCommon('active') : tCommon('inactive')}
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
                        <DropdownMenuItem onClick={() => router.push(`/${lang}/procurement/suppliers/${supplier.id}/edit`)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
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
