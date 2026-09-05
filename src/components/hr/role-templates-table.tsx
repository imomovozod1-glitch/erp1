'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Search, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateRoleTemplates } from '@/lib/data/revalidate'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import type { Permissions } from '@/lib/permissions'

interface RoleTemplateRow {
  id: string
  name: string
  permissions: Permissions | null
}

interface RoleTemplatesTableProps {
  roles: RoleTemplateRow[]
  lang: string
}

function countEnabledModules(permissions: Permissions | null): number {
  if (!permissions || typeof permissions !== 'object') return 0
  return Object.values(permissions).filter((p) => p?.view).length
}

export function RoleTemplatesTable({ roles, lang }: RoleTemplatesTableProps) {
  const t = useTranslations('hr')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [search])

  const filtered = roles.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleDelete = async (id: string) => {
    setIsDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('role_templates').delete().eq('id', id)
    if (error) {
      toast.error(tCommon('error'))
    } else {
      toast.success(tCommon('success'))
      await invalidateRoleTemplates()
      router.refresh()
    }
    setIsDeleting(null)
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${tCommon('search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} {tCommon('rows')}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500 dark:text-slate-400">#</TableHead>
              <TableHead className="font-semibold">{t('roleName')}</TableHead>
              <TableHead>{t('roleModulesGranted')}</TableHead>
              <TableHead className="w-12.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((role, index) => (
                <TableRow
                  key={role.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${lang}/hr/roles/${role.id}/edit`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{role.name}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {t('roleModulesCount', { count: countEnabledModules(role.permissions) })}
                    </span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          render={<Link href={`/${lang}/hr/roles/${role.id}/edit`} prefetch={true} />}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(role.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          disabled={isDeleting === role.id}
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
