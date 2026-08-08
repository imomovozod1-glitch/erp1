'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { MoreHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,  
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DepartmentsTableProps {
  departments: any[]
  lang: string
}

export function DepartmentsTable({ departments, lang }: DepartmentsTableProps) {
  const t = useTranslations('hr')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const totalPages = Math.ceil(departments.length / itemsPerPage)
  const paginated = departments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center font-semibold text-slate-500">#</TableHead>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('description')}</TableHead>
              <TableHead className="w-12.5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                  {tCommon('noData')}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((dept, index) => (
                <TableRow 
                  key={dept.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${lang}/hr/departments/${dept.id}/edit`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 text-xs">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell>{dept.description || '-'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${lang}/hr/departments/${dept.id}/edit`)}>
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
  )
}
