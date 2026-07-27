import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface LowStockAlertProps {
  products: { id: string; name: string; sku: string; stock: number; min_stock: number }[]
  lang: string
}

export function LowStockAlert({ products, lang }: LowStockAlertProps) {
  const mockProducts = products.length > 0 ? products : [
    { id: '1', name: 'Laptop Dell XPS 13', sku: 'LAP-001', stock: 2, min_stock: 5 },
    { id: '2', name: 'Mouse Logitech MX', sku: 'MOU-003', stock: 0, min_stock: 10 },
    { id: '3', name: 'USB-C Hub 7-Port', sku: 'HUB-012', stock: 3, min_stock: 8 },
    { id: '4', name: 'Keyboard Mechanical', sku: 'KEY-007', stock: 1, min_stock: 5 },
    { id: '5', name: 'Monitor 27" 4K', sku: 'MON-004', stock: 2, min_stock: 3 },
  ]

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Kam zaxira
        </CardTitle>
        <Link
          href={`/${lang}/inventory/products`}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Barchasi →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockProducts.map((product) => {
            const pct = Math.min((product.stock / product.min_stock) * 100, 100)
            const isOut = product.stock === 0
            return (
              <Link
                key={product.id}
                href={`/${lang}/inventory/products/${product.id}`}
                className="block group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 transition-colors truncate max-w-[140px]">
                    {product.name}
                  </span>
                  <span
                    className={`text-xs font-bold ${isOut ? 'text-red-600' : 'text-orange-600'}`}
                  >
                    {product.stock} / {product.min_stock}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOut ? 'bg-red-500' : pct < 50 ? 'bg-orange-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
