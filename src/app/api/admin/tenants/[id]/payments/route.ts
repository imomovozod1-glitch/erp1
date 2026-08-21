import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSuperAdminSession } from '@/lib/admin-auth'
import { getCacheClient } from '@/lib/supabase/cache-client'

const paymentSchema = z.object({
  amount: z.number().positive(),
  note: z.string().optional().nullable(),
})

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/**
 * Records a payment and extends the subscription by the tenant's
 * `license_months` term — from the later of "today" or the current
 * subscription_ends_at, so paying while still active stacks the new term
 * on top instead of shortening it. Always reactivates status to 'active'
 * (see src/lib/tenant-status.ts for the read-time active→blocked direction).
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

  const today = new Date().toISOString().slice(0, 10)
  const base =
    tenant.subscription_ends_at && new Date(tenant.subscription_ends_at).getTime() > Date.now()
      ? tenant.subscription_ends_at
      : today
  const newEndsAt = addMonths(base, tenant.license_months || 1)

  const { error: paymentError } = await supabase.from('tenant_payments').insert({
    tenant_id: id,
    amount: input.amount,
    note: input.note || null,
    recorded_by: session.userId,
  })
  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 400 })

  const { data: updatedTenant, error: updateError } = await supabase
    .from('tenants')
    .update({
      price_paid: Number(tenant.price_paid || 0) + input.amount,
      subscription_ends_at: newEndsAt,
      status: 'active',
    })
    .eq('id', id)
    .select()
    .single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ tenant: updatedTenant }, { status: 201 })
}
