'use client'

import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TablePagination, TableSearch } from '@/components/shared/table-pagination'

export interface PageInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface PagedListCardProps {
  pageInfo: PageInfo
  filters?: ReactNode
  tools?: ReactNode
  children: ReactNode
}

/** The list card every server-paginated screen uses: search + filters, tools, rows, pagination. */
export function PagedListCard({ pageInfo, filters, tools, children }: PagedListCardProps) {
  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm max-md:overflow-visible max-md:bg-transparent max-md:shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 max-md:border-0 max-md:px-0 max-md:pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <TableSearch />
              {filters}
            </div>
            <div className="flex flex-wrap items-center gap-2">{tools}</div>
          </div>
          {children}
          <TablePagination page={pageInfo.page} totalPages={pageInfo.totalPages} total={pageInfo.total} pageSize={pageInfo.pageSize} />
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
