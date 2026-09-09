import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantContext } from '@/lib/auth'
import { canDo, getDataScope, getPermissionContext } from '@/lib/permissions-server'
import { runReport } from '@/lib/reports/engine'
import {
  DATED_SOURCES,
  REPORT_SOURCES,
  SOURCE_GROUPINGS,
  type ReportSource,
} from '@/lib/reports/definitions'

/**
 * Runs one custom report.
 *
 * A report reads across a module's whole history, so it is gated by that
 * module's own view permission — not by "can see the Reports page" — and the
 * engine additionally narrows to the caller's own records where their data
 * scope says `own`. Building a report can therefore never surface a row the
 * module's list page would hide from them.
 */

const requestSchema = z.object({
  source: z.enum(REPORT_SOURCES),
  groupBy: z.string(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().max(120).optional(),
})

/** Which permission module each source belongs to. */
const SOURCE_MODULE = {
  sales: 'sales',
  purchases: 'procurement',
  finance: 'finance',
  inventory: 'inventory',
  movements: 'inventory',
} as const

export async function POST(request: NextRequest) {
  const ctx = await getTenantContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const input = parsed.data
  const source = input.source as ReportSource

  const allowedGroupings = SOURCE_GROUPINGS[source]
  const groupBy = (allowedGroupings as string[]).includes(input.groupBy)
    ? (input.groupBy as (typeof allowedGroupings)[number])
    : allowedGroupings[0]

  const permissionModule = SOURCE_MODULE[source]
  // Reading the Reports page is not enough: the data itself belongs to another
  // module, and that module's permission is what decides.
  if (!(await canDo(permissionModule, 'view'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const [scope, permCtx] = await Promise.all([getDataScope(permissionModule), getPermissionContext()])
  const ownerId = scope === 'own' ? permCtx?.userId : undefined

  try {
    const result = await runReport(
      { tenantId: ctx.tenantId, ownerId },
      {
        source,
        groupBy,
        // Undated sources are a snapshot of "now"; a period would be a lie.
        from: DATED_SOURCES.includes(source) ? input.from : undefined,
        to: DATED_SOURCES.includes(source) ? input.to : undefined,
        search: input.search,
      }
    )
    return NextResponse.json(result)
  } catch (error: any) {
    console.warn('[reports] run failed:', error?.message)
    return NextResponse.json({ error: 'report_failed' }, { status: 500 })
  }
}
