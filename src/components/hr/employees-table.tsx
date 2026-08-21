'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Users, MoreHorizontal, Pencil } from 'lucide-react'
import React from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface EmployeesTableProps {
  employees: any[]
  lang: string
}

export function EmployeesTable({ employees, lang }: EmployeesTableProps) {
  const t = useTranslations('hr')
  const tCommon = useTranslations('common')
  const router = useRouter()
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'hired' | 'not_hired'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search, statusFilter])
  const filtered = employees.filter((e) => {
    const matchesSearch = (e.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                          e.position.toLowerCase().includes(search.toLowerCase()) ||
                          e.employee_code.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'hired' ? e.is_active : !e.is_active
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const startItem = filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, filtered.length);

  return (
    <TooltipProvider>
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
          <div className="flex bg-slate-100 p-0.5 rounded-lg border shadow-inner">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tCommon("all", { fallback: "Barchasi" })}
            </button>
            <button
              onClick={() => setStatusFilter('hired')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${statusFilter === 'hired' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {lang === 'uz' ? 'Ishlamoqda' : lang === 'ru' ? 'Работает' : 'Employed'}
            </button>
            <button
              onClick={() => setStatusFilter('not_hired')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${statusFilter === 'not_hired' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {lang === 'uz' ? "Bo'shatilgan" : lang === 'ru' ? 'Уволен' : 'Terminated'}
            </button>
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
              <TableHead>{t('employeeCode')}</TableHead>
              <TableHead>{t('position')}</TableHead>
              <TableHead className="text-right">{t('salary')}</TableHead>
              <TableHead>{t('hiredAt')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12.5"></TableHead>
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
              paginated.map((emp, index) => (
                <React.Fragment key={emp.id}>
                  <TableRow 
                    key={emp.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/${lang}/hr/employees/${emp.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500 text-xs">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                            {emp.full_name?.[0] ?? 'E'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-slate-800">
                            <Link
                              href={`/${lang}/hr/employees/${emp.id}`}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-colors"
                            >
                              {emp.full_name ?? '—'}
                            </Link>
                          </p>
                          <p className="text-xs text-muted-foreground">{emp.profiles?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{emp.employee_code}</code>
                    </TableCell>
                    <TableCell className="text-sm">{emp.position || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(emp.salary)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(emp.hired_at)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={emp.is_active ? 'emerald' : 'rose'}
                        pulse={emp.is_active}
                        label={emp.is_active
                          ? (lang === 'uz' ? 'Ishlamoqda' : lang === 'ru' ? 'Работает' : 'Employed')
                          : (lang === 'uz' ? "Bo'shatilgan" : lang === 'ru' ? 'Уволен' : 'Terminated')}
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
                          <DropdownMenuItem onClick={() => router.push(`/${lang}/hr/employees/${emp.id}/edit`)}>
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
            <span className="text-xs text-muted-foreground font-medium">
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
