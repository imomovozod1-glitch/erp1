'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MoreHorizontal, Pencil, Search, Truck, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface SuppliersTableProps {
  suppliers: any[]
  lang: string
}

export function SuppliersTable({ suppliers, lang }: SuppliersTableProps) {
  const t = useTranslations('procurement')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? '').toLowerCase().includes(search.toLowerCase())
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
              <TableHead className="w-10 font-semibold text-center">#</TableHead>
              <TableHead>{tCommon('name')}</TableHead>
              <TableHead>{tCommon('email')}</TableHead>
              <TableHead>{tCommon('phone')}</TableHead>
              <TableHead>{t('contactPerson')}</TableHead>
              <TableHead>{t('tin')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Truck className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((supplier, index) => (
                <React.Fragment key={supplier.id}>
                  <TableRow 
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedRow === supplier.id ? 'bg-slate-50/80' : ''}`}
                    onClick={() => setExpandedRow(expandedRow === supplier.id ? null : supplier.id)}
                  >
                    <TableCell className="text-center font-medium text-slate-500 text-xs">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        {expandedRow === supplier.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        {supplier.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{supplier.email ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.phone ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.contact_person ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{supplier.tin ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={supplier.is_active ? 'default' : 'secondary'}
                        className={supplier.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}
                      >
                        {supplier.is_active ? tCommon('active') : tCommon('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/${lang}/procurement/suppliers/${supplier.id}/edit`)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedRow === supplier.id && (
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableCell colSpan={8} className="p-0 border-b-2 border-indigo-100">
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-800">{tCommon('name')}</h4>
                            <p className="text-sm text-slate-600">{supplier.name}</p>
                            
                            <h4 className="text-sm font-semibold text-slate-800 mt-4">{t('tin', { fallback: 'INN' })}</h4>
                            <p className="text-sm text-slate-600 font-mono bg-white inline-block px-2 py-1 rounded border">{supplier.tin ?? '—'}</p>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-800">{tCommon('address')}</h4>
                            <p className="text-sm text-slate-600">{supplier.address ?? '—'}</p>
                            
                            <h4 className="text-sm font-semibold text-slate-800 mt-4">{tCommon('website', { fallback: 'Veb-sayt' })}</h4>
                            <p className="text-sm text-slate-600">
                              {supplier.website ? (
                                <a href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                  {supplier.website}
                                </a>
                              ) : '—'}
                            </p>
                          </div>
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
