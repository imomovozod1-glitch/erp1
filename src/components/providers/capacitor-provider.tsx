'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

/**
 * Native-shell glue, active only inside the Capacitor iOS/Android wrapper —
 * a no-op on the regular web app (Capacitor.isNativePlatform() is false
 * there, and the plugin imports below resolve to web stubs that do nothing
 * if this ever ran there anyway).
 */
export function CapacitorProvider() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let backListener: { remove: () => void } | undefined
    let stateListener: { remove: () => void } | undefined
    let themeObserver: MutationObserver | undefined
    let cancelled = false

    ;(async () => {
      const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
      ])
      if (cancelled) return

      // Android hardware back button: go back in-app history instead of the
      // default (exit the app on first press) — exit only when there's
      // nowhere left to go back to.
      backListener = await App.addListener('backButton', () => {
        if (window.history.length > 1) {
          router.back()
        } else {
          App.exitApp()
        }
      })

      // Unlike a browser tab, resuming this native shell from the background
      // never re-fetches the page on its own — it keeps showing whatever was
      // loaded at launch, even after a new deploy has gone out. On resume,
      // compare the running page's build id against the server's current one
      // (src/app/api/build-id/route.ts) and reload only when they differ, so
      // switching apps briefly doesn't lose in-progress form state for
      // nothing.
      const runningBuildId = process.env.NEXT_PUBLIC_BUILD_ID
      stateListener = await App.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive || !runningBuildId) return
        try {
          const res = await fetch('/api/build-id', { cache: 'no-store' })
          const { buildId } = await res.json()
          if (buildId && buildId !== runningBuildId) {
            window.location.reload()
          }
        } catch {
          // Offline or request failed — keep showing the current page.
        }
      })

      // Both targetSdk 35+ on Android (edge-to-edge is OS-enforced, can no
      // longer be opted out of) and iOS notch devices otherwise draw the
      // WebView under the status bar — env(safe-area-inset-top) alone isn't
      // reliably wired through the Android WebView, so ask the native layer
      // to push web content below the status bar explicitly rather than
      // depending on CSS insets to do it.
      await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})

      // The status bar tracks the app theme for the whole session, not just at
      // launch: switching to dark in the app must not leave a white bar with
      // white icons above it. Colours are the app bar's (--card on each theme).
      const paintStatusBar = () => {
        const isDark = document.documentElement.classList.contains('dark')
        StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {})
        StatusBar.setBackgroundColor({ color: isDark ? '#151027' : '#ffffff' }).catch(() => {})
      }
      paintStatusBar()
      themeObserver = new MutationObserver(paintStatusBar)
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

      await SplashScreen.hide().catch(() => {})
    })()

    return () => {
      cancelled = true
      backListener?.remove()
      stateListener?.remove()
      themeObserver?.disconnect()
    }
  }, [router])

  return null
}
