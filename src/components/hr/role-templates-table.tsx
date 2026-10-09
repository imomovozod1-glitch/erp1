'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import { invalidateRoleTemplates } from '@/lib/data/revalidate'
import { Card, CardContent } from '@/components/ui/card'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'
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
  /** Only the current page's rows — the server applied search and paging. */
  roles: RoleTemplateRow[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

function countEnabledModules(permissions: Permissions | null): number {
  if (!permissions || typeof permissions !== 'object') return 0
  return Object.values(permissions).filter((p) => p?.view).length
}

export function RoleTemplatesTable({ roles, lang, page, pageSize, total, totalPages }: RoleTemplatesTableProps) {
  const tCommon = useTranslations('common')
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const t = useTranslations('hr')
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete({ name: roles.find((r) => r.id === id)?.name }))) return
    setIsDeleting(id)
    try {
      // Server route: deleting a role also has to clear `role_template_id` on
      // the profiles that pointed at it, and that column is no longer writable
      // by `authenticated`.
      const res = await fetch(`/api/tenant/roles/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || tCommon('error'))
      }
      toast.success(tCommon('success'))
      await invalidateRoleTemplates()
    } catch (error: any) {
      toast.error(error.message || tCommon('error'))
    } finally {
      setIsDeleting(null)
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex flex-wrap items-center gap-3">
            <TableSearch />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="w-10 text-center font-semibold text-slate-500 dark:text-slate-400">#</TableHead>
              <TableHead className="font-semibold">{t('roleName')}</TableHead>
              <TableHead>{t('roleModulesGranted')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role, index) => (
                <TableRow
                  key={role.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${lang}/hr/roles/${role.id}/edit`)}
                >
                  <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                    {(page - 1) * pageSize + index + 1}
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
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
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
        <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </CardContent>
      {confirmDialog}
    </Card>
  )
}
