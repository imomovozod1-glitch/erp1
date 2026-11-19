'use client'

import type { ReactNode } from 'react'
import { Download, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'

interface DetailBannerProps {
  leading: ReactNode
  title: string
  subtitle?: ReactNode
  active: boolean
  onExport: () => void
}

export function DetailBanner({ leading, title, subtitle, active, onExport }: DetailBannerProps) {
  const t = useTranslations('common')
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:rounded-xl md:p-5">
      <div className="flex min-w-0 items-center gap-3.5">
        {leading}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight break-words text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-xs break-all text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        <StatusBadge tone={active ? 'emerald' : 'slate'} label={t(active ? 'active' : 'inactive')} />
        <Button onClick={onExport} size="sm" className="gap-2 max-md:h-10">
          <Download className="size-4" />
          {t('export')}
        </Button>
      </div>
    </div>
  )
}

interface KpiTileProps {
  label: string
  value: string
  valueClassName?: string
  children?: ReactNode
}

export function KpiTile({ label, value, valueClassName, children }: KpiTileProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
        <h3 className={cn('text-xl font-extrabold tracking-tight break-words text-foreground tabular-nums md:text-2xl', valueClassName)}>
          {value}
        </h3>
        {children && <div className="mt-1 space-y-1 text-xs text-muted-foreground">{children}</div>}
      </CardContent>
    </Card>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">{children}</div>
}

export interface DetailTab {
  key: string
  icon: LucideIcon
  label: string
  content: ReactNode
}

export function DetailTabs({ tabs, className }: { tabs: DetailTab[]; className?: string }) {
  return (
    <Tabs defaultValue={tabs[0]?.key} className={cn('rounded-xl border bg-card shadow-sm', className)}>
      <TabsList variant="line" className="h-auto w-full justify-start overflow-x-auto border-b px-2 [scrollbar-width:none]">
        {tabs.map(({ key, icon: Icon, label }) => (
          <TabsTrigger key={key} value={key} className="flex-none px-4 py-3 font-semibold data-active:text-violet-600 dark:data-active:text-violet-400">
            <Icon className="size-4" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.key} value={tab.key}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export async function downloadWorkbook(fileName: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet.rows), sheet.name)
  XLSX.writeFile(workbook, fileName)
}
