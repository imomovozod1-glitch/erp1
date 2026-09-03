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

      const isDark = document.documentElement.classList.contains('dark')
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {})

      await SplashScreen.hide().catch(() => {})
    })()

    return () => {
      cancelled = true
      backListener?.remove()
    }
  }, [router])

  return null
}
