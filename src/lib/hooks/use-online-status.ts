'use client'

import { useSyncExternalStore } from 'react'

/**
 * Connectivity state for the UI.
 *
 * `useSyncExternalStore`, not `useState` + `useEffect`: connectivity changes
 * outside React's render cycle, and this project's lint setup treats a
 * `setState` inside `useEffect` as an error under the React Compiler rules
 * (see CLAUDE.md → Gotchas, and src/components/shared/page-clock.tsx for the
 * same pattern).
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function getSnapshot(): boolean {
  return navigator.onLine
}

/** Server render has no connectivity notion — assume online so markup matches the online client. */
function getServerSnapshot(): boolean {
  return true
}

/**
 * NOTE: `navigator.onLine` only reports whether the device has *a* network
 * interface up. A phone attached to a Wi-Fi access point with no working
 * uplink still reports `true`. Treat this as a fast hint for the UI and use
 * `probeConnection()` before deciding the server is genuinely reachable.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Actually reach the server. Uses the existing build-id endpoint
 * (src/app/api/build-id/route.ts) — it is tiny, uncached, and already
 * deployed, so it needs no new route.
 */
export async function probeConnection(timeoutMs = 4000): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('/api/build-id', { cache: 'no-store', signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
