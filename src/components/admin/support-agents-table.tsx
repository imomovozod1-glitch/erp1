'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPhoneInput } from '@/lib/tenant-auth'

export interface SupportAgentRow {
  id: string
  full_name: string
  phone: string
  tenants: { id: string; company_name: string; subdomain: string }[]
}

const ITEMS_PER_PAGE = 10

export function SupportAgentsTable({ agents }: { agents: SupportAgentRow[] }) {
  const t = useTranslations('admin.support')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = agents.filter((agent) => {
    const q = search.toLowerCase()
    if (!q) return true
    return agent.full_name.toLowerCase().includes(q) || agent.phone.toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <div className="rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 dark:border-slate-800">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-9"
          />
        </div>
        <Button onClick={() => router.push('/admin/support/new')} className="gap-2 bg-violet-600 hover:bg-violet-500">
          <Plus className="h-4 w-4" /> {t('newAgent')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead>{t('colName')}</TableHead>
            <TableHead>{t('colPhone')}</TableHead>
            <TableHead>{t('colAssignedTenants')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center text-slate-400 dark:text-slate-500">
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((agent, index) => (
              <TableRow
                key={agent.id}
                className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors"
                onClick={() => router.push(`/admin/support/${agent.id}`)}
              >
                <TableCell className="text-center text-xs text-slate-500 dark:text-slate-400">
                  {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                </TableCell>
                <TableCell className="font-medium">{agent.full_name}</TableCell>
                <TableCell className="text-slate-500 dark:text-slate-400 tabular-nums">{formatPhoneInput(agent.phone)}</TableCell>
                <TableCell>
                  {agent.tenants.length === 0 ? (
                    <span className="text-slate-400 dark:text-slate-500 text-sm">{t('noneAssigned')}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {agent.tenants.map((tenant) => (
                        <Badge key={tenant.id} variant="outline" className="text-xs">
                          {tenant.company_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t p-4 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            {t('prev')}
          </Button>
          <span className="text-sm text-slate-500 dark:text-slate-400 px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  )
}
