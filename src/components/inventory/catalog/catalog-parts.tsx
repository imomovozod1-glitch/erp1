'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Download, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableFilterChips, TablePagination, TableSearch } from '@/components/shared/table-pagination'
import { cn } from '@/lib/utils'
import type { CatalogItem, CatalogPage } from './catalog-types'

export function CatalogShell({ page, tools, children }: { page: CatalogPage; tools?: ReactNode; children: ReactNode }) {
  const t = useTranslations('common')
  const statuses = (['all', 'active', 'inactive'] as const).map((value) => ({ value, label: t(value) }))
  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm max-md:overflow-visible max-md:bg-transparent max-md:shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 max-md:border-0 max-md:px-0 max-md:pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <TableSearch />
              <TableFilterChips param="status" value={page.status} options={statuses} />
            </div>
            <div className="flex flex-wrap items-center gap-2">{tools}</div>
          </div>
          {children}
          <TablePagination page={page.page} totalPages={page.totalPages} total={page.total} pageSize={page.pageSize} />
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations('common')
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled} className="h-9 gap-2 text-xs max-md:w-9 max-md:px-0">
      <Download className="size-4" />
      <span className="max-md:sr-only">{t('export')}</span>
    </Button>
  )
}

export function EmptyCatalog({ icon: Icon }: { icon: LucideIcon }) {
  const t = useTranslations('common')
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
      <Icon className="size-8 opacity-40" />
      <p className="text-sm">{t('noData')}</p>
    </div>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  const t = useTranslations('common')
  return <StatusBadge tone={active ? 'emerald' : 'slate'} label={t(active ? 'active' : 'inactive')} />
}

export function SkuCode({ sku }: { sku: string }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{sku}</code>
}

export function CatalogThumb({ item, icon: Icon }: { item: CatalogItem; icon: LucideIcon }) {
  if (!item.image_url) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
    )
  }
  return (
    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border">
      <Image src={item.image_url} alt={item.name} fill sizes="36px" className="object-cover" />
    </span>
  )
}

export function NameCell({ item, href, leading }: { item: CatalogItem; href: string; leading?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {leading}
      <div className="min-w-0">
        <Link href={href} className="font-semibold text-foreground transition-colors hover:text-violet-600 dark:hover:text-violet-400">
          {item.name}
        </Link>
        {item.description && <p className="max-w-50 truncate text-xs text-muted-foreground">{item.description}</p>}
      </div>
    </div>
  )
}

export function MarginText({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn('font-semibold', margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
      {margin.toFixed(1)}%
    </span>
  )
}
