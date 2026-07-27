'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Search, Package, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateProducts } from '@/lib/data/revalidate'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AIStockScannerModal } from '@/components/inventory/ai-stock-scanner-modal'
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

interface ProductsTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any[]
  lang: string
}

export function ProductsTable({ products, lang }: ProductsTableProps) {
  const t = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isScanModalOpen, setIsScanModalOpen] = useState(false)

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    setIsDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      toast.error(tCommon('error'))
    } else {
      toast.success(tCommon('success'))
      await invalidateProducts()
      router.refresh()
    }
    setIsDeleting(null)
  }

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${tCommon('search')}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsScanModalOpen(true)}
                variant="outline"
                size="sm"
                className="h-9 gap-2 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/70 hover:text-indigo-800 transition-colors font-medium text-xs rounded-lg"
              >
                <Sparkles className="h-4 w-4 text-indigo-600" />
                AI Rasmdan yuklash
              </Button>
              <span className="text-xs text-muted-foreground">
                {filtered.length} {tCommon('rows')}
              </span>
            </div>
          </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="font-semibold">{t('productName')}</TableHead>
              <TableHead>{t('sku')}</TableHead>
              <TableHead>{t('category')}</TableHead>
              <TableHead className="text-right">{t('costPrice')}</TableHead>
              <TableHead className="text-right">{t('price')}</TableHead>
              <TableHead className="text-right">{t('stock')}</TableHead>
              <TableHead>{tCommon('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{tCommon('noData')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((product) => (
                <TableRow key={product.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-800">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                      {product.sku}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {product.categories?.name ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium text-slate-600">
                      {formatCurrency(product.cost_price)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(product.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-sm font-semibold ${
                        product.stock === 0
                          ? 'text-red-600'
                          : product.stock <= product.min_stock
                          ? 'text-orange-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {product.stock} {product.unit}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={product.is_active ? 'default' : 'secondary'}
                      className={product.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}
                    >
                      {product.is_active ? tCommon('active') : tCommon('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          render={<Link href={`/${lang}/inventory/products/${product.id}/edit`} />}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          disabled={isDeleting === product.id}
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
      </CardContent>
    </Card>
    <AIStockScannerModal
      open={isScanModalOpen}
      onOpenChange={setIsScanModalOpen}
    />
    </>
  )
}

