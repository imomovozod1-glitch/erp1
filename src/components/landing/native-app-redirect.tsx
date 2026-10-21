'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * The Capacitor shell opens the bare host (`server.url` in
 * capacitor.config.ts), which is where the landing page lives. Someone who
 * installed the app came to sign in, not to be sold it — send the native
 * WebView straight on to the login screen. A no-op in a regular browser.
 */
export function NativeAppRedirect({ href }: { href: string }) {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) window.location.replace(href)
  }, [href])
  return null
}
