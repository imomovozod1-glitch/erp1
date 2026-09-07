import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { getCachedTenant } from '@/lib/tenant'
import { escapeHtml, notifyTelegram } from '@/lib/integrations/telegram'
import { formatCurrency } from '@/lib/utils'

/**
 * Fires a Telegram notification for a business event.
 *
 * Called from client components right after a successful write (POS checkout,
 * a sale, a collected debt). It exists as a route rather than a direct call
 * because the bot token must stay server-side — a browser calling
 * api.telegram.org directly would have to hold the secret.
 *
 * Open to any signed-in tenant user (a cashier completing a sale must be able
 * to trigger it), which is exactly why the request carries a STRUCTURED
 * PAYLOAD and never message text: the wording is built here, server-side.
 * Accepting free-form text would let any staff account make the tenant's bot
 * post arbitrary content into the owner's group.
 */

const saleSchema = z.object({
  orderNumber: z.string().max(64),
  total: z.number().finite(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'debt']),
  itemCount: z.number().int().min(0).max(10_000),
  customerName: z.string().max(120).nullable().optional(),
})

const newOrderSchema = z.object({
  orderNumber: z.string().max(64),
  total: z.number().finite(),
  customerName: z.string().max(120).nullable().optional(),
})

const lowStockSchema = z.object({
  productName: z.string().max(200),
  sku: z.string().max(64),
  stock: z.number().finite(),
  minStock: z.number().finite(),
})

const debtPaymentSchema = z.object({
  customerName: z.string().max(120),
  amount: z.number().finite(),
})

const bodySchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('sale'), data: saleSchema }),
  z.object({ event: z.literal('new_order'), data: newOrderSchema }),
  z.object({ event: z.literal('low_stock'), data: lowStockSchema }),
  z.object({ event: z.literal('debt_payment'), data: debtPaymentSchema }),
])

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Naqd',
  card: 'Karta',
  transfer: "O'tkazma",
  debt: 'Qarz',
}

export async function POST(request: NextRequest) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const tenant = (await getCachedTenant(ctx.tenantId)) as { company_name?: string } | null
  const header = `<b>${escapeHtml(tenant?.company_name || 'ERP')}</b>`

  let text: string
  switch (parsed.data.event) {
    case 'sale': {
      const d = parsed.data.data
      const lines = [
        `🧾 ${header}`,
        `Yangi sotuv: <b>${escapeHtml(d.orderNumber)}</b>`,
        `Summa: <b>${escapeHtml(formatCurrency(d.total))}</b>`,
        `To'lov: ${escapeHtml(PAYMENT_LABEL[d.paymentMethod] ?? d.paymentMethod)}`,
        `Mahsulotlar: ${d.itemCount} ta`,
      ]
      if (d.customerName) lines.push(`Mijoz: ${escapeHtml(d.customerName)}`)
      text = lines.join('\n')
      break
    }
    case 'new_order': {
      const d = parsed.data.data
      const lines = [
        `📦 ${header}`,
        `Yangi buyurtma: <b>${escapeHtml(d.orderNumber)}</b>`,
        `Summa: <b>${escapeHtml(formatCurrency(d.total))}</b>`,
      ]
      if (d.customerName) lines.push(`Mijoz: ${escapeHtml(d.customerName)}`)
      text = lines.join('\n')
      break
    }
    case 'low_stock': {
      const d = parsed.data.data
      text = [
        `⚠️ ${header}`,
        `Zaxira tugayapti: <b>${escapeHtml(d.productName)}</b>`,
        `SKU: ${escapeHtml(d.sku)}`,
        `Qoldiq: <b>${escapeHtml(d.stock)}</b> (minimal: ${escapeHtml(d.minStock)})`,
      ].join('\n')
      break
    }
    case 'debt_payment': {
      const d = parsed.data.data
      text = [
        `💰 ${header}`,
        `Qarz to'landi: <b>${escapeHtml(d.customerName)}</b>`,
        `Summa: <b>${escapeHtml(formatCurrency(d.amount))}</b>`,
      ].join('\n')
      break
    }
  }

  const result = await notifyTelegram(ctx.tenantId, parsed.data.event, text)
  // Always 200: the caller's business write already succeeded, and a failed
  // notification must not read as a failed sale.
  return NextResponse.json(result)
}
