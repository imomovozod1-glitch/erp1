import 'server-only'
import { NextResponse } from 'next/server'

/**
 * An unexpected failure in a super-admin route (a raw Supabase or Vercel
 * message): logged here with its detail, answered as `server_error`, which the
 * console shows as its own translated generic message (src/lib/admin-errors.ts).
 */
export function adminServerError(error: unknown, status = 400) {
  console.error('[admin api]', error)
  return NextResponse.json({ error: 'server_error' }, { status })
}
