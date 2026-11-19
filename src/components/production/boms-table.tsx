'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Pencil, Power, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useCan } from '@/components/providers/permissions-provider'
import { useConfirmDelete } from '@/components/shared/confirm-dialog'
import { MobileThumb } from '@/components/shared/mobile-list'
import { PagedListCard, type PageInfo } from '@/components/shared/paged-list-card'
import { ResponsiveTable } from '@/components/shared/responsive-table'
import { RowActionsMenu } from '@/components/shared/row-actions-menu'
import { ActiveBadge, EmptyCatalog } from '@/components/inventory/catalog/catalog-parts'
import { createClient } from '@/lib/supabase/client'
import { invalidateBoms } from '@/lib/data/revalidate'
import { deleteOrArchive, setRowActive } from '@/lib/delete-or-archive'
import { errorMessage } from '@/lib/error-message'
import { formatNumber } from '@/lib/utils'

interface BomRow {
  id: string
  name: string
  is_active: boolean
  output_quantity: number
  product?: { name: string; unit: string } | null
  outputs?: { product_id: string }[]
  items?: { id: string }[] | null
}

interface BomsTableProps extends PageInfo {
  boms: BomRow[]
  lang: string
}

function useBomActions() {
  const t = useTranslations()
  const [confirmDelete, confirmDialog] = useConfirmDelete()
  const [busyId, setBusyId] = useState<string | null>(null)
  const run = async (bom: BomRow, action: () => Promise<string>) => {
    setBusyId(bom.id)
    try {
      toast.success(await action())
      await invalidateBoms()
    } catch (error) {
      toast.error(errorMessage(t, error, t('common.error')))
    } finally {
      setBusyId(null)
    }
  }
  const toggle = (bom: BomRow) =>
    run(bom, async () => {
      await setRowActive(createClient(), 'product_boms', bom.id, !bom.is_active)
      return t('common.success')
    })
  // A run still pointing at the composition (production_orders.bom_id) archives it instead.
  const remove = async (bom: BomRow) => {
    if (!(await confirmDelete({ name: bom.name }))) return
    await run(bom, async () => ((await deleteOrArchive(createClient(), 'product_boms', bom.id)) === 'archived' ? t('production.bomInUse') : t('common.success')))
  }
  return { busyId, toggle, remove, confirmDialog }
}

/** Tarkiblar: reusable templates, so each row says how many components it holds. */
export function BomsTable({ boms, lang, ...pageInfo }: BomsTableProps) {
  const t = useTranslations()
  const router = useRouter()
  const canEdit = useCan('production', 'edit', 'boms')
  const canDelete = useCan('production', 'delete', 'boms')
  const actions = useBomActions()
  const editHref = (bom: BomRow) => `/${lang}/production/boms/${bom.id}/edit`
  const more = (bom: BomRow) => ((bom.outputs?.length ?? 0) > 1 ? ` ${t('production.moreOutputs', { count: (bom.outputs?.length ?? 1) - 1 })}` : '')
  const output = (bom: BomRow) => `${formatNumber(Number(bom.output_quantity) || 0)} ${bom.product?.unit ?? ''}`
  const components = (bom: BomRow) => t('production.bomComponentsCount', { count: bom.items?.length ?? 0 })
  const menu = (bom: BomRow) => (
    <RowActionsMenu
      actions={[
        { key: 'edit', label: t('common.edit'), icon: Pencil, href: editHref(bom), hidden: !canEdit },
        { key: 'status', label: t(bom.is_active ? 'common.inactive' : 'common.active'), icon: Power, onClick: () => actions.toggle(bom), disabled: actions.busyId === bom.id, hidden: !canEdit },
        { key: 'delete', label: t('common.delete'), icon: Trash2, onClick: () => actions.remove(bom), disabled: actions.busyId === bom.id, destructive: true, hidden: !canDelete },
      ]}
    />
  )
  return (
    <>
      <PagedListCard pageInfo={pageInfo}>
        <ResponsiveTable
          rows={boms}
          rowKey={(bom) => bom.id}
          indexOffset={(pageInfo.page - 1) * pageInfo.pageSize}
          onRowClick={(bom) => router.push(editHref(bom))}
          empty={<EmptyCatalog icon={Layers} />}
          columns={[
            { key: 'name', header: t('production.bomName'), className: 'font-medium text-foreground', cell: (bom) => bom.name },
            { key: 'product', header: t('production.finishedProduct'), cell: (bom) => <>{bom.product?.name ?? '—'}<span className="text-xs text-muted-foreground">{more(bom)}</span></> },
            { key: 'output', header: t('production.outputQuantity'), align: 'right', className: 'tabular-nums', cell: output },
            { key: 'components', header: t('production.components'), className: 'text-sm text-muted-foreground', cell: components },
            { key: 'status', header: t('common.status'), cell: (bom) => <ActiveBadge active={bom.is_active} /> },
            { key: 'menu', header: '', className: 'w-12', isolated: true, cell: menu },
          ]}
          card={(bom) => ({
            leading: <MobileThumb fallback={<Layers />} />,
            eyebrow: <span className="truncate">{(bom.product?.name ?? '—') + more(bom)}</span>,
            title: bom.name,
            status: <ActiveBadge active={bom.is_active} />,
            menu: menu(bom),
            stats: [
              { label: t('production.outputQuantity'), value: output(bom), tone: 'brand' },
              { label: t('production.components'), value: components(bom) },
            ],
          })}
        />
      </PagedListCard>
      {actions.confirmDialog}
    </>
  )
}
