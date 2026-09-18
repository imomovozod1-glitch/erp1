import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Layers, Plus, Factory } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface ProductBomsCardProps {
  boms: any[]
  productId: string
  lang: string
  canEdit: boolean
}

/**
 * The "Tarkib" card on a product's own page.
 *
 * A product that is made rather than bought carries its recipes here, so the
 * composition can be written from the thing it produces instead of only from
 * the Sanoat section. A product may have several (a summer and a winter
 * recipe), which is why this lists them rather than editing one inline — each
 * row opens the full composition editor.
 *
 * Rendered on the server: it is a list of links, with nothing to interact with.
 */
export async function ProductBomsCard({ boms, productId, lang, canEdit }: ProductBomsCardProps) {
  const [t, tCommon] = await Promise.all([getTranslations('production'), getTranslations('common')])

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('boms')}</h2>
          </div>
          {canEdit && (
            <Link
              href={`/${lang}/production/boms/new?product=${productId}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              {t('addBom')}
            </Link>
          )}
        </div>

        {boms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-muted-foreground">
            <Layers className="h-8 w-8 opacity-40" />
            <p className="text-sm">{tCommon('noData')}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {boms.map((bom) => {
              const output = Number(bom.output_quantity) || 0
              const componentsCost = (bom.items ?? []).reduce(
                (sum: number, item: any) =>
                  sum + (Number(item.component?.cost_price) || 0) * Number(item.quantity),
                0
              )
              const perUnit = output > 0 ? (componentsCost + (Number(bom.extra_cost) || 0)) / output : 0
              return (
                <li key={bom.id}>
                  <Link
                    href={`/${lang}/production/boms/${bom.id}/edit`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{bom.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('bomComponentsCount', { count: bom.items?.length ?? 0 })}
                        {output > 0 && ` · ${formatNumber(output)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="block text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {t('perUnitCost')} · {t('estimated')}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                          {formatCurrency(perUnit)}
                        </span>
                      </div>
                      {!bom.is_active && <StatusBadge tone="slate" label={tCommon('inactive')} />}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {canEdit && boms.length > 0 && (
          <div className="border-t p-4">
            <Link
              href={`/${lang}/production/orders/new`}
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <Factory className="h-4 w-4" />
              {t('addOrder')}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
