'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Package, Plus, Scale, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { isService } from '@/lib/product-kind'

/**
 * Tiles mounted at a time. A catalogue of a few thousand products used to
 * mount a few thousand buttons (each with an <Image>) on every till load; the
 * cashier reaches anything past the first screenful by searching anyway.
 */
const TILE_BATCH = 120

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

  // How many tiles are mounted, reset to one batch whenever the search or the
  // category changes. Adjusted during render (React's "storing information
  // from previous renders" pattern, as TableSearch does) rather than in an
  // effect, which the React Compiler lint rules forbid.
  const filterKey = `${selectedCategory}\u0000${search}`
  const [tileLimit, setTileLimit] = useState({ key: filterKey, limit: TILE_BATCH })
  let visibleLimit = tileLimit.limit
  if (tileLimit.key !== filterKey) {
    visibleLimit = TILE_BATCH
    setTileLimit({ key: filterKey, limit: TILE_BATCH })
  }
  const visibleProducts = products.length > visibleLimit ? products.slice(0, visibleLimit) : products

  return (
    <div className="md:col-span-2 md:h-full md:flex md:flex-col md:min-h-0 space-y-5">
      <div className="shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* SKU & Title Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-600 dark:text-violet-300" />
            <Input
              ref={inputRef}
              placeholder={t('searchProduct')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSearchKeyDown}
              className="h-12 rounded-full border-border bg-card pl-11 text-sm shadow-sm"
            />
          </div>

        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none max-md:-mx-4 max-md:px-4">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            onClick={() => onCategoryChange('all')}
            className={`h-9 shrink-0 rounded-full px-4 text-xs font-semibold transition-colors duration-150 ${
              selectedCategory === 'all'
                ? 'bg-brand-gradient text-white shadow-brand hover:brightness-110'
                : 'border border-border bg-card text-foreground/80 hover:bg-violet-50 dark:hover:bg-violet-500/10'
            }`}
          >
            {tCommon('all')}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              onClick={() => onCategoryChange(cat.id)}
              className={`h-9 shrink-0 rounded-full px-4 text-xs font-semibold transition-colors duration-150 ${
                selectedCategory === cat.id
                  ? 'bg-brand-gradient text-white shadow-brand hover:brightness-110'
                  : 'border border-border bg-card text-foreground/80 hover:bg-violet-50 dark:hover:bg-violet-500/10'
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
          <Card className="rounded-2xl border border-border/60 bg-card py-20 text-center shadow-sm">
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
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((p) => {
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
                    className="group flex select-none flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition-all duration-150 hover:border-violet-300 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none dark:hover:border-violet-600"
                  >
                    {/* Photo band — square, with the stock on a pill over its corner and the
                        "+" that adds it (the app design's till). `object-contain`, not `cover`,
                        because a cashier has to recognise the whole product at a glance: photos
                        come in every aspect ratio and cropping cut portrait shots in half. An
                        out-of-stock photo is muted; the pill says it in words. */}
                    <div className="relative aspect-square w-full shrink-0 bg-violet-50/70 p-2 dark:bg-violet-500/10">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
                          className={`object-contain p-2 ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-violet-300 dark:text-violet-400/50">
                          <Package className="h-10 w-10" />
                        </div>
                      )}
                      <span
                        className={`absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur ${
                          isOutOfStock
                            ? 'bg-rose-100/90 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200'
                            : isLowStock
                            ? 'bg-amber-100/90 text-amber-700 dark:bg-amber-500/25 dark:text-amber-200'
                            : 'bg-white/85 text-foreground dark:bg-black/50 dark:text-white'
                        }`}
                      >
                        {service
                          ? tInventory('service')
                          : isOutOfStock
                          ? t('outOfStock')
                          : `${p.stock} ${p.unit || tCommon('pieces')}`}
                      </span>
                      {!isOutOfStock && (
                        <span className="absolute right-2.5 bottom-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand transition-transform group-hover:scale-110">
                          <Plus className="h-4 w-4" />
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-1 p-3 pt-2.5">
                      <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-foreground">{p.name}</p>
                      <p className="mt-auto text-sm font-extrabold tabular-nums text-violet-700 dark:text-violet-300">
                        {formatCurrency(p.price)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            {products.length > visibleLimit && (
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTileLimit({ key: filterKey, limit: visibleLimit + TILE_BATCH })}
                  className="h-10 rounded-xl border-slate-200 px-6 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  {t('showMore')} ({products.length - visibleLimit})
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
