import { NextResponse } from 'next/server'
import { getSupportAgentSession } from '@/lib/admin-auth'
import { getAgentThreads } from '@/lib/support-messaging'

/** Every thread this agent can see: assigned tenants' tickets + admin DMs. */
export async function GET() {
  const session = await getSupportAgentSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ threads: await getAgentThreads(session.userId) })
}
