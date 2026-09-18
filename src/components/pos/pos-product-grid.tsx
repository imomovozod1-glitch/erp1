'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Package, Scale, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { isService } from '@/lib/product-kind'

/**
 * The catalogue half of the till: search, category filter and the product
 * grid the cashier taps.
 *
 * Presentational — it holds no state of its own. The search text and the
 * selected category live in `pos-client.tsx` because the barcode-scanner
 * handler (Enter on an exact SKU) needs to clear the box after adding a line.
 */
export function PosProductGrid({
  products,
  categories,
  search,
  onSearchChange,
  onSearchKeyDown,
  selectedCategory,
  onCategoryChange,
  onSelect,
  inputRef,
}: {
  /** Already filtered by search and category. */
  products: any[]
  categories: any[]
  search: string
  onSearchChange: (value: string) => void
  /** Enter on an exact SKU match adds that product — the barcode path. */
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  selectedCategory: string
  onCategoryChange: (value: string) => void
  onSelect: (product: any) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const tCommon = useTranslations('common')
  const tInventory = useTranslations('inventory')
  // Declared last of the group so the editor's i18n plugin attributes the bare
  // `t(...)` calls in this file to `pos` — see AGENTS.md § Translations.
  const t = useTranslations('pos')

  return (
    <div className="md:col-span-2 md:h-full md:flex md:flex-col md:min-h-0 space-y-5">
      <div className="shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* SKU & Title Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              ref={inputRef}
              placeholder={t('searchProduct')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              className="h-12 rounded-xl border border-slate-200 bg-white pl-10 text-sm text-slate-800 shadow-sm transition-colors focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>

          {/* Category picker, narrow screens only — the scrolling pill row
              below is the same control, and shipping both at every width
              meant two widgets competing to set one piece of state. Pills
              win where they fit (one tap, all options visible); a select
              wins where they would be a long horizontal scroll. */}
          <Select value={selectedCategory} onValueChange={(val) => onCategoryChange(val || 'all')}>
            <SelectTrigger className="h-12 w-full rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 md:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <SelectValue placeholder={t('selectCategory')}>
                {selectedCategory === 'all'
                  ? t('selectCategory')
                  : categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-900">
              <SelectItem value="all" className="text-xs font-medium">{t('selectCategory')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category tabs */}
        <div className="hidden gap-2 overflow-x-auto pb-2 scrollbar-none md:flex">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            onClick={() => onCategoryChange('all')}
            className={`h-9 shrink-0 rounded-full border-0 px-4 text-xs font-semibold shadow-none transition-colors duration-150 ${
              selectedCategory === 'all'
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {t('selectCategory')}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              onClick={() => onCategoryChange(cat.id)}
              className={`h-9 shrink-0 rounded-full border-0 px-4 text-xs font-semibold shadow-none transition-colors duration-150 ${
                selectedCategory === cat.id
                  ? 'bg-violet-600 text-white hover:bg-violet-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Products Grid Wrapper — the only scrollable region on this page */}
      <div className="md:flex-1 md:overflow-y-auto md:min-h-0 pr-1 pb-4 scrollbar-thin">
        {products.length === 0 ? (
          <Card className="rounded-xl border border-slate-200 bg-white py-20 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="flex flex-col items-center gap-3">
              <Scale className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-400 dark:text-slate-500 font-semibold text-sm">{t('noProducts')}</p>
            </CardContent>
          </Card>
        ) : (
          /* Tighter, quieter tiles than before: the old card lifted on
             hover, scaled its photo, printed the price in violet and
             stamped a coloured pill on every single item — three accent
             colours per tile across a grid of forty. A till needs the
             photo, the name and the price to read instantly; stock is
             secondary text and only speaks up (in one colour) when it is
             actually running out. */
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              // A service has no shelf to be empty, so it is never out of
              // stock and never low — its tile says what it is instead of a
              // count that would always read zero.
              const service = isService(p)
              const isOutOfStock = !service && p.stock <= 0
              const isLowStock = !service && p.stock > 0 && p.stock <= p.min_stock
              // An out-of-stock tile stays legible rather than being faded
              // to 45%: the cashier still has to read the name and price of
              // the thing they cannot sell, and a wholly dimmed tile reads
              // as "broken" rather than "none left". Only the photo is
              // muted; the stock line says it in words.
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => onSelect(p)}
                  className="group flex select-none flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-colors duration-150 hover:border-violet-400 hover:bg-violet-50/40 focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/20 focus-visible:outline-none disabled:pointer-events-none disabled:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-600 dark:hover:bg-violet-950/20 dark:disabled:bg-slate-900"
                >
                  {/* Photo band — a 4:3 slot rather than a fixed 96px strip, so
                      the picture grows with the column instead of staying
                      thumbnail-sized on a wide till screen. An aspect ratio
                      still keeps every tile in a row exactly as tall as its
                      neighbours, image or no image.
                      `object-contain` (not `cover`) because a cashier has to
                      recognise the whole product at a glance: photos come in
                      every aspect ratio and cropping to fill the band cut the
                      top and bottom off portrait shots. */}
                  <div className="relative aspect-4/3 w-full shrink-0 bg-slate-50 p-1.5 dark:bg-slate-800/60">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        className={`object-contain ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                        <Package className="h-9 w-9" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="  text-[13px] font-medium leading-snug text-slate-800 dark:text-slate-200">
                      {p.name}
                    </p>
                    <p className="mt-auto text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(p.price)}
                    </p>
                    <p
                      className={
                        isOutOfStock || isLowStock
                          ? 'text-xs font-medium text-amber-600 tabular-nums dark:text-amber-400'
                          : 'text-xs text-slate-400 tabular-nums dark:text-slate-500'
                      }
                    >
                      {service
                        ? tInventory('service')
                        : isOutOfStock
                        ? t('outOfStock')
                        : `${p.stock} ${p.unit || tCommon('pieces')}`}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
