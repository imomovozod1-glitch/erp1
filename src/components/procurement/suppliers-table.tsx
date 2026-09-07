'use client'

import React, { useState, useEffect } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Truck, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableSearch, TablePagination } from '@/components/shared/table-pagination'
import dynamic from 'next/dynamic'

// react-leaflet/leaflet touch `window` at module-evaluation time, not just
// render time — a static import here crashes this page's SSR entirely
// (ReferenceError: window is not defined). Matches the existing ssr:false
// pattern already used for MapPicker in supplier-form.tsx/sale-form.tsx.
const LocationMapDialog = dynamic(
  () => import('@/components/shared/location-map-dialog').then((mod) => mod.LocationMapDialog),
  { ssr: false }
)
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

interface SuppliersTableProps {
  /** Only the current page's rows — the server applied search and paging. */
  suppliers: any[]
  lang: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function SuppliersTable({
  suppliers,
  lang,
  page,
  pageSize,
  total,
  totalPages,
}: SuppliersTableProps) {
  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [mapSupplier, setMapSupplier] = useState<{ name: string; address: string; latitude?: number | null; longitude?: number | null } | null>(null)


  // No client-side filtering or slicing: `suppliers` IS the current page.
  const paginated = suppliers


  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between p-4 border-b">
            <TableSearch />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead className="w-10 font-semibold text-center">#</TableHead>
                <TableHead>{tCommon('name')}</TableHead>
                <TableHead className="hidden md:table-cell">{tCommon('email')}</TableHead>
                <TableHead>{tCommon('phone')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('contactPerson')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('tin')}</TableHead>
                <TableHead className="text-right tabular-nums">{lang === 'uz' ? 'Qarzimiz' : lang === 'ru' ? 'Наш долг' : 'Debt owed'}</TableHead>
                <TableHead>{tCommon('status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Truck className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{tCommon('noData')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((supplier, index) => (
                  <React.Fragment key={supplier.id}>
                    <TableRow 
                      key={supplier.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                      onClick={() => router.push(`/${lang}/procurement/suppliers/${supplier.id}`)}
                    >
                      <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                        {(page - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/${lang}/procurement/suppliers/${supplier.id}`}
                            className="text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 hover:underline transition-colors font-semibold"
                          >
                            {supplier.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{supplier.email ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.phone ?? '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{supplier.contact_person ?? '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{supplier.tin ?? '—'}</TableCell>
                      <TableCell className={`text-right font-semibold ${(Number(supplier.total_debt) || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                        {(Number(supplier.total_debt) || 0) > 0 ? formatCurrency(supplier.total_debt) : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={supplier.is_active ? 'emerald' : 'slate'}
                          label={supplier.is_active ? tCommon('active') : tCommon('inactive')}
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
                            <DropdownMenuItem onClick={() => router.push(`/${lang}/procurement/suppliers/${supplier.id}/edit`)}>
                              <Pencil className="mr-2 h-3.5 w-3.5 text-slate-500" />
                              {tCommon('edit')}
                            </DropdownMenuItem>
                            {(supplier.address || (supplier.latitude && supplier.longitude)) && (
                              <DropdownMenuItem onClick={() => setMapSupplier({ name: supplier.name, address: supplier.address, latitude: supplier.latitude, longitude: supplier.longitude })}>
                                <MapPin className="mr-2 h-3.5 w-3.5 text-slate-500" />
                                {lang === 'uz' ? "Xaritada ko'rish" : lang === 'ru' ? 'Показать на карте' : 'View on map'}
                              </DropdownMenuItem>
                            )}
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
    {mapSupplier && (
      <LocationMapDialog
        open={!!mapSupplier}
        onOpenChange={(open) => { if (!open) setMapSupplier(null) }}
        address={mapSupplier.address}
        latitude={mapSupplier.latitude}
        longitude={mapSupplier.longitude}
        title={mapSupplier.name}
        lang={lang}
      />
    )}
    </TooltipProvider>
  )
}
