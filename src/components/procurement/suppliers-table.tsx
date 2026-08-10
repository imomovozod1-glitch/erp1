'use client'

import React, { useState, useEffect } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Search, Truck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface SuppliersTableProps {
  suppliers: any[]
  lang: string
}

export function SuppliersTable({ suppliers, lang }: SuppliersTableProps) {
  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])
  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
                <TableHead className="w-10 font-semibold text-center">#</TableHead>
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
                paginated.map((supplier, index) => (
                  <React.Fragment key={supplier.id}>
                    <TableRow 
                      key={supplier.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => router.push(`/${lang}/procurement/suppliers/${supplier.id}`)}
                    >
                      <TableCell className="text-center font-medium text-slate-500 text-xs">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/${lang}/procurement/suppliers/${supplier.id}`}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-colors font-semibold"
                          >
                            {supplier.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{supplier.email ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.phone ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.contact_person ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.tin ?? '—'}</TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={supplier.is_active ? 'emerald' : 'slate'}
                          label={supplier.is_active ? tCommon('active') : tCommon('inactive')}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted">
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                              }
                            />
                            <TooltipContent side="left">
                              <p>{lang === 'uz' ? 'Harakatlar' : lang === 'ru' ? 'Действия' : 'Actions'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/${lang}/procurement/suppliers/${supplier.id}/edit`)}>
                              <Pencil className="mr-2 h-3.5 w-3.5 text-slate-500" />
                              {tCommon('edit')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                  </TableRow>
                </React.Fragment>
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
    </TooltipProvider>
  )
}
