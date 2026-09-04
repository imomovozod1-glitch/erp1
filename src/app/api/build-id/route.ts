import { NextResponse } from 'next/server'

/**
 * Lets the Capacitor shell (src/components/providers/capacitor-provider.tsx)
 * detect a new deploy after the WebView has been sitting on an old page —
 * unlike a browser tab, resuming the native app from the background never
 * re-fetches on its own. Reads the same NEXT_PUBLIC_BUILD_ID baked in at
 * build time (see next.config.ts) that the currently loaded page already
 * has, so the client can just compare the two.
 */
export async function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID || null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
