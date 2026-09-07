'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, MoreHorizontal, Pencil } from 'lucide-react'
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
import { TableSearch, TablePagination, TableFilterChips } from '@/components/shared/table-pagination'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface EmployeesTableProps {
  /** Only the current page's rows — the server applied search, filter and paging. */
  employees: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  status: 'all' | 'hired' | 'not_hired'
}

export function EmployeesTable({
  employees,
  lang,
  page,
  pageSize,
  total,
  totalPages,
  status,
}: EmployeesTableProps) {
  const t = useTranslations('hr')
  const tCommon = useTranslations('common')
  const router = useRouter()
  
  // No client-side filtering or slicing: `employees` IS the current page.
  const paginated = employees

  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
          <TableSearch />
          <TableFilterChips
            param="status"
            value={status}
            options={[
              { value: 'all', label: tCommon('all') },
              { value: 'hired', label: lang === 'uz' ? 'Ishlamoqda' : lang === 'ru' ? 'Работает' : 'Employed' },
              { value: 'not_hired', label: lang === 'uz' ? 'Ishlamaydi' : lang === 'ru' ? 'Не работает' : 'Not employed' },
            ]}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 font-semibold text-center">#</TableHead>
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('employeeCode')}</TableHead>
              <TableHead>{t('position')}</TableHead>
              <TableHead className="hidden md:table-cell text-right">{t('salary')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('hiredAt')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12.5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
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
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/${lang}/hr/employees/${emp.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                      {(page - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 text-xs">
                            {emp.full_name?.[0] ?? 'E'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            <Link
                              href={`/${lang}/hr/employees/${emp.id}`}
                              className="text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 hover:underline transition-colors"
                            >
                              {emp.full_name ?? '—'}
                            </Link>
                          </p>
                          <p className="text-xs text-muted-foreground">{emp.profiles?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">{emp.employee_code}</code>
                    </TableCell>
                    <TableCell className="text-sm">{emp.position || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-right font-semibold">{formatCurrency(emp.salary)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{formatDate(emp.hired_at)}</TableCell>
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
        <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </CardContent>
    </Card>
    </TooltipProvider>
  )
}
