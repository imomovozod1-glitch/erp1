'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, Users } from 'lucide-react'
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

interface EmployeesTableProps {
  employees: any[]
  lang: string
}

export function EmployeesTable({ employees, lang }: EmployeesTableProps) {
  const t = useTranslations('hr')
  const tCommon = useTranslations('common')
  const router = useRouter()
  
  const [search, setSearch] = useState('')

  const filtered = employees.filter(
    (e) =>
      (e.profiles?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase())
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
              filtered.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
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
                    <Badge
                      variant={emp.is_active ? 'default' : 'secondary'}
                      className={emp.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}
                    >
                      {emp.is_active ? tCommon('active') : tCommon('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
