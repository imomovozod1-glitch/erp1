'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Users, ChevronDown, ChevronUp } from 'lucide-react'
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
import { formatCurrency, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import React from 'react'

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
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const filtered = employees.filter((e) => {
    const matchesSearch = (e.profiles?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                          e.position.toLowerCase().includes(search.toLowerCase()) ||
                          e.employee_code.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'hired' ? e.is_active : !e.is_active
    return matchesSearch && matchesStatus
  })

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
              {lang === 'uz' ? 'Ishdan bo\'shatilgan' : lang === 'ru' ? 'Уволен' : 'Terminated'}
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} {tCommon('rows')}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-10 font-semibold text-center">#</TableHead>
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead>{t('employeeCode')}</TableHead>
              <TableHead>{t('position')}</TableHead>
              <TableHead>{t('department')}</TableHead>
              <TableHead className="text-right">{t('salary')}</TableHead>
              <TableHead>{t('hiredAt')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12.5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((emp, index) => (
                <React.Fragment key={emp.id}>
                  <TableRow 
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedRow === emp.id ? 'bg-slate-50/80' : ''}`}
                    onClick={() => setExpandedRow(expandedRow === emp.id ? null : emp.id)}
                  >
                    <TableCell className="text-center font-medium text-slate-500 text-xs">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {expandedRow === emp.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                            {emp.profiles?.full_name?.[0] ?? 'E'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-800">{emp.profiles?.full_name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{emp.profiles?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{emp.employee_code}</code>
                    </TableCell>
                    <TableCell className="text-sm">{emp.position}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.profiles?.departments?.name ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(emp.salary)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(emp.hired_at)}</TableCell>
                    <TableCell>
                      {emp.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {lang === 'uz' ? 'Ishlamoqda' : lang === 'ru' ? 'Работает' : 'Employed'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {lang === 'uz' ? 'Bo\'shatilgan' : lang === 'ru' ? 'Уволен' : 'Terminated'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/${lang}/hr/employees/${emp.id}/edit`)}>
                            {tCommon('edit')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedRow === emp.id && (
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableCell colSpan={9} className="p-0 border-b-2 border-indigo-100">
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-800">{tCommon('name')}</h4>
                            <p className="text-sm text-slate-600">{emp.profiles?.full_name ?? '—'}</p>
                            
                            <h4 className="text-sm font-semibold text-slate-800 mt-4">{t('employeeCode')}</h4>
                            <p className="text-sm text-slate-600 font-mono bg-white inline-block px-2 py-1 rounded border">{emp.employee_code}</p>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-800">{t('position')}</h4>
                            <p className="text-sm text-slate-600">{emp.position}</p>
                            
                            <h4 className="text-sm font-semibold text-slate-800 mt-4">{t('department')}</h4>
                            <p className="text-sm text-slate-600">{emp.profiles?.departments?.name ?? '—'}</p>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-800">{t('hiredAt')}</h4>
                            <p className="text-sm text-slate-600">{formatDate(emp.hired_at)}</p>

                            {!emp.is_active && emp.terminated_at && (
                              <>
                                <h4 className="text-sm font-semibold text-rose-800 mt-4">
                                  {t('terminatedAt')}
                                </h4>
                                <p className="text-sm text-rose-600">{formatDate(emp.terminated_at)}</p>
                              </>
                            )}
                          </div>
                          
                          {emp.notes && (
                            <div className="col-span-1 md:col-span-3 mt-2 pt-4 border-t border-slate-200">
                              <h4 className="text-sm font-semibold text-slate-800 mb-1">{tCommon('description')}</h4>
                              <p className="text-sm text-slate-600">{emp.notes}</p>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
