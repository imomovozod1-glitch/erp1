import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { getCachedTenant } from '@/lib/tenant'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { escapeHtml, notifyTelegram, notifySystemTelegram } from '@/lib/integrations/telegram'
import { formatCurrency, formatDate, isoDate } from '@/lib/utils'
import { SUBSCRIPTION_WARNING_DAYS, daysUntil } from '@/lib/subscription'

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
  // Carries no data at all: what it says is recomputed here from the tenant
  // row. A client-supplied "days left" would be a number the browser could
  // choose, in a message the company's own bot then posts as fact.
  z.object({ event: z.literal('subscription_expiring') }),
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

  const tenant = (await getCachedTenant(ctx.tenantId)) as
    | { company_name?: string; subscription_ends_at?: string | null }
    | null
  const header = `<b>${escapeHtml(tenant?.company_name || 'ERP')}</b>`

  if (parsed.data.event === 'subscription_expiring') {
    return NextResponse.json(await warnAboutSubscription(ctx.tenantId, header, tenant?.subscription_ends_at ?? null))
  }

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

/**
 * The subscription warning, sent at most once a day per company.
 *
 * Fired by the banner in the dashboard (src/components/shared/subscription-banner.tsx)
 * rather than by a scheduler, which is the same lazy pattern the subscription
 * gate itself uses (src/lib/tenant-status.ts) — this deployment has no cron.
 * Every staff member opening the dashboard therefore asks for it, so the day
 * is CLAIMED before the message is sent: the update only matches a row that
 * has not been stamped with today's date yet, and a second request finds no
 * row to claim. That is also what makes two people opening the app at the same
 * moment produce one message rather than two.
 */
async function warnAboutSubscription(
  tenantId: string,
  header: string,
  endsAt: string | null
): Promise<{ sent: boolean; reason?: string }> {
  const daysLeft = daysUntil(endsAt)
  if (endsAt === null || daysLeft === null || daysLeft < 0 || daysLeft > SUBSCRIPTION_WARNING_DAYS) {
    return { sent: false, reason: 'not_due' }
  }

  const today = isoDate()
  const service = getCacheClient() as any
  const { data: claimed, error } = await service
    .from('tenants')
    .update({ subscription_notified_on: today })
    .eq('id', tenantId)
    .or(`subscription_notified_on.is.null,subscription_notified_on.neq.${today}`)
    .select('id')

  if (error) {
    // PGRST204: supabase/migration_subscription_payments.sql has not been
    // applied here yet, so there is nowhere to record that today's message was
    // sent. Sending without that record would mean one message per person per
    // page load, so it waits for the column. The in-app banner still shows.
    return { sent: false, reason: error.code === 'PGRST204' ? 'not_available' : 'claim_failed' }
  }
  if (!claimed?.length) return { sent: false, reason: 'already_notified' }

  const text = [
    `⏳ ${header}`,
    daysLeft === 0
      ? 'Obuna <b>bugun</b> tugaydi.'
      : `Obuna tugashiga <b>${daysLeft} kun</b> qoldi.`,
    `Tugash sanasi: <b>${escapeHtml(formatDate(endsAt.slice(0, 10)))}</b>`,
    "To'lov qilinmasa, tizimdan foydalanish to'xtatiladi.",
  ].join('\n')

  return notifySystemTelegram(tenantId, 'subscription_expiring', text)
}
