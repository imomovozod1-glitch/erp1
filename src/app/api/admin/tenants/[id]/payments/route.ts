import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'
import { isoDate } from '@/lib/utils'
import { addMonths, isSubscriptionExpired } from '@/lib/subscription'

const paymentSchema = z.object({
  amount: z.number().positive(),
  note: z.string().optional().nullable(),
  /** The term this payment buys; defaults to the tenant's current one. */
  license_months: z.number().int().min(1).max(120).optional(),
  /** Seats this payment covers; defaults to the tenant's current count. */
  license_count: z.number().int().min(1).optional(),
})

/**
 * Records a payment and extends the subscription by the chosen term (or the
 * tenant's current `license_months`) — from the later of "today" or the current
 * subscription_ends_at, so paying while still active stacks the new term
 * on top instead of shortening it. Always reactivates status to 'active'
 * (see src/lib/tenant-status.ts for the read-time active→blocked direction).
 *
 * The month arithmetic is src/lib/subscription.ts, shared with the dialog that
 * previews the new date. They each had their own copy before, and both rolled
 * 31 January + 1 month forward to 3 March.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSuperAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const input = parsed.data

  const supabase = getCacheClient() as any

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, price_paid, subscription_ends_at, license_months')
    .eq('id', id)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const today = isoDate()
  // Stack on top of a running subscription, restart from today once it has
  // lapsed. "Running" is decided by the calendar, not by a timestamp: the end
  // date is inclusive, so a company paying on the last day of its term keeps
  // that day instead of silently losing it (src/lib/subscription.ts).
  const base =
    tenant.subscription_ends_at && !isSubscriptionExpired(tenant.subscription_ends_at, today)
      ? String(tenant.subscription_ends_at).slice(0, 10)
      : today
  const months = input.license_months ?? (tenant.license_months || 1)
  const newEndsAt = addMonths(base, months)

  const payment = {
    tenant_id: id,
    amount: input.amount,
    note: input.note || null,
    recorded_by: session.userId,
  }

  // What this payment bought, so the term can be answered from history rather
  // than from a single column on the tenant row that the next payment
  // overwrites (supabase/migration_subscription_payments.sql).
  const { error: paymentError } = await supabase.from('tenant_payments').insert({
    ...payment,
    license_months: months,
    license_count: input.license_count ?? null,
    period_start: base,
    period_end: newEndsAt,
  })

  if (paymentError) {
    // PGRST204: the migration adding those columns has not been applied here
    // yet. Recording the payment matters more than recording its shape, so the
    // bare row still goes in — delete this fallback once the migration is
    // everywhere.
    if (paymentError.code !== 'PGRST204') {
      return NextResponse.json({ error: paymentError.message }, { status: 400 })
    }
    const { error: fallbackError } = await supabase.from('tenant_payments').insert(payment)
    if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 400 })
  }

  const { data: updatedTenant, error: updateError } = await supabase
    .from('tenants')
    .update({
      price_paid: Number(tenant.price_paid || 0) + input.amount,
      subscription_ends_at: newEndsAt,
      license_months: months,
      ...(input.license_count !== undefined ? { license_count: input.license_count } : {}),
      status: 'active',
    })
    .eq('id', id)
    .select()
    .single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  // The company is unblocked the instant this returns, not a cache window
  // later: both the API gate (isTenantActive) and the cached tenant row hang
  // off this tag.
  revalidateTag(`tenant:${id}`, { expire: 0 })

  return NextResponse.json({ tenant: updatedTenant }, { status: 201 })
}
