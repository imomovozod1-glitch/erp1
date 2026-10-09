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
import { TableSearch, TablePagination, TableFilterSelect } from '@/components/shared/table-pagination'
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
  paid: 'all' | 'paid' | 'free'
}

export function EmployeesTable({
  employees,
  lang,
  page,
  pageSize,
  total,
  totalPages,
  status,
  paid,
}: EmployeesTableProps) {
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')
  const t = useTranslations('hr')
  const router = useRouter()
  
  // No client-side filtering or slicing: `employees` IS the current page.
  const paginated = employees

  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <TableSearch />
          <TableFilterSelect
            param="status"
            label={tCommon('status')}
            value={status}
            options={[
              { value: 'all', label: tCommon('all') },
              { value: 'hired', label: lang === 'uz' ? 'Ishlamoqda' : lang === 'ru' ? 'Работает' : 'Employed' },
              { value: 'not_hired', label: lang === 'uz' ? 'Ishlamaydi' : lang === 'ru' ? 'Не работает' : 'Not employed' },
            ]}
          />
          <TableFilterSelect
            param="paid"
            label={t('subscription')}
            value={paid}
            options={[
              { value: 'all', label: tCommon('all') },
              { value: 'paid', label: t('subscribed') },
              { value: 'free', label: t('notSubscribed') },
            ]}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 font-semibold text-center">#</TableHead>
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('phoneNumber')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('roles')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('employeeCode')}</TableHead>
              <TableHead>{t('position')}</TableHead>
              <TableHead className="hidden md:table-cell text-right">{t('salary')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('hiredAt')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead>{t('subscription')}</TableHead>
              <TableHead className="w-12.5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
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
                              className="text-slate-800 transition-colors hover:text-violet-600 dark:text-slate-200 dark:hover:text-violet-400"
                            >
                              {emp.full_name ?? '—'}
                            </Link>
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell whitespace-nowrap text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {emp.profiles?.phone || '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-700 dark:text-slate-300">
                      {/* What the login may do: its role template, or the bare role
                          for an account set up without one. No login, no rights. */}
                      {emp.profiles?.role_templates?.name
                        ?? (emp.profiles?.role ? tSettings(`role.${emp.profiles.role}`) : '—')}
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
                    <TableCell>
                      {/* `is_paid` is what gates a system login (see employee-form.tsx),
                          so whether a seat is subscribed has to be visible from the list,
                          not only inside the edit form. */}
                      <StatusBadge
                        tone={emp.is_paid ? 'indigo' : 'slate'}
                        label={emp.is_paid ? t('subscribed') : t('notSubscribed')}
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
